package com.conxius.wallet;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.SecureRandom;
import java.util.concurrent.Executor;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.security.keystore.UserNotAuthenticatedException;

import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;

@CapacitorPlugin(name = "SecureEnclave")
public class SecureEnclavePlugin extends Plugin {
  private static final String PREFS_NAME = "conxius_secure_enclave";
  private static final String KEY_ALIAS = "com.conxius.wallet.enclave.aes.v1";
  private static final String KEY_ALIAS_AUTH = "com.conxius.wallet.enclave.aes.v2.auth";
  private static final int GCM_TAG_BITS = 128;
  private long biometricSessionValidUntilMs = 0;

  private SharedPreferences prefs() {
    return getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
  }

  private SecretKey getOrCreateKey(String alias, boolean requireUserAuth) throws Exception {
    KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
    keyStore.load(null);
    if (keyStore.containsAlias(alias)) {
      return ((SecretKey) keyStore.getKey(alias, null));
    }

    KeyGenerator keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
    KeyGenParameterSpec spec = new KeyGenParameterSpec.Builder(
      alias,
      KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
    )
      .setKeySize(256)
      .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
      .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
      .setRandomizedEncryptionRequired(true)
      .setUserAuthenticationRequired(requireUserAuth)
      .build();
    if (requireUserAuth) {
      KeyGenParameterSpec.Builder builder = new KeyGenParameterSpec.Builder(
        alias,
        KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
      )
        .setKeySize(256)
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .setRandomizedEncryptionRequired(true)
        .setUserAuthenticationRequired(true);
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        builder.setUserAuthenticationParameters(
          300,
          KeyProperties.AUTH_BIOMETRIC_STRONG | KeyProperties.AUTH_DEVICE_CREDENTIAL
        );
      } else {
        builder.setUserAuthenticationValidityDurationSeconds(300);
      }
      spec = builder.build();
    }
    keyGenerator.init(spec);
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

  @PluginMethod
  public void isAvailable(PluginCall call) {
    JSObject ret = new JSObject();
    ret.put("available", true);
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
}
