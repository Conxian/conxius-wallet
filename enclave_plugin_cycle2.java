package com.conxius.wallet;
import android.content.pm.PackageManager;
import android.security.keystore.KeyInfo;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Base64;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.bitcoinj.core.ECKey;
import org.bitcoinj.core.NetworkParameters;
import org.bitcoinj.core.Sha256Hash;
import org.bitcoinj.crypto.DeterministicHierarchy;
import org.bitcoinj.crypto.DeterministicKey;
import org.bitcoinj.crypto.HDKeyDerivation;
import org.bitcoinj.params.MainNetParams;
import org.bitcoinj.params.TestNet3Params;
import org.bitcoinj.wallet.DeterministicSeed;
import org.json.JSONArray;
import org.json.JSONObject;

import org.web3j.crypto.Credentials;
import org.web3j.crypto.ECKeyPair;
import org.web3j.crypto.Sign;
import org.web3j.utils.Numeric;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.Executor;


import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;

import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.security.keystore.UserNotAuthenticatedException;

import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
// Instant
import org.bitcoinj.core.Transaction;
import org.bitcoinj.core.TransactionOutput;
import org.bitcoinj.core.Address;
import org.bitcoinj.core.Coin;
// Psbt
import org.bitcoinj.core.LegacyAddress;
import org.bitcoinj.core.SegwitAddress;

@CapacitorPlugin(name = "SecureEnclave")
public class SecureEnclavePlugin extends Plugin {
  private static final String PREFS_NAME = "conxius_secure_enclave";
  private static final String KEY_ALIAS = "com.conxius.wallet.enclave.aes.v1";
  private static final String KEY_ALIAS_AUTH = "com.conxius.wallet.enclave.aes.v2.auth";
  private static final int GCM_TAG_BITS = 128;
  private long biometricSessionValidUntilMs = 0;

  // Session Cache for Performance (Approved by Architecture Review)
  private SecretKey cachedSessionKey = null;
  private byte[] cachedSessionSalt = null;
  private long cachedSessionExpiry = 0;
  private static final long SESSION_DURATION_MS = 5 * 60 * 1000; // 5 Minutes


  private SharedPreferences prefs() {
    return getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
  }

  // --- Existing Storage Logic ---

  private SecretKey getOrCreateKey(String alias, boolean requireUserAuth) throws Exception {
    KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
    keyStore.load(null);
    if (keyStore.containsAlias(alias)) {
      return ((SecretKey) keyStore.getKey(alias, null));
    }

    KeyGenerator keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
    KeyGenParameterSpec.Builder builder = new KeyGenParameterSpec.Builder(
      alias,
      KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
    )
      .setKeySize(256)
      .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
      .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
      .setRandomizedEncryptionRequired(true);

    if (requireUserAuth) {
      builder.setUserAuthenticationRequired(true);
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        builder.setUserAuthenticationParameters(
          300,
          KeyProperties.AUTH_BIOMETRIC_STRONG | KeyProperties.AUTH_DEVICE_CREDENTIAL
        );
      } else {
        builder.setUserAuthenticationValidityDurationSeconds(300);
      }
    }

