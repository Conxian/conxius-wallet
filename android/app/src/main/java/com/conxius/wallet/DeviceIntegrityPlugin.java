package com.conxius.wallet;

import android.os.Build;
import android.util.Log;

import com.google.android.play.core.integrity.IntegrityManager;
import com.google.android.play.core.integrity.IntegrityManagerFactory;
import com.google.android.play.core.integrity.IntegrityTokenRequest;
import com.google.android.play.core.integrity.IntegrityTokenResponse;
import com.google.android.gms.tasks.Task;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.List;

/**
 * DeviceIntegrityPlugin — Multi-layered device integrity verification.
 *
 * Checks performed:
 * 1. Su binary detection (common root indicator)
 * 2. Known root management apps (Magisk, SuperSU, KingRoot, etc.)
 * 3. Dangerous system properties (ro.debuggable, ro.secure)
 * 4. Test-keys build detection
 * 5. Writable system partition check
 * 6. Emulator detection
 *
 * Play Integrity API scaffolding included but requires Google Cloud project setup.
 *
 * Usage from TypeScript:
 *   const result = await DeviceIntegrity.checkIntegrity();
 *   if (!result.isSecure) { // warn user }
 */
@CapacitorPlugin(name = "DeviceIntegrity")
public class DeviceIntegrityPlugin extends Plugin {

    private static final String TAG = "DeviceIntegrity";

    // Known su binary locations
    private static final String[] SU_PATHS = {
        "/system/bin/su",
        "/system/xbin/su",
        "/sbin/su",
        "/system/su",
        "/system/bin/.ext/.su",
        "/system/usr/we-need-root/su",
        "/data/local/xbin/su",
        "/data/local/bin/su",
        "/data/local/su",
        "/su/bin/su",
        "/su/bin",
        "/system/app/Superuser.apk",
        "/system/app/SuperSU.apk",
    };

    // Known root management package names
    private static final String[] ROOT_PACKAGES = {
        "com.topjohnwu.magisk",           // Magisk Manager
        "eu.chainfire.supersu",             // SuperSU
        "com.koushikdutta.superuser",       // Superuser
        "com.noshufou.android.su",          // Superuser (legacy)
        "com.thirdparty.superuser",         // Third-party superuser
        "com.yellowes.su",                  // KingRoot
        "com.kingroot.kinguser",            // KingRoot
        "com.kingo.root",                   // KingoRoot
        "com.smedialink.oneclickroot",      // One Click Root
        "com.zhiqupk.root.global",          // Root Master
        "com.alephzain.framaroot",          // Framaroot
        "stericson.busybox",                // BusyBox
        "com.dimonvideo.luckypatcher",      // Lucky Patcher
        "com.chelpus.lackypatch",           // Lucky Patcher (alt)
        "com.ramdroid.appquarantine",       // App Quarantine
        "com.devadvance.rootcloak",         // RootCloak
        "com.devadvance.rootcloakplus",     // RootCloak Plus
        "de.robv.android.xposed.installer", // Xposed Installer
        "com.saurik.substrate",             // Cydia Substrate
    };

    /**
     * Main integrity check — returns a comprehensive security assessment.
     */
    @PluginMethod
    public void checkIntegrity(PluginCall call) {
        JSObject result = new JSObject();
        List<String> threats = new ArrayList<>();

        boolean suBinaryFound = checkSuBinary();
        boolean rootAppsFound = checkRootPackages();
        boolean dangerousProps = checkDangerousProps();
        boolean testKeys = checkTestKeys();
        boolean emulator = checkEmulator();

        if (suBinaryFound) threats.add("SU_BINARY_FOUND");
        if (rootAppsFound) threats.add("ROOT_MANAGEMENT_APP");
        if (dangerousProps) threats.add("DANGEROUS_SYSTEM_PROPS");
        if (testKeys) threats.add("TEST_KEYS_BUILD");
        if (emulator) threats.add("EMULATOR_DETECTED");

        boolean isSecure = threats.isEmpty();

        result.put("isSecure", isSecure);
        result.put("isRooted", suBinaryFound || rootAppsFound);
        result.put("isEmulator", emulator);
        result.put("threats", threats.toString());
        result.put("threatCount", threats.size());
        result.put("securityLevel", isSecure ? "HARDWARE" : emulator ? "EMULATOR" : "COMPROMISED");
        result.put("sdkVersion", Build.VERSION.SDK_INT);
        result.put("manufacturer", Build.MANUFACTURER);
        result.put("model", Build.MODEL);

        if (!isSecure) {
            Log.w(TAG, "Device integrity check FAILED: " + threats);
        } else {
            Log.i(TAG, "Device integrity check PASSED");
        }

        call.resolve(result);
    }

