#!/bin/sh
set -eu

cd "$(dirname "$0")/.."
if ! docker info >/dev/null 2>&1; then
  echo 'Docker is unavailable. Start Docker Desktop (or a Docker daemon) and retry.' >&2
  exit 1
fi

image_file=$(mktemp)
container_name="config-lint-integration-$(date +%s)-$$"
cleanup() {
  docker rm -f "$container_name" >/dev/null 2>&1 || true
  rm -f "$image_file"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

docker build --file tests/Dockerfile --tag config-lint-integration --iidfile "$image_file" .
docker run --rm --init --name "$container_name" --shm-size=256m "$(cat "$image_file")"
