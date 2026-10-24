#!/usr/bin/env bash
# Installs the Ubuntu packages the end-to-end test browsers need, in CI.
#
# GitHub's cache keeps the downloaded packages in the folder given as the first argument,
# keyed to the runner image and the Playwright version. A normal run installs them from
# there and downloads nothing from Ubuntu's servers, which are sometimes very slow.
# Playwright then confirms nothing is missing. If anything is (an empty or out-of-date
# cache), the missing packages are downloaded from Ubuntu once and kept for the next run.
#
# The install from the cache is given no download sources, so it can never wait on a slow
# Ubuntu server: if the cache lacks something, it fails at once and the download takes over.
# apt shows its progress, waits at most a minute for another apt or dpkg to finish, and the
# install from the cache stops after four minutes instead of using up the step's time limit.
#
# Usage: scripts/browser-deps.sh <cache folder>
set -euo pipefail
CACHE="${1:?cache folder}"
BROWSERS=(chromium webkit)
APT_OPTIONS=(-y -q --no-install-recommends -o DPkg::Lock::Timeout=60 -o Dpkg::Use-Pty=0)
CACHE_LIMIT_SECONDS=240

# Playwright simulates the install with apt-get and lists what is still missing.
all_installed() {
  npx playwright install-deps --dry-run "${BROWSERS[@]}" > /dev/null 2>&1
}
missing_packages() {
  npx playwright install-deps --dry-run "${BROWSERS[@]}" 2>&1 |
    awk '/^Missing system dependencies/ { list = 1; next } list && /^  [^ ]/ { print $1 }'
}

# GitHub folds these lines away in the log until they are opened.
group() { [[ -z "${GITHUB_ACTIONS:-}" ]] || echo "::group::$1"; }
end_group() { [[ -z "${GITHUB_ACTIONS:-}" ]] || echo "::endgroup::"; }

shopt -s nullglob
cached=("$CACHE"/*.deb)
if ((${#cached[@]} > 0)); then
  # apt, not dpkg, so packages install in the order their dependencies need.
  echo "Installing ${#cached[@]} packages from the cache."
  no_sources="$(mktemp -d)"
  group "apt output"
  status=0
  sudo env DEBIAN_FRONTEND=noninteractive timeout --kill-after=10 "$CACHE_LIMIT_SECONDS" \
    apt-get install "${APT_OPTIONS[@]}" \
    -o Dir::Etc::SourceList=/dev/null -o Dir::Etc::SourceParts="$no_sources" \
    "${cached[@]}" || status=$?
  end_group
  rmdir "$no_sources"
  if ((status == 124 || status == 137)); then
    echo "Installing from the cache stalled for $CACHE_LIMIT_SECONDS seconds. apt's last lines show where." >&2
    exit 1
  fi
  ((status == 0)) || echo "The cached packages didn't install cleanly."
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
# Packages already in the cache are used again, so only the missing ones are downloaded.
mkdir -p "$CACHE/partial"
sudo env DEBIAN_FRONTEND=noninteractive apt-get install "${APT_OPTIONS[@]}" --fix-broken \
  -o Dir::Cache::archives="$CACHE" "${packages[@]}"
sudo rm -rf "$CACHE/partial" "$CACHE/lock"
sudo chown -R "$(id -u):$(id -g)" "$CACHE"

all_installed || {
  echo "Packages are still missing after the download:" >&2
  npx playwright install-deps --dry-run "${BROWSERS[@]}" >&2
  exit 1
}
echo "Every Ubuntu package the test browsers need is installed."