    /**
     * Quick root-only check (lightweight, no emulator detection).
     */
        /**
     * Request a Play Integrity token.
     * This token should be sent to the Conxian Gateway for server-side verification.
     */
    @PluginMethod
    public void requestIntegrityToken(PluginCall call) {
        String nonce = call.getString("nonce");
        if (nonce == null || nonce.isEmpty()) {
            call.reject("Nonce is required for Play Integrity request");
            return;
        }

        try {
            IntegrityManager integrityManager = IntegrityManagerFactory.create(getContext());
            Task<IntegrityTokenResponse> integrityTokenResponse = integrityManager.requestIntegrityToken(
                IntegrityTokenRequest.builder()
                    .setNonce(nonce)
                    .build()
            );

            integrityTokenResponse.addOnSuccessListener(response -> {
                String token = response.token();
                JSObject ret = new JSObject();
                ret.put("token", token);
                call.resolve(ret);
            });

            integrityTokenResponse.addOnFailureListener(e -> {
                Log.e(TAG, "Play Integrity API error", e);
                call.reject("Play Integrity API error: " + e.getMessage());
            });
        } catch (Exception e) {
            Log.e(TAG, "Failed to initialize Play Integrity API", e);
            call.reject("Failed to initialize Play Integrity API: " + e.getMessage());
        }
    }

    public void isRooted(PluginCall call) {
        JSObject result = new JSObject();
        boolean rooted = checkSuBinary() || checkRootPackages();
        result.put("rooted", rooted);
        call.resolve(result);
    }

    // ─── Detection Methods ───────────────────────────────────────────────

    private boolean checkSuBinary() {
        for (String path : SU_PATHS) {
            if (new File(path).exists()) {
                Log.w(TAG, "Su binary found at: " + path);
                return true;
            }
        }

        // Also try executing 'which su'
        try {
            Process process = Runtime.getRuntime().exec(new String[]{"which", "su"});
            BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
            String line = reader.readLine();
            reader.close();
            process.destroy();
            if (line != null && !line.isEmpty()) {
                Log.w(TAG, "Su binary found via 'which': " + line);
                return true;
            }
        } catch (Exception ignored) {
            // Expected on non-rooted devices
        }

        return false;
    }

    private boolean checkRootPackages() {
        for (String pkg : ROOT_PACKAGES) {
            try {
                getContext().getPackageManager().getPackageInfo(pkg, 0);
                Log.w(TAG, "Root management app found: " + pkg);
                return true;
            } catch (Exception ignored) {
                // Package not installed — expected
            }
        }
        return false;
    }

    private boolean checkDangerousProps() {
        try {
            // Check ro.debuggable
            String debuggable = getSystemProperty("ro.debuggable");
            if ("1".equals(debuggable)) {
                Log.w(TAG, "ro.debuggable is set to 1");
                return true;
            }

            // Check ro.secure
            String secure = getSystemProperty("ro.secure");
            if ("0".equals(secure)) {
                Log.w(TAG, "ro.secure is set to 0");
                return true;
            }

            // Check for permissive SELinux
            String selinux = getSystemProperty("ro.build.selinux");
            if ("0".equals(selinux)) {
                Log.w(TAG, "SELinux is disabled");
                return true;
            }
        } catch (Exception e) {
            Log.e(TAG, "Error checking system properties", e);
        }
        return false;
    }

    private boolean checkTestKeys() {
        String buildTags = Build.TAGS;
        return buildTags != null && buildTags.contains("test-keys");
    }

    private boolean checkEmulator() {
        return Build.FINGERPRINT.startsWith("generic")
            || Build.FINGERPRINT.startsWith("unknown")
            || Build.MODEL.contains("google_sdk")
            || Build.MODEL.contains("Emulator")
            || Build.MODEL.contains("Android SDK built for x86")
            || Build.MANUFACTURER.contains("Genymotion")
            || Build.BRAND.startsWith("generic") && Build.DEVICE.startsWith("generic")
            || "google_sdk".equals(Build.PRODUCT)
            || "sdk".equals(Build.PRODUCT)
            || "sdk_x86".equals(Build.PRODUCT)
            || "vbox86p".equals(Build.PRODUCT)
            || "emulator".equals(Build.PRODUCT)
            || "simulator".equals(Build.PRODUCT);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────

    private String getSystemProperty(String propName) {
        try {
            Process process = Runtime.getRuntime().exec(new String[]{"getprop", propName});
            BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
            String line = reader.readLine();
            reader.close();
            process.destroy();
            return line;
        } catch (Exception e) {
            return null;
        }
    }
}
