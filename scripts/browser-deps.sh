#!/usr/bin/env bash
# Installs the Ubuntu packages the end-to-end test browsers need, in CI.
#
# GitHub's cache keeps the downloaded packages in the folder given as the first argument,
# keyed to the runner image and the Playwright version. A normal run installs them from
# there and downloads nothing from Ubuntu's servers, which are sometimes very slow.
# Playwright then confirms nothing is missing. If anything is (an empty or out-of-date
# cache), the packages are downloaded from Ubuntu once and kept for the next run.
#
# Usage: scripts/browser-deps.sh <cache folder>
set -euo pipefail
CACHE="${1:?cache folder}"
BROWSERS=(chromium webkit)

# Playwright simulates the install with apt-get and lists what is still missing.
all_installed() {
  npx playwright install-deps --dry-run "${BROWSERS[@]}" > /dev/null 2>&1
}
missing_packages() {
  npx playwright install-deps --dry-run "${BROWSERS[@]}" 2>&1 |
    awk '/^Missing system dependencies/ { list = 1; next } list && /^  [^ ]/ { print $1 }'
}

shopt -s nullglob
cached=("$CACHE"/*.deb)
if ((${#cached[@]} > 0)); then
  # apt, not dpkg, so packages install in the order their dependencies need.
  echo "Installing ${#cached[@]} packages from the cache."
  sudo env DEBIAN_FRONTEND=noninteractive apt-get install -y -q --no-install-recommends \
    "${cached[@]}" > /dev/null || echo "The cached packages didn't install cleanly."
fi

if all_installed; then
  echo "Every Ubuntu package the test browsers need is installed."
  exit 0
fi

echo "Downloading the missing packages from Ubuntu and keeping them for the next run."
sudo apt-get update -q
mapfile -t packages < <(missing_packages)
if ((${#packages[@]} == 0)); then
  echo "Playwright reports missing packages but didn't list them:" >&2
  npx playwright install-deps --dry-run "${BROWSERS[@]}" >&2 || true
  exit 1
fi
mkdir -p "$CACHE"
find "$CACHE" -mindepth 1 -delete
mkdir -p "$CACHE/partial"
sudo env DEBIAN_FRONTEND=noninteractive apt-get install -y -q --fix-broken --no-install-recommends \
  -o Dir::Cache::archives="$CACHE" "${packages[@]}"
sudo rm -rf "$CACHE/partial" "$CACHE/lock"
sudo chown -R "$(id -u):$(id -g)" "$CACHE"

all_installed || {
  echo "Packages are still missing after the download:" >&2
  npx playwright install-deps --dry-run "${BROWSERS[@]}" >&2
  exit 1
}
echo "Every Ubuntu package the test browsers need is installed."
