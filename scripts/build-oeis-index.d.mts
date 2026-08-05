// Type declarations for the handful of build-oeis-index.mjs exports that
// tests/scripts/build-oeis-index.test.ts imports. The script itself stays
// plain, untyped Node ESM per its brief ("no new npm dependencies... plain
// Node ESM script") — this sidecar exists solely so `tsc --noEmit` can
// resolve the import from a .ts test file without widening allowJs (and
// therefore JS type-checking laxness) onto the whole project.
export function readLinesFromStream(
  stream: NodeJS.ReadableStream,
  onLine: (line: string) => void,
): Promise<void>;

export function countReplacementChars(text: string): number;

export function countNonAsciiLines(text: string): number;
