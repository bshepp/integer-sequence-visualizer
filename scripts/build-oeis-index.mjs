#!/usr/bin/env node
// Builds the static OEIS lookup + search data served from public/data/.
//
// Why: OEIS's /search endpoint is behind Cloudflare, which challenges
// requests from datacenter IPs (HTTP 403 "Just a moment...") - so a
// deployed proxy to /search never works. Static files, including OEIS's
// own daily bulk downloads, are the documented path for bulk consumers
// (see the OEIS EULA) and are what we serve from our own origin instead.
//
// Inputs (OEIS's daily snapshots):
//   https://oeis.org/names.gz    "A000001 <name>" per line
//   https://oeis.org/stripped.gz "A000001 ,t0,t1,t2,...," per line
// Both carry 4 leading "#" comment lines. There is no bulk offsets file,
// so lookupById always reports offset 0 for OEIS sequences (see README).
//
// Outputs (public/data/, gitignored - regenerate with `npm run build:data`):
//   seq/<shard>.json     shard = zero-padded thousands bucket of the
//                         A-number (A019488 -> "019"); maps A-number ->
//                         { n: <name>, d: <comma-separated terms, no
//                         leading/trailing comma> }.
//   search-index.txt     one line per sequence: "A000045\t<name>".
//   meta.json            { generated, count, source, license }.
//
// No new npm dependencies: only node:fs, node:zlib, node:stream/node
// stream iteration, node:path, node:url, and global fetch.

import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createGunzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const NAMES_URL = 'https://oeis.org/names.gz';
const STRIPPED_URL = 'https://oeis.org/stripped.gz';

const DEFAULT_CACHE_DIR = path.join(ROOT, '.oeis-cache');
const OUT_DIR = path.join(ROOT, 'public', 'data');

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_UNCAPPED_BYTES = 120 * 1024 * 1024; // ~120 MB "size control" threshold
const TERMS_CAP_WHEN_OVERSIZED = 80;

function parseArgs(argv) {
  const args = { force: false, fromCache: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--force') args.force = true;
    else if (argv[i] === '--from-cache') args.fromCache = argv[++i] ?? null;
    else if (argv[i] === '--help' || argv[i] === '-h') {
      console.log('Usage: node scripts/build-oeis-index.mjs [--force] [--from-cache <dir>]');
      process.exit(0);
    }
  }
  return args;
}

