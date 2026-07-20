#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="${1:-$ROOT_DIR/android/app/build/generated/silent-payments/jniLibs}"
MANIFEST="$ROOT_DIR/native/silent-payments-jni/Cargo.toml"

fail() {
  printf 'silent-payments native build: %s\n' "$1" >&2
  exit 1
}

command -v cargo >/dev/null 2>&1 || fail "cargo is required; install Rust via rustup"
command -v cargo-ndk >/dev/null 2>&1 || fail "cargo-ndk is required; install with 'cargo install cargo-ndk'"

if [[ -z "${ANDROID_NDK_HOME:-}" && -z "${ANDROID_NDK_ROOT:-}" ]]; then
  if [[ -z "${ANDROID_HOME:-}" && -z "${ANDROID_SDK_ROOT:-}" ]]; then
    fail "Android NDK is required; set ANDROID_NDK_HOME (or ANDROID_NDK_ROOT), or set ANDROID_HOME/ANDROID_SDK_ROOT"
  fi
fi

for target in aarch64-linux-android x86_64-linux-android; do
  rustup target list --installed 2>/dev/null | grep -qx "$target" || \
    fail "Rust target $target is missing; install with 'rustup target add $target'"
done

[[ -f "$MANIFEST" ]] || fail "JNI Cargo manifest not found at $MANIFEST"
mkdir -p "$OUTPUT_DIR"

printf 'Building silent-payments JNI for arm64-v8a and x86_64 into %s\n' "$OUTPUT_DIR"
cargo ndk \
  -t arm64-v8a \
  -t x86_64 \
  -o "$OUTPUT_DIR" \
  build \
  --manifest-path "$MANIFEST" \
  --release
