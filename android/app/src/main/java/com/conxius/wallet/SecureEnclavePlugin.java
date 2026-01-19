package com.conxius.wallet;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.PluginMethod;

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

import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;

@CapacitorPlugin(name = "SecureEnclave")
public class SecureEnclavePlugin extends Plugin {
  private static final String PREFS_NAME = "conxius_secure_enclave";
  private static final String KEY_ALIAS = "com.conxius.wallet.enclave.aes.v1";
  private static final int GCM_TAG_BITS = 128;

  private SharedPreferences prefs() {
    return getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
  }

  private SecretKey getOrCreateKey() throws Exception {
    KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
    keyStore.load(null);
    if (keyStore.containsAlias(KEY_ALIAS)) {
      return ((SecretKey) keyStore.getKey(KEY_ALIAS, null));
    }

    KeyGenerator keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
    KeyGenParameterSpec spec = new KeyGenParameterSpec.Builder(
      KEY_ALIAS,
      KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
    )
      .setKeySize(256)
      .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
      .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
      .setRandomizedEncryptionRequired(true)
      .build();
    keyGenerator.init(spec);
    return keyGenerator.generateKey();
  }

  private String encryptToRecord(String plaintext) throws Exception {
    SecretKey key = getOrCreateKey();
    byte[] iv = new byte[12];
    new SecureRandom().nextBytes(iv);

    Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
    cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_BITS, iv));
    byte[] ciphertext = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));

    String ivB64 = Base64.encodeToString(iv, Base64.NO_WRAP);
    String ctB64 = Base64.encodeToString(ciphertext, Base64.NO_WRAP);
    return ivB64 + ":" + ctB64;
  }

  private String decryptFromRecord(String record) throws Exception {
    String[] parts = record.split(":", 2);
    if (parts.length != 2) throw new IllegalArgumentException("Invalid record");
    byte[] iv = Base64.decode(parts[0], Base64.NO_WRAP);
    byte[] ciphertext = Base64.decode(parts[1], Base64.NO_WRAP);

    SecretKey key = getOrCreateKey();
    Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
    cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_BITS, iv));
    byte[] plaintext = cipher.doFinal(ciphertext);
    return new String(plaintext, StandardCharsets.UTF_8);
  }

  @PluginMethod
  public void isAvailable(PluginCall call) {
    JSObject ret = new JSObject();
    ret.put("available", true);
    call.resolve(ret);
  }

  @PluginMethod
  public void setItem(PluginCall call) {
    String key = call.getString("key");
    String value = call.getString("value");
    if (key == null || value == null) {
      call.reject("key and value required");
      return;
    }
    try {
      String record = encryptToRecord(value);
      prefs().edit().putString(key, record).apply();
      call.resolve(new JSObject());
    } catch (Exception e) {
      call.reject("secure storage failed");
    }
  }

  @PluginMethod
  public void getItem(PluginCall call) {
    String key = call.getString("key");
    if (key == null) {
      call.reject("key required");
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
      String plaintext = decryptFromRecord(record);
      ret.put("value", plaintext);
      call.resolve(ret);
    } catch (Exception e) {
      call.reject("secure storage failed");
    }
  }

  @PluginMethod
  public void removeItem(PluginCall call) {
    String key = call.getString("key");
    if (key == null) {
      call.reject("key required");
      return;
    }
    prefs().edit().remove(key).apply();
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

      Executor executor = ContextCompat.getMainExecutor(getContext());
      BiometricPrompt prompt = new BiometricPrompt(
        getActivity(),
        executor,
        new BiometricPrompt.AuthenticationCallback() {
          @Override
          public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
            JSObject ret = new JSObject();
            ret.put("authenticated", true);
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

      prompt.authenticate(promptInfo);
    } catch (Exception e) {
      call.reject("biometric failed");
    }
  }
}