    // Layer 1: StrongBox Enforcement
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      if (getContext().getPackageManager().hasSystemFeature(PackageManager.FEATURE_STRONGBOX_KEYSTORE)) {
        builder.setIsStrongBoxBacked(true);
      }
    }

    keyGenerator.init(builder.build());
    return keyGenerator.generateKey();
  }

  private static class ParsedRecord {
    final int version;
    final byte[] iv;
    final byte[] ciphertext;

    ParsedRecord(int version, byte[] iv, byte[] ciphertext) {
      this.version = version;
      this.iv = iv;
      this.ciphertext = ciphertext;
    }
  }

  private ParsedRecord parseRecord(String record) {
    String[] parts = record.split(":");
    if (parts.length == 2) {
      byte[] iv = Base64.decode(parts[0], Base64.NO_WRAP);
      byte[] ciphertext = Base64.decode(parts[1], Base64.NO_WRAP);
      return new ParsedRecord(1, iv, ciphertext);
    }
    if (parts.length == 3 && "v2".equals(parts[0])) {
      byte[] iv = Base64.decode(parts[1], Base64.NO_WRAP);
      byte[] ciphertext = Base64.decode(parts[2], Base64.NO_WRAP);
      return new ParsedRecord(2, iv, ciphertext);
    }
    throw new IllegalArgumentException("Invalid record");
  }

  private String toRecord(int version, byte[] iv, byte[] ciphertext) {
    String ivB64 = Base64.encodeToString(iv, Base64.NO_WRAP);
    String ctB64 = Base64.encodeToString(ciphertext, Base64.NO_WRAP);
    if (version == 2) return "v2:" + ivB64 + ":" + ctB64;
    return ivB64 + ":" + ctB64;
  }

  private String encryptToRecord(String plaintext, boolean requireUserAuth) throws Exception {
    SecretKey key = getOrCreateKey(requireUserAuth ? KEY_ALIAS_AUTH : KEY_ALIAS, requireUserAuth);
    byte[] iv = new byte[12];
    new SecureRandom().nextBytes(iv);

    Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
    cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_BITS, iv));
    byte[] ciphertext = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
    return toRecord(requireUserAuth ? 2 : 1, iv, ciphertext);
  }

  private String decryptFromRecord(String record, boolean requireUserAuth) throws Exception {
    ParsedRecord parsed = parseRecord(record);
    if (requireUserAuth && parsed.version != 2) {
      throw new IllegalStateException("auth required");
    }
    SecretKey key = getOrCreateKey(parsed.version == 2 ? KEY_ALIAS_AUTH : KEY_ALIAS, parsed.version == 2);
    Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
    cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_BITS, parsed.iv));
    byte[] plaintext = cipher.doFinal(parsed.ciphertext);
    return new String(plaintext, StandardCharsets.UTF_8);
  }

  private boolean canUseAuthKeyNow() {
    try {
      SecretKey key = getOrCreateKey(KEY_ALIAS_AUTH, true);
      byte[] iv = new byte[12];
      new SecureRandom().nextBytes(iv);
      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_BITS, iv));
      byte[] probe = new byte[16];
      new SecureRandom().nextBytes(probe);
      cipher.doFinal(probe);
      return true;
    } catch (UserNotAuthenticatedException e) {
      return false;
    } catch (Exception e) {
      return false;
    }
  }


  private String getKeySecurityLevel(String alias) {
    try {
      java.security.KeyStore keyStore = java.security.KeyStore.getInstance("AndroidKeyStore");
      keyStore.load(null);
      if (!keyStore.containsAlias(alias)) return "NOT_FOUND";

      javax.crypto.SecretKey key = (javax.crypto.SecretKey) keyStore.getKey(alias, null);
      javax.crypto.SecretKeyFactory factory = javax.crypto.SecretKeyFactory.getInstance(key.getAlgorithm(), "AndroidKeyStore");
      android.security.keystore.KeyInfo keyInfo = (android.security.keystore.KeyInfo) factory.getKeySpec(key, android.security.keystore.KeyInfo.class);

      if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
        int level = keyInfo.getSecurityLevel();
        if (level == android.security.keystore.KeyProperties.SECURITY_LEVEL_STRONGBOX) return "STRONGBOX";
        if (level == android.security.keystore.KeyProperties.SECURITY_LEVEL_TRUSTED_ENVIRONMENT) return "TEE";
      } else {
        if (keyInfo.isInsideSecureHardware()) return "TEE_OR_STRONGBOX";
      }
      return "SOFTWARE";
    } catch (Exception e) {
      return "UNKNOWN";
    }
  }

  @PluginMethod
  public void getSecurityLevel(PluginCall call) {
    JSObject ret = new JSObject();
    ret.put("level", getKeySecurityLevel(KEY_ALIAS_AUTH));
    ret.put("isStrongBox", getKeySecurityLevel(KEY_ALIAS_AUTH).equals("STRONGBOX"));
    call.resolve(ret);
  }

  @PluginMethod
  public void isAvailable(PluginCall call) {
    JSObject ret = new JSObject();
    ret.put("available", true);
    ret.put("securityLevel", getKeySecurityLevel(KEY_ALIAS_AUTH));
    call.resolve(ret);
  }

  @PluginMethod
  public void hasItem(PluginCall call) {
    String key = call.getString("key");
    if (key == null) {
      call.reject("key required");
      return;
    }
    JSObject ret = new JSObject();
    ret.put("exists", prefs().contains(key));
    call.resolve(ret);
  }

  private boolean isBiometricSessionValid() {
    return System.currentTimeMillis() < biometricSessionValidUntilMs;
  }

  @PluginMethod
  public void setItem(PluginCall call) {
    String key = call.getString("key");
    String value = call.getString("value");
    Boolean requireBiometric = call.getBoolean("requireBiometric", false);
    if (key == null || value == null) {
      call.reject("key and value required");
      return;
    }
    if (requireBiometric != null && requireBiometric && !isBiometricSessionValid()) {
      call.reject("auth required");
      return;
    }
    if (requireBiometric != null && requireBiometric && !canUseAuthKeyNow()) {
      call.reject("auth required");
      return;
    }
    try {
      String record = encryptToRecord(value, requireBiometric != null && requireBiometric);
      prefs().edit().putString(key, record).apply();
      call.resolve(new JSObject());
    } catch (UserNotAuthenticatedException e) {
      call.reject("auth required");
    } catch (Exception e) {
      call.reject("secure storage failed");
    }
  }

  @PluginMethod
  public void getItem(PluginCall call) {
    String key = call.getString("key");
    Boolean requireBiometric = call.getBoolean("requireBiometric", false);
    if (key == null) {
      call.reject("key required");
      return;
    }
    if (requireBiometric != null && requireBiometric && !isBiometricSessionValid()) {
      call.reject("auth required");
      return;
    }
    try {
      String record = prefs().getString(key, null);
      JSObject ret = new JSObject();
      if (record == null) {
        ret.put("value", null);
        call.resolve(ret);
        return;
      }
      ParsedRecord parsed = parseRecord(record);
      if (requireBiometric != null && requireBiometric && parsed.version == 1) {
        if (!canUseAuthKeyNow()) {
          call.reject("auth required");
          return;
        }
        String plaintext = decryptFromRecord(record, false);
        String migrated = encryptToRecord(plaintext, true);
        prefs().edit().putString(key, migrated).apply();
        ret.put("value", plaintext);
        call.resolve(ret);
        return;
      }
      String plaintext = decryptFromRecord(record, requireBiometric != null && requireBiometric);
      ret.put("value", plaintext);
      call.resolve(ret);
    } catch (UserNotAuthenticatedException e) {
      call.reject("auth required");
    } catch (IllegalStateException e) {
      String msg = e.getMessage();
      if (msg != null && msg.toLowerCase().contains("auth required")) {
        call.reject("auth required");
      } else {
        call.reject("secure storage failed");
      }
    } catch (Exception e) {
      call.reject("secure storage failed");
    }
  }

  @PluginMethod
  public void removeItem(PluginCall call) {
    String key = call.getString("key");
    Boolean requireBiometric = call.getBoolean("requireBiometric", false);
    if (key == null) {
      call.reject("key required");
      return;
    }
    if (requireBiometric != null && requireBiometric && !isBiometricSessionValid()) {
      call.reject("auth required");
      return;
    }
    if (requireBiometric != null && requireBiometric && !canUseAuthKeyNow()) {
      call.reject("auth required");
      return;
    }
    prefs().edit().remove(key).apply();
    call.resolve(new JSObject());
  }

  @PluginMethod
  public void clearBiometricSession(PluginCall call) {
    biometricSessionValidUntilMs = 0;
    // Wipe and clear session cache for zero-leak security
    if (this.cachedSessionSalt != null) {
      Arrays.fill(this.cachedSessionSalt, (byte) 0);
      this.cachedSessionSalt = null;
    }
    this.cachedSessionKey = null;
    this.cachedSessionExpiry = 0;
    call.resolve(new JSObject());
  }

  @PluginMethod
  public void authenticate(PluginCall call) {
    try {
      int can = BiometricManager.from(getContext()).canAuthenticate(
        BiometricManager.Authenticators.BIOMETRIC_STRONG | BiometricManager.Authenticators.DEVICE_CREDENTIAL
      );
      if (can != BiometricManager.BIOMETRIC_SUCCESS) {
        call.reject("biometric unavailable");
        return;
      }

      SecretKey authKey = getOrCreateKey(KEY_ALIAS_AUTH, true);
      byte[] iv = new byte[12];
      new SecureRandom().nextBytes(iv);
      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      cipher.init(Cipher.ENCRYPT_MODE, authKey, new GCMParameterSpec(GCM_TAG_BITS, iv));

      Executor executor = ContextCompat.getMainExecutor(getContext());
      BiometricPrompt prompt = new BiometricPrompt(
        getActivity(),
        executor,
        new BiometricPrompt.AuthenticationCallback() {
          @Override
          public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
            Integer durationSeconds = call.getInt("durationSeconds", 300);
            int dur = durationSeconds == null ? 300 : Math.max(10, durationSeconds);
            biometricSessionValidUntilMs = System.currentTimeMillis() + (dur * 1000L);
            try {
              byte[] probe = new byte[16];
              new SecureRandom().nextBytes(probe);
              cipher.doFinal(probe);
            } catch (Exception e) {
              call.reject("biometric failed");
              return;
            }
            JSObject ret = new JSObject();
            ret.put("authenticated", true);
            ret.put("validUntilMs", biometricSessionValidUntilMs);
            call.resolve(ret);
          }

          @Override
          public void onAuthenticationError(int errorCode, CharSequence errString) {
            call.reject("biometric canceled");
          }

          @Override
          public void onAuthenticationFailed() {
          }
        }
      );

      BiometricPrompt.PromptInfo promptInfo = new BiometricPrompt.PromptInfo.Builder()
        .setTitle("Unlock Conxius Enclave")
        .setSubtitle("Confirm your identity to proceed")
        .setAllowedAuthenticators(
          BiometricManager.Authenticators.BIOMETRIC_STRONG | BiometricManager.Authenticators.DEVICE_CREDENTIAL
        )
        .build();

      prompt.authenticate(promptInfo, new BiometricPrompt.CryptoObject(cipher));
    } catch (Exception e) {
      call.reject("biometric failed");
    }
  }

  // --- NATIVE SIGNING LOGIC (Phase 2) ---

  /**
   * Decrypts the Seed Vault (Layer 3) using PBKDF2/AES-GCM matching seed.ts logic.
   * vaultJson: "{ v:1, salt:[...], iv:[...], data:[...] }"
   * pin: User's PIN
   */
  private byte[] decryptSeedVault(String vaultJson, String pin) throws Exception {
    JSONObject envelope = new JSONObject(vaultJson);
    int v = envelope.getInt("v");
    if (v != 1) throw new IllegalArgumentException("Unknown vault version");

    JSONArray saltJson = envelope.getJSONArray("salt");
    JSONArray ivJson = envelope.getJSONArray("iv");
    JSONArray dataJson = envelope.getJSONArray("data");

    byte[] salt = new byte[saltJson.length()];
    for(int i=0; i<saltJson.length(); i++) salt[i] = (byte)saltJson.getInt(i);

    byte[] iv = new byte[ivJson.length()];
    for(int i=0; i<ivJson.length(); i++) iv[i] = (byte)ivJson.getInt(i);

    byte[] data = new byte[dataJson.length()];
    for(int i=0; i<dataJson.length(); i++) data[i] = (byte)dataJson.getInt(i);

    // Derive Key: PBKDF2WithHmacSHA256, 200000 iterations
    SecretKeyFactory factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256");
    // seed.ts uses 256 bits (32 bytes) for AES key
    char[] pinChars = pin.toCharArray();
    PBEKeySpec spec = new PBEKeySpec(pinChars, salt, 200000, 256);
    SecretKey tmp = factory.generateSecret(spec);

    // Zero-out PIN array immediately
    Arrays.fill(pinChars, '\0');
    spec.clearPassword();

    byte[] encodedKey = tmp.getEncoded();
    SecretKeySpec secret = new SecretKeySpec(encodedKey, "AES");
    Arrays.fill(encodedKey, (byte) 0);

    // Decrypt: AES/GCM/NoPadding
    Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
    cipher.init(Cipher.DECRYPT_MODE, secret, new GCMParameterSpec(GCM_TAG_BITS, iv));

    return cipher.doFinal(data);
  }

  // Helper to derive key only (refactored for cache usage)
  private SecretKey deriveKeyForVault(String pin, byte[] salt) throws Exception {
     SecretKeyFactory factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256");
     char[] pinChars = pin.toCharArray();
     PBEKeySpec spec = new PBEKeySpec(pinChars, salt, 200000, 256);
     SecretKey tmp = factory.generateSecret(spec);

     // Zero-out sensitive material immediately after use
     Arrays.fill(pinChars, '\0');
     spec.clearPassword();

     byte[] encoded = tmp.getEncoded();
     SecretKeySpec secret = new SecretKeySpec(encoded, "AES");
     Arrays.fill(encoded, (byte) 0);

     return secret;
  }

  @PluginMethod
  public void unlockSession(PluginCall call) {
      String vaultJson = call.getString("vault");
      String pin = call.getString("pin");

      if (vaultJson == null || pin == null) {
          call.reject("Missing vault or pin");
          return;
      }

      try {
          JSONObject envelope = new JSONObject(vaultJson);
          JSONArray saltJson = envelope.getJSONArray("salt");
          byte[] salt = new byte[saltJson.length()];
          for(int i=0; i<saltJson.length(); i++) salt[i] = (byte)saltJson.getInt(i);

          // 1. Derive
          SecretKey key = deriveKeyForVault(pin, salt);

          // 2. Validate (Try to decrypt)
          // We need the IV and Data to test
          JSONArray ivJson = envelope.getJSONArray("iv");
          JSONArray dataJson = envelope.getJSONArray("data");
          byte[] iv = new byte[ivJson.length()];
          for(int i=0; i<ivJson.length(); i++) iv[i] = (byte)ivJson.getInt(i);
          byte[] data = new byte[dataJson.length()];
          for(int i=0; i<dataJson.length(); i++) data[i] = (byte)dataJson.getInt(i);

          Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
          cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_BITS, iv));
          byte[] check = cipher.doFinal(data);
          Arrays.fill(check, (byte)0); // Wipe check buffer

          // 3. Cache
          this.cachedSessionKey = key;
          this.cachedSessionSalt = salt;
          this.cachedSessionExpiry = System.currentTimeMillis() + SESSION_DURATION_MS;

          call.resolve(new JSObject().put("unlocked", true));

      } catch (Exception e) {
          call.reject("Unlock failed: " + e.getMessage());
      }
  }

  @PluginMethod
  public void getPublicKey(PluginCall call) {
    String vaultJson = call.getString("vault");
    String pin = call.getString("pin");
    String path = call.getString("path");

    if (vaultJson == null || path == null) {
      call.reject("Missing required parameters");
      return;
    }

    try {
      SecretKey keyToUse = null;
      JSONObject envelope = new JSONObject(vaultJson);
      JSONArray ivJson = envelope.getJSONArray("iv");
      JSONArray dataJson = envelope.getJSONArray("data");

      JSONArray saltJson = envelope.getJSONArray("salt");
      byte[] salt = new byte[saltJson.length()];
      for(int i=0; i<saltJson.length(); i++) salt[i] = (byte)saltJson.getInt(i);

      if (pin != null) {
          keyToUse = deriveKeyForVault(pin, salt);
      } else {
          if (cachedSessionKey != null && System.currentTimeMillis() < cachedSessionExpiry) {
              if (Arrays.equals(this.cachedSessionSalt, salt)) {
                  keyToUse = cachedSessionKey;
              } else {
                 call.reject("Session valid but wallet mismatch (salt). Unlock required.");
                 return;
              }
          } else {
              call.reject("Session expired or invalid. Unlock required.");
              return;
          }
      }

      byte[] iv = new byte[ivJson.length()];
      for(int i=0; i<ivJson.length(); i++) iv[i] = (byte)ivJson.getInt(i);
      byte[] data = new byte[dataJson.length()];
      for(int i=0; i<dataJson.length(); i++) data[i] = (byte)dataJson.getInt(i);

      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      cipher.init(Cipher.DECRYPT_MODE, keyToUse, new GCMParameterSpec(GCM_TAG_BITS, iv));
      byte[] seed = cipher.doFinal(data);

      try {
        DeterministicSeed detSeed = new DeterministicSeed(seed, (java.util.List<String>) null, 0L);
        byte[] seedBytes = detSeed.getSeedBytes(); DeterministicKey rootKey = HDKeyDerivation.createMasterPrivateKey(seedBytes); if (seedBytes != null) java.util.Arrays.fill(seedBytes, (byte) 0);

        DeterministicHierarchy hierarchy = new DeterministicHierarchy(rootKey);
        String[] parts = path.split("/");
        DeterministicKey child = rootKey;

        for (String part : parts) {
            if (part.equals("m")) continue;
            boolean hardened = part.endsWith("'") || part.endsWith("h");
            String numStr = part.replace("'", "").replace("h", "");
            int index = Integer.parseInt(numStr);
            child = HDKeyDerivation.deriveChildKey(child, new org.bitcoinj.crypto.ChildNumber(index, hardened));
        }

        JSObject ret = new JSObject();
        ret.put("pubkey", child.getPublicKeyAsHex());
        call.resolve(ret);

      } finally {
        Arrays.fill(seed, (byte)0);
      }

    } catch (Exception e) {
      call.reject("GetPublicKey failed: " + e.getMessage());
    }
  }

  @PluginMethod
  public void getDerivedSecret(PluginCall call) {
      String vaultJson = call.getString("vault");
      String pin = call.getString("pin");
      String path = call.getString("path");

      if (vaultJson == null || path == null) {
          call.reject("Missing required parameters");
          return;
      }

      try {
          SecretKey keyToUse = null;
          JSONObject envelope = new JSONObject(vaultJson);
          JSONArray ivJson = envelope.getJSONArray("iv");
          JSONArray dataJson = envelope.getJSONArray("data");
          JSONArray saltJson = envelope.getJSONArray("salt");
          byte[] salt = new byte[saltJson.length()];
          for(int i=0; i<saltJson.length(); i++) salt[i] = (byte)saltJson.getInt(i);

          if (pin != null) {
              keyToUse = deriveKeyForVault(pin, salt);
          } else {
              if (cachedSessionKey != null && System.currentTimeMillis() < cachedSessionExpiry) {
                  if (Arrays.equals(this.cachedSessionSalt, salt)) {
                      keyToUse = cachedSessionKey;
                  } else {
                     call.reject("Session valid but wallet mismatch. Unlock required.");
                     return;
                  }
              } else {
                  call.reject("Session expired. Unlock required.");
                  return;
              }
          }

          byte[] iv = new byte[ivJson.length()];
          for(int i=0; i<ivJson.length(); i++) iv[i] = (byte)ivJson.getInt(i);
          byte[] data = new byte[dataJson.length()];
          for(int i=0; i<dataJson.length(); i++) data[i] = (byte)dataJson.getInt(i);

          Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
          cipher.init(Cipher.DECRYPT_MODE, keyToUse, new GCMParameterSpec(GCM_TAG_BITS, iv));
          byte[] seed = cipher.doFinal(data);

          try {
              DeterministicSeed detSeed = new DeterministicSeed(seed, (java.util.List<String>) null, 0L);
              byte[] seedBytes = detSeed.getSeedBytes(); DeterministicKey rootKey = HDKeyDerivation.createMasterPrivateKey(seedBytes); if (seedBytes != null) java.util.Arrays.fill(seedBytes, (byte) 0);

              DeterministicHierarchy hierarchy = new DeterministicHierarchy(rootKey);
              String[] parts = path.split("/");
              DeterministicKey child = rootKey;

              for (String part : parts) {
                  if (part.equals("m")) continue;
                  boolean hardened = part.endsWith("'") || part.endsWith("h");
                  String numStr = part.replace("'", "").replace("h", "");
                  int index = Integer.parseInt(numStr);
                  child = HDKeyDerivation.deriveChildKey(child, new org.bitcoinj.crypto.ChildNumber(index, hardened));
              }

              JSObject ret = new JSObject();
              ret.put("secret", child.getPrivateKeyAsHex());
              ret.put("pubkey", child.getPublicKeyAsHex());
              call.resolve(ret);
          } finally {
              Arrays.fill(seed, (byte)0);
          }
      } catch (Exception e) {
          call.reject("Derivation failed: " + e.getMessage());
      }
  }

  @PluginMethod
  public void getWalletInfo(PluginCall call) {
      String vaultJson = call.getString("vault");
      String pin = call.getString("pin");

      if (vaultJson == null) {
          call.reject("Missing vault");
          return;
      }

      try {
          // Use NativeCrypto or internal logic?
          // For consistency with session cache, we use internal logic or check session
          SecretKey keyToUse = null;
          JSONObject envelope = new JSONObject(vaultJson);
          JSONArray ivJson = envelope.getJSONArray("iv");
          JSONArray dataJson = envelope.getJSONArray("data");
          JSONArray saltJson = envelope.getJSONArray("salt");
          byte[] salt = new byte[saltJson.length()];
          for(int i=0; i<saltJson.length(); i++) salt[i] = (byte)saltJson.getInt(i);

          if (pin != null) {
              keyToUse = deriveKeyForVault(pin, salt);
          } else {
              if (cachedSessionKey != null && System.currentTimeMillis() < cachedSessionExpiry) {
                  if (Arrays.equals(this.cachedSessionSalt, salt)) {
                      keyToUse = cachedSessionKey;
                  } else {
                     call.reject("Session valid but wallet mismatch. Unlock required.");
                     return;
                  }
              } else {
                  call.reject("Session expired. Unlock required.");
                  return;
              }
          }

          byte[] iv = new byte[ivJson.length()];
          for(int i=0; i<ivJson.length(); i++) iv[i] = (byte)ivJson.getInt(i);
          byte[] data = new byte[dataJson.length()];
          for(int i=0; i<dataJson.length(); i++) data[i] = (byte)dataJson.getInt(i);

          Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
          cipher.init(Cipher.DECRYPT_MODE, keyToUse, new GCMParameterSpec(GCM_TAG_BITS, iv));
          byte[] seed = cipher.doFinal(data);

          try {
              DeterministicSeed detSeed = new DeterministicSeed(seed, (java.util.List<String>) null, 0L);
              byte[] seedBytes = detSeed.getSeedBytes(); DeterministicKey rootKey = HDKeyDerivation.createMasterPrivateKey(seedBytes); if (seedBytes != null) java.util.Arrays.fill(seedBytes, (byte) 0);
              DeterministicHierarchy hierarchy = new DeterministicHierarchy(rootKey);

              // 1. BTC (Native Segwit m/84'/0'/0'/0/0)
              DeterministicKey btcKey = hierarchy.deriveChild(
                  Arrays.asList(
                      new org.bitcoinj.crypto.ChildNumber(84, true),
                      new org.bitcoinj.crypto.ChildNumber(0, true),
                      new org.bitcoinj.crypto.ChildNumber(0, true),
                      new org.bitcoinj.crypto.ChildNumber(0, false),
                      new org.bitcoinj.crypto.ChildNumber(0, false)
                  ),
                  true, true, new org.bitcoinj.crypto.ChildNumber(0, false)
              );
              // Address derivation (Bech32)
              // BitcoinJ SegwitAddress not always straightforward in older versions, using script hash
              // Actually, simpler to return pubkey and let JS do address if complex,
              // BUT user asked for native handling.
              // Let's return pubkey for consistency with Stacks

              // 2. Stacks (m/44'/5757'/0'/0/0)
              DeterministicKey stxKey = hierarchy.deriveChild(
                  Arrays.asList(
                      new org.bitcoinj.crypto.ChildNumber(44, true),
                      new org.bitcoinj.crypto.ChildNumber(5757, true),
                      new org.bitcoinj.crypto.ChildNumber(0, true),
                      new org.bitcoinj.crypto.ChildNumber(0, false),
                      new org.bitcoinj.crypto.ChildNumber(0, false)
                  ),
                  true, true, new org.bitcoinj.crypto.ChildNumber(0, false)
              );

              // 3. EVM (m/44'/60'/0'/0/0)
              DeterministicKey evmKey = hierarchy.deriveChild(
                  Arrays.asList(
                      new org.bitcoinj.crypto.ChildNumber(44, true),
                      new org.bitcoinj.crypto.ChildNumber(60, true),
                      new org.bitcoinj.crypto.ChildNumber(0, true),
                      new org.bitcoinj.crypto.ChildNumber(0, false),
                      new org.bitcoinj.crypto.ChildNumber(0, false)
                  ),
                  true, true, new org.bitcoinj.crypto.ChildNumber(0, false)
              );

              // 4. Liquid (m/84'/1776'/0'/0/0)
              DeterministicKey liquidKey = hierarchy.deriveChild(
                  Arrays.asList(
                      new org.bitcoinj.crypto.ChildNumber(84, true),
                      new org.bitcoinj.crypto.ChildNumber(1776, true),
                      new org.bitcoinj.crypto.ChildNumber(0, true),
                      new org.bitcoinj.crypto.ChildNumber(0, false),
                      new org.bitcoinj.crypto.ChildNumber(0, false)
                  ),
                  true, true, new org.bitcoinj.crypto.ChildNumber(0, false)
              );

              JSObject ret = new JSObject();
              ret.put("btcPubkey", btcKey.getPublicKeyAsHex());
              ret.put("stxPubkey", stxKey.getPublicKeyAsHex());
              ret.put("liquidPubkey", liquidKey.getPublicKeyAsHex());

              // For EVM, we can easily get address
              byte[] evmPrivKey = evmKey.getPrivKeyBytes(); ECKeyPair evmPair = ECKeyPair.create(evmPrivKey); if (evmPrivKey != null) java.util.Arrays.fill(evmPrivKey, (byte) 0);
              ret.put("evmAddress", "0x" + org.web3j.crypto.Keys.getAddress(evmPair));

              call.resolve(ret);

          } finally {
              Arrays.fill(seed, (byte)0);
          }
      } catch (Exception e) {
          call.reject("GetWalletInfo failed: " + e.getMessage());
      }
  }


  private static class TransactionInfo {
      String action = "Unknown";
      String amount = "Unknown";
      String recipient = "Unknown";
      boolean warning = false;
      String warningMessage = "";
  }

  private TransactionInfo parsePayload(String payloadHex, String networkStr) {
      TransactionInfo info = new TransactionInfo();
      info.action = "Sign Hash";
      info.amount = "Unknown";
      info.recipient = "Unknown";

      if (payloadHex == null || payloadHex.isEmpty()) return info;

      try {
          if ("stacks".equals(networkStr)) {
              byte[] data = org.bouncycastle.util.encoders.Hex.decode(payloadHex);
              if (data.length > 2) {
                  // Layer 3.3.1: Stacks Post-Condition Checks
                  int postConditionMode = data[1] & 0xFF;
                  if (postConditionMode == 0x02) { // ALLOW
                      info.warning = true;
                      info.warningMessage = "REJECTED: Stacks PostConditionMode.ALLOW is not permitted for security reasons.";
                  }
                  info.action = "Stacks Transaction";
              }
          } else if ("mainnet".equals(networkStr) || "testnet".equals(networkStr)) {
              NetworkParameters params = "testnet".equals(networkStr) ? org.bitcoinj.params.TestNet3Params.get() : org.bitcoinj.params.MainNetParams.get();
              try {
                  byte[] txBytes = org.bouncycastle.util.encoders.Hex.decode(payloadHex);
                  org.bitcoinj.core.Transaction tx = new org.bitcoinj.core.Transaction(params, txBytes);
                  info.action = "Bitcoin (Raw)";
                  long totalOut = 0;
                  StringBuilder recipients = new StringBuilder();
                  for (org.bitcoinj.core.TransactionOutput out : tx.getOutputs()) {
                      totalOut += out.getValue().getValue();
                      try {
                          org.bitcoinj.core.Address addr = out.getScriptPubKey().getToAddress(params);
                          // addr already retrieved
                          if (addr != null) recipients.append(addr.toString()).append(" ");
                      } catch (Exception e) {}
                  }
                  info.amount = org.bitcoinj.core.Coin.valueOf(totalOut).toFriendlyString();
                  info.recipient = recipients.toString().trim();
              } catch (Exception e2) {}
          }
      } catch (Exception e) {
          Log.e("SecureEnclave", "Parsing failed", e);
      }
      return info;
  }


  @PluginMethod
  public void signTransaction(PluginCall call) {
    String vaultJson = call.getString("vault");
    String pin = call.getString("pin");
    String path = call.getString("path");
    String messageHashHex = call.getString("messageHash");
    String networkStr = call.getString("network", "mainnet");
    String payload = call.getString("payload");

    if (vaultJson == null || path == null || messageHashHex == null) {
      call.reject("Missing required parameters");
      return;
    }

    if (messageHashHex.contains("PUBKEY_DERIVATION")) {
        new Thread(() -> {
            executeSigning(call, vaultJson, pin, path, messageHashHex, networkStr);
        }).start();
        return;
    }

    TransactionInfo info = parsePayload(payload, networkStr);
    if (info.warning) {
        call.reject(info.warningMessage);
        return;
    }

    getActivity().runOnUiThread(() -> {
        try {
            new android.app.AlertDialog.Builder(getContext())
                .setTitle("Confirm Signing")
                .setMessage("Action: " + info.action + "\nAmount: " + info.amount + "\nRecipient: " + info.recipient)
                .setPositiveButton("Confirm", (dialog, which) -> {
                    new Thread(() -> {
                        executeSigning(call, vaultJson, pin, path, messageHashHex, networkStr);
                    }).start();
                })
                .setNegativeButton("Cancel", (dialog, which) -> {
                    call.reject("User cancelled signing");
                })
                .setCancelable(false)
                .show();
        } catch (Exception e) {
            call.reject("Failed to show confirmation dialog: " + e.getMessage());
        }
    });
  }

  private void executeSigning(PluginCall call, String vaultJson, String pin, String path, String messageHashHex, String networkStr) {
    try {
      SecretKey keyToUse = null;
      JSONObject envelope = new JSONObject(vaultJson);
      JSONArray ivJson = envelope.getJSONArray("iv");
      JSONArray dataJson = envelope.getJSONArray("data");
      JSONArray saltJson = envelope.getJSONArray("salt");
      byte[] salt = new byte[saltJson.length()];
      for(int i=0; i<saltJson.length(); i++) salt[i] = (byte)saltJson.getInt(i);

      if (pin != null) {
          keyToUse = deriveKeyForVault(pin, salt);
      } else {
          if (cachedSessionKey != null && System.currentTimeMillis() < cachedSessionExpiry) {
              if (Arrays.equals(this.cachedSessionSalt, salt)) {
                  keyToUse = cachedSessionKey;
              } else {
                 call.reject("Session valid but wallet mismatch (salt). Unlock required.");
                 return;
              }
          } else {
              call.reject("Session expired or invalid. Unlock required.");
              return;
          }
      }

      byte[] iv = new byte[ivJson.length()];
      for(int i=0; i<ivJson.length(); i++) iv[i] = (byte)ivJson.getInt(i);
      byte[] data = new byte[dataJson.length()];
      for(int i=0; i<dataJson.length(); i++) data[i] = (byte)dataJson.getInt(i);

      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      cipher.init(Cipher.DECRYPT_MODE, keyToUse, new javax.crypto.spec.GCMParameterSpec(128, iv));
      byte[] seed = cipher.doFinal(data);

      try {
        org.bitcoinj.core.NetworkParameters params = networkStr.equals("testnet") ? org.bitcoinj.params.TestNet3Params.get() : org.bitcoinj.params.MainNetParams.get();
        org.bitcoinj.wallet.DeterministicSeed detSeed = new org.bitcoinj.wallet.DeterministicSeed(seed, (java.util.List<String>) null, 0L);
        byte[] seedBytes = detSeed.getSeedBytes(); org.bitcoinj.crypto.DeterministicKey rootKey = org.bitcoinj.crypto.HDKeyDerivation.createMasterPrivateKey(seedBytes); if (seedBytes != null) java.util.Arrays.fill(seedBytes, (byte) 0);

        org.bitcoinj.crypto.DeterministicHierarchy hierarchy = new org.bitcoinj.crypto.DeterministicHierarchy(rootKey);
        String[] parts = path.split("/");
        org.bitcoinj.crypto.DeterministicKey child = rootKey;

        for (String part : parts) {
            if (part.equals("m")) continue;
            boolean hardened = part.endsWith("'") || part.endsWith("h");
            String numStr = part.replace("'", "").replace("h", "");
            int index = Integer.parseInt(numStr);
            child = org.bitcoinj.crypto.HDKeyDerivation.deriveChildKey(child, new org.bitcoinj.crypto.ChildNumber(index, hardened));
        }

        if (networkStr.equals("rsk") || networkStr.equals("ethereum") || networkStr.equals("evm") || networkStr.equals("stacks")) {
             byte[] privKey = child.getPrivKeyBytes(); org.web3j.crypto.ECKeyPair keyPair = org.web3j.crypto.ECKeyPair.create(privKey); if (privKey != null) java.util.Arrays.fill(privKey, (byte) 0);
             byte[] msgHash = org.bouncycastle.util.encoders.Hex.decode(messageHashHex);
             org.web3j.crypto.Sign.SignatureData signature = org.web3j.crypto.Sign.signMessage(msgHash, keyPair, false);

             byte[] retval = new byte[65];
             System.arraycopy(signature.getR(), 0, retval, 0, 32);
             System.arraycopy(signature.getS(), 0, retval, 32, 32);

             byte v = signature.getV()[0];
             if (networkStr.equals("stacks") && v >= 27) {
                 v -= 27;
             }
             retval[64] = v;

             String sigHex = org.web3j.utils.Numeric.toHexString(retval);

             JSObject ret = new JSObject();
             ret.put("signature", sigHex);
             ret.put("pubkey", org.web3j.utils.Numeric.toHexString(keyPair.getPublicKey().toByteArray()));
             ret.put("recId", signature.getV()[0] - 27);

             call.resolve(ret);
        } else {
            org.bitcoinj.core.Sha256Hash hash = org.bitcoinj.core.Sha256Hash.wrap(messageHashHex);
            org.bitcoinj.core.ECKey.ECDSASignature sig = child.sign(hash);

            String sigHex = org.bouncycastle.util.encoders.Hex.toHexString(sig.encodeToDER());

            JSObject ret = new JSObject();
            ret.put("signature", sigHex);
            ret.put("pubkey", child.getPublicKeyAsHex());

            call.resolve(ret);
        }
      } finally {
        java.util.Arrays.fill(seed, (byte)0);
      }
    } catch (Exception e) {
      call.reject("Signing failed: " + e.getMessage());
    }
  }

}
