#!/bin/sh
# Regenerates the API contract and the Dart client from the Zod route schemas (ADR 0008).
# CI runs this and fails if the result differs from what is committed.
set -eu
cd "$(dirname "$0")"

pnpm --filter @nextbank/api contract

# Generator image pinned by digest (v7.25.0). pwd -W gives a Docker-friendly path on Git Bash.
host_dir=$(pwd -W 2>/dev/null || pwd)
MSYS_NO_PATHCONV=1 docker run --rm -u "$(id -u):$(id -g)" -v "$host_dir:/local" \
  openapitools/openapi-generator-cli@sha256:2ab0a9680222de65dc9d3baf861aa02b99e1b80c211d8221ebf3ae8f8a102524 \
  generate -i /local/openapi.json -g dart-dio -o /local/dart \
  --additional-properties=pubName=nextbank_api,serializationLibrary=json_serializable,dateLibrary=core,enumUnknownDefaultCase=true

cd dart
dart pub get
dart run build_runner build --delete-conflicting-outputs
