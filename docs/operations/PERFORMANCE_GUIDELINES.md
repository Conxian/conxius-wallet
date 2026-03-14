---
title: Performance Guidelines
layout: page
permalink: /./operations/PERFORMANCE_GUIDELINES
---

# Conxius Wallet: Performance & Resource Optimization

## 1. Memory Management Best Practices
To ensure the wallet remains responsive on low-end devices (2GB-4GB RAM), follow these guidelines:

### Prevent Context Leaks
* **ViewModels:** Never store Activity or View references in a ViewModel. Use `AndroidViewModel` only if `Application` context is absolutely necessary.
* **Coroutines:** Always use `viewModelScope` or `lifecycleScope` to ensure background tasks are cancelled when the component is destroyed.
* **Singletons:** Be cautious with singletons that hold listeners. Use `WeakReference` or ensure listeners are un-registered in `onStop()`/`onDestroy()`.

### Bitmaps and Drawables
* Use **Vector Assets (SVG/XML)** wherever possible to reduce memory footprint and maintain sharpness across densities.
* For raster images, use `Glide` or `Coil` with `crossfade(true)` and appropriate `size()` overrides to avoid loading full-resolution images into memory.

## 2. Resource Optimization
* **APK Splitting:** Use Android App Bundles (.aab) to ensure users only download resources (languages, densities) relevant to their device.
* **R8/ProGuard:** Maintain strict ProGuard rules for cryptographic libraries (like BouncyCastle) to prune unused code without breaking reflection.

## 3. Profiling in Windsurf / Android Studio
Perform these checks regularly during development:

### Memory Profiling
* **LeakCanary:** Integrated in `debug` builds to automatically detect and report memory leaks.
* **Heap Dump Analysis:** Use the Android Profiler to capture heap dumps. Look for multiple instances of `Activity` or large `ByteArray` allocations that aren't being cleared.

### Energy & CPU Profiling
* **System Trace:** Monitor the Main Thread (UI Thread) for "Jank". Ensure cryptographic operations (PBKDF2, signing) never run on the Main Thread.
* **Network Inspector:** Minimize background polling. Use WebSockets or Push Notifications for balance updates to save battery.

## 4. Specific Checks for Crypto Wallets
* **Key Zeroing:** Verify that `StrongBoxManager` and `BdkManager` are zeroing out `ByteArray` secrets immediately after use using `Arrays.fill(data, 0)`.
* **Database Queries:** Use `EXPLAIN QUERY PLAN` on Room/SQLCipher queries to ensure indexes are used for transaction history lookups.
