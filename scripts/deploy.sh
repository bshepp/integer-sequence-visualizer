#!/usr/bin/env bash
# Deploy the built site + OEIS data to S3/CloudFront.
#
# Run from the repo root:  bash scripts/deploy.sh
#
# Prerequisites: `npm run build:data` has generated public/data/, and the AWS
# CLI is configured for the account that owns the bucket below.
set -euo pipefail

BUCKET=ulam-briansheppard-com
DISTRIBUTION=E24RI80DXLMTA4
INDEX_KEY=data/search-index.txt

echo "==> building"
npm run build

echo "==> syncing dist/ to s3://$BUCKET/"
# The search index is excluded here and uploaded separately, pre-compressed:
# CloudFront only auto-compresses responses up to 10 MB, and this file is far
# larger, so a plain sync would serve ~39 MB of uncompressed text on the first
# search. Uploading the gzipped bytes under the same key with
# Content-Encoding: gzip cuts that to ~7 MB and browsers decompress it
# transparently.
aws s3 sync dist/ "s3://$BUCKET/" --delete --exclude "$INDEX_KEY" --only-show-errors

echo "==> uploading pre-compressed search index"
tmp=$(mktemp -t search-index.XXXXXX.gz)
trap 'rm -f "$tmp"' EXIT
gzip -9 -c "dist/$INDEX_KEY" > "$tmp"
aws s3 cp "$tmp" "s3://$BUCKET/$INDEX_KEY" \
  --content-encoding gzip \
  --content-type "text/plain; charset=utf-8" \
  --cache-control "public, max-age=86400" \
  --only-show-errors

echo "==> invalidating CloudFront"
# MSYS_NO_PATHCONV stops Git Bash on Windows from rewriting the leading-slash
# invalidation paths into Windows paths, which CloudFront rejects.
MSYS_NO_PATHCONV=1 aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION" \
  --paths "/" "/index.html" "/$INDEX_KEY" \
  --query "Invalidation.Id" --output text

echo "==> done: https://ulam.briansheppard.com/"
