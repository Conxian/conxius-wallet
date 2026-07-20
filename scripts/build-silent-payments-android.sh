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
command -v rustup >/dev/null 2>&1 || fail "rustup is required to verify Android Rust targets"

NDK_DIR="${ANDROID_NDK_HOME:-${ANDROID_NDK_ROOT:-}}"
if [[ -n "$NDK_DIR" ]]; then
  [[ -d "$NDK_DIR" ]] || fail "Android NDK directory does not exist: $NDK_DIR"
else
  SDK_DIR="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
  [[ -n "$SDK_DIR" ]] || fail "Android NDK is required; set ANDROID_NDK_HOME (or ANDROID_NDK_ROOT), or set ANDROID_HOME/ANDROID_SDK_ROOT"
  [[ -d "$SDK_DIR/ndk" ]] || fail "Android SDK NDK directory not found at $SDK_DIR/ndk; install/configure an NDK without changing this build"
  NDK_DIR="$(find "$SDK_DIR/ndk" -mindepth 1 -maxdepth 1 -type d -print | sort | tail -n 1)"
  [[ -n "$NDK_DIR" ]] || fail "No Android NDK installation found under $SDK_DIR/ndk"
  export ANDROID_NDK_HOME="$NDK_DIR"
fi

for target in aarch64-linux-android x86_64-linux-android; do
  rustup target list --installed 2>/dev/null | grep -qx "$target" || \
    fail "Rust target $target is missing; install with 'rustup target add $target'"
done

[[ -f "$MANIFEST" ]] || fail "JNI Cargo manifest not found at $MANIFEST"
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

printf 'Building silent-payments JNI for arm64-v8a and x86_64 into %s\n' "$OUTPUT_DIR"
pushd "$(dirname "$MANIFEST")" >/dev/null
cargo ndk \
  -t arm64-v8a \
  -t x86_64 \
  -o "$OUTPUT_DIR" \
  build \
  --manifest-path "$MANIFEST" \
  --release
popd >/dev/null

for abi in arm64-v8a x86_64; do
  LIBRARY="$OUTPUT_DIR/$abi/libconxius_silent_payments_jni.so"
  [[ -s "$LIBRARY" ]] || fail "cargo-ndk completed without required $abi library at $LIBRARY"
done

printf 'Verified required native libraries: arm64-v8a and x86_64\n'