// Downloads url -> destPath, unless a usable cached copy already exists.
// When trustExisting is set (i.e. --from-cache), an existing file is always
// reused regardless of age, so re-runs against a known-good cache never hit
// the network. Otherwise a cached file is reused only if younger than 24h
// (or --force is not set).
async function ensureFile(url, destPath, { force, trustExisting }) {
  if (existsSync(destPath)) {
    if (trustExisting) {
      console.log(`Using cached ${path.basename(destPath)} (from --from-cache, trusted as-is).`);
      return;
    }
    if (!force) {
      const ageMs = Date.now() - statSync(destPath).mtimeMs;
      if (ageMs < DAY_MS) {
        console.log(`Using cached ${path.basename(destPath)} (${(ageMs / 3600000).toFixed(1)}h old).`);
        return;
      }
      console.log(`Cached ${path.basename(destPath)} is stale (${(ageMs / 3600000).toFixed(1)}h old); refreshing.`);
    }
  }
  console.log(`Downloading ${url} -> ${destPath}`);
  mkdirSync(path.dirname(destPath), { recursive: true });
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Failed to download ${url} (HTTP ${res.status}).`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(destPath));
  console.log(`Saved ${path.basename(destPath)}.`);
}

// Splits a Readable text stream into lines, invoking onLine(line) for each
// (without its trailing newline). IMPORTANT: this switches the stream to
// utf8 encoding via setEncoding(), which makes Node buffer partial
// multi-byte UTF-8 sequences across chunk boundaries internally (a
// StringDecoder) instead of decoding each Buffer chunk in isolation. A
// naive `carry += chunk` on raw Buffer chunks coerces each chunk to a
// string independently - any multi-byte character that happens to
// straddle a chunk boundary silently becomes two U+FFFD replacement
// characters instead of one real character, with no exception thrown.
// names.gz is full of accented names (Bézout, Erdős, Recamán, Ménage,
// Möbius) so this is not a hypothetical edge case for this data.
// Exported so tests can drive it directly with deliberately split chunks,
// without needing a real gzip fixture or relying on a boundary hit.
export async function readLinesFromStream(stream, onLine) {
  stream.setEncoding('utf8');
  let carry = '';
  for await (const chunk of stream) {
    carry += chunk;
    let nl;
    while ((nl = carry.indexOf('\n')) >= 0) {
      onLine(carry.slice(0, nl));
      carry = carry.slice(nl + 1);
    }
  }
  if (carry) onLine(carry);
}

// Streams a gzipped text file and invokes onLine(line) for each line,
// without holding the whole decompressed text in memory at once.
async function readGzLines(gzPath, onLine) {
  const stream = createReadStream(gzPath).pipe(createGunzip());
  await readLinesFromStream(stream, onLine);
}

// Pure helpers for the end-of-build encoding guard (see main()). Exported
// so they're independently testable without running the whole build.
export function countReplacementChars(text) {
  return (text.match(/�/g) ?? []).length;
}

export function countNonAsciiLines(text) {
  let count = 0;
  for (const line of text.split('\n')) {
    if (/[^\x00-\x7F]/.test(line)) count++;
  }
  return count;
}

function shardFor(aNumber) {
  const n = Number(aNumber.slice(1));
  return String(Math.floor(n / 1000)).padStart(3, '0');
}

function capTerms(termsCsv, cap) {
  if (!termsCsv) return termsCsv;
  const parts = termsCsv.split(',');
  return parts.length > cap ? parts.slice(0, cap).join(',') : termsCsv;
}

// Groups nameMap/dataMap into { shard -> { aNumber -> { n, d } } }.
function buildShards(nameMap, dataMap) {
  const shards = new Map();
  for (const [id, name] of nameMap) {
    const shard = shardFor(id);
    let bucket = shards.get(shard);
    if (!bucket) { bucket = {}; shards.set(shard, bucket); }
    bucket[id] = { n: name, d: dataMap.get(id) ?? '' };
  }
  return shards;
}

// Serializes every shard once and returns both the JSON text (for writing)
// and the total byte count (for the size-control decision), so a shard is
// never stringified twice unless the cap actually needs to be applied.
function serializeShards(shards) {
  const jsonByShard = new Map();
  let bytes = 0;
  for (const [shard, bucket] of shards) {
    const json = JSON.stringify(bucket);
    jsonByShard.set(shard, json);
    bytes += Buffer.byteLength(json);
  }
  return { jsonByShard, bytes };
}

function mb(bytes) {
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cacheDir = args.fromCache ? path.resolve(args.fromCache) : DEFAULT_CACHE_DIR;
  const namesGz = path.join(cacheDir, 'names.gz');
  const strippedGz = path.join(cacheDir, 'stripped.gz');
  const trustExisting = Boolean(args.fromCache);

  await ensureFile(NAMES_URL, namesGz, { force: args.force, trustExisting });
  await ensureFile(STRIPPED_URL, strippedGz, { force: args.force, trustExisting });

  console.log('Parsing names.gz ...');
  const nameMap = new Map();
  await readGzLines(namesGz, (line) => {
    if (!line || line.startsWith('#')) return;
    const sp = line.indexOf(' ');
    if (sp < 0) return;
    nameMap.set(line.slice(0, sp), line.slice(sp + 1));
  });

  console.log('Parsing stripped.gz ...');
  const dataMap = new Map();
  await readGzLines(strippedGz, (line) => {
    if (!line || line.startsWith('#')) return;
    const sp = line.indexOf(' ');
    if (sp < 0) return;
    const id = line.slice(0, sp);
    let rest = line.slice(sp + 1);
    if (rest.startsWith(',')) rest = rest.slice(1);
    if (rest.endsWith(',')) rest = rest.slice(0, -1);
    dataMap.set(id, rest);
  });

  console.log(`Parsed ${nameMap.size} names, ${dataMap.size} data rows.`);
  // Every id with terms but no name is meaningless for our shape (name is
  // required); ids with a name but no terms are kept with terms: "" (e.g.
  // "allocated for ..." placeholders). Report anything unusual.
  let orphanData = 0;
  for (const id of dataMap.keys()) if (!nameMap.has(id)) orphanData++;
  if (orphanData > 0) {
    console.log(`Note: ${orphanData} stripped.gz row(s) have no matching name and were skipped.`);
  }

  const searchIndexLines = [];
  for (const [id, name] of nameMap) searchIndexLines.push(`${id}\t${name}`);
  const searchIndexText = searchIndexLines.join('\n') + '\n';
  const searchIndexBytes = Buffer.byteLength(searchIndexText);

  const shards = buildShards(nameMap, dataMap);
  let { jsonByShard, bytes: seqBytes } = serializeShards(shards);

  let totalBytes = seqBytes + searchIndexBytes;
  let capped = false;
  if (totalBytes > MAX_UNCAPPED_BYTES) {
    capped = true;
    console.log(
      `Emitted size ${mb(totalBytes)} exceeds the ${mb(MAX_UNCAPPED_BYTES)} size-control ` +
      `threshold; capping terms at the first ${TERMS_CAP_WHEN_OVERSIZED} per sequence ` +
      `(b-file deep fetch still covers users who need more).`,
    );
    for (const bucket of shards.values()) {
      for (const entry of Object.values(bucket)) entry.d = capTerms(entry.d, TERMS_CAP_WHEN_OVERSIZED);
    }
    ({ jsonByShard, bytes: seqBytes } = serializeShards(shards));
    totalBytes = seqBytes + searchIndexBytes;
  }

  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(path.join(OUT_DIR, 'seq'), { recursive: true });

  for (const [shard, json] of jsonByShard) {
    writeFileSync(path.join(OUT_DIR, 'seq', `${shard}.json`), json);
  }
  const searchIndexPath = path.join(OUT_DIR, 'search-index.txt');
  writeFileSync(searchIndexPath, searchIndexText);

  const meta = {
    generated: new Date().toISOString(),
    count: nameMap.size,
    source: 'oeis.org names.gz + stripped.gz',
    license: 'CC BY-SA 4.0',
  };
  const metaText = JSON.stringify(meta, null, 2) + '\n';
  writeFileSync(path.join(OUT_DIR, 'meta.json'), metaText);
  totalBytes += Buffer.byteLength(metaText);

  // End-of-build encoding guard: re-read the file we just wrote (not the
  // in-memory string) and scan it for U+FFFD replacement characters. Their
  // presence means a multi-byte character was mis-decoded somewhere in the
  // pipeline (see readLinesFromStream's docs) - fail loudly here rather
  // than silently shipping corrupted names to production.
  const writtenIndexText = readFileSync(searchIndexPath, 'utf8');
  const nonAsciiLines = countNonAsciiLines(writtenIndexText);
  const replacementChars = countReplacementChars(writtenIndexText);

  console.log('---');
  console.log(`Sequences: ${nameMap.size}`);
  console.log(`Shards: ${jsonByShard.size}`);
  console.log(`Terms cap: ${capped ? `${TERMS_CAP_WHEN_OVERSIZED} terms/sequence (applied)` : 'none (full stripped.gz terms retained)'}`);
  console.log(`seq/*.json: ${mb(seqBytes)}`);
  console.log(`search-index.txt: ${mb(searchIndexBytes)}`);
  console.log(`Non-ASCII names: ${nonAsciiLines}`);
  console.log(`Total bytes written: ${totalBytes} (${mb(totalBytes)})`);

  if (replacementChars > 0) {
    throw new Error(
      `Encoding corruption detected: ${replacementChars} U+FFFD replacement character(s) found ` +
      `in ${searchIndexPath}. This means a multi-byte UTF-8 character was mis-decoded somewhere ` +
      `in the build (e.g. split across a stream chunk boundary). Aborting before this reaches ` +
      `production - do not deploy this public/data/ directory.`,
    );
  }
}

// Only run the build when this file is executed directly (`node
// scripts/build-oeis-index.mjs`), not when it's imported - e.g. by tests
// importing readLinesFromStream/countReplacementChars/countNonAsciiLines
// in isolation, which must not trigger a live download of OEIS's bulk
// files as a side effect of merely loading the module.
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    console.error(err.stack ?? String(err));
    process.exitCode = 1;
  });
}
