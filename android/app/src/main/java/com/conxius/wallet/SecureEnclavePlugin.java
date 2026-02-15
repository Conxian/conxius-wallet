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

import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.MessageDigest;
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

@CapacitorPlugin(name = "SecureEnclave")
public class SecureEnclavePlugin extends Plugin {

  private SecretKey cachedSessionKey = null;
  private byte[] cachedSessionSalt = null;
  private long cachedSessionExpiry = 0;

  private static class TransactionInfo {
      String action;
      String amount;
      String recipient;
      boolean warning = false;
      String warningMessage = "";
  }

  @PluginMethod
  public void getSecurityLevel(PluginCall call) {
      JSObject ret = new JSObject();
      try {
          KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
          keyStore.load(null);
          if (!keyStore.containsAlias("conxius_master_key")) {
              ret.put("level", "UNKNOWN");
              call.resolve(ret);
              return;
          }
          SecretKey key = (SecretKey) keyStore.getKey("conxius_master_key", null);
          SecretKeyFactory factory = SecretKeyFactory.getInstance(key.getAlgorithm(), "AndroidKeyStore");
          KeyInfo keyInfo = (KeyInfo) factory.getKeySpec(key, KeyInfo.class);

          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P && keyInfo.isInsideSecureHardware()) {
              // Check for StrongBox (Android 9+)
              // Note: There isn't a direct API to check StrongBox via KeyInfo easily in some versions,
              // but we assume if it's inside secure hardware and was created with setIsStrongBoxBacked(true), it is.
              ret.put("level", "STRONGBOX");
          } else if (keyInfo.isInsideSecureHardware()) {
              ret.put("level", "TEE");
          } else {
              ret.put("level", "SOFTWARE");
          }
      } catch (Exception e) {
          ret.put("level", "ERROR");
      }
      call.resolve(ret);
  }

  @PluginMethod
  public void setSessionKey(PluginCall call) {
      String pin = call.getString("pin");
      String saltHex = call.getString("salt");
      if (pin == null || saltHex == null) {
          call.reject("Missing pin or salt");
          return;
      }
      try {
          byte[] salt = org.bouncycastle.util.encoders.Hex.decode(saltHex);
          this.cachedSessionKey = deriveKeyForVault(pin, salt);
          this.cachedSessionSalt = salt;
          this.cachedSessionExpiry = System.currentTimeMillis() + (30 * 60 * 1000); // 30 mins
          call.resolve();
      } catch (Exception e) {
          call.reject("Failed to set session key: " + e.getMessage());
      }
  }

  private SecretKey deriveKeyForVault(String pin, byte[] salt) throws Exception {
      char[] pinChars = pin.toCharArray();
      try {
          SecretKeyFactory factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256");
          PBEKeySpec spec = new PBEKeySpec(pinChars, salt, 100000, 256);
          SecretKey tmp = factory.generateSecret(spec);
          return new SecretKeySpec(tmp.getEncoded(), "AES");
      } finally {
          java.util.Arrays.fill(pinChars, '\0');
      }
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
                  int postConditionMode = data[1] & 0xFF;
                  if (postConditionMode == 0x02) { // ALLOW
                      info.warning = true;
                      info.warningMessage = "REJECTED: Stacks PostConditionMode.ALLOW is not permitted for security reasons.";
                  }
                  info.action = "Stacks Transaction";
              }
          } else if ("mainnet".equals(networkStr) || "testnet".equals(networkStr) || "bitcoin".equals(networkStr)) {
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
                          if (addr != null) recipients.append(addr.toString()).append(" ");
                      } catch (Exception e) {}
                  }
                  info.amount = org.bitcoinj.core.Coin.valueOf(totalOut).toFriendlyString();
                  info.recipient = recipients.toString().trim();
              } catch (Exception e2) {}

          } else if ("ark".equals(networkStr)) {
              info.action = "Ark VTXO Transfer";
              info.amount = "Ark Managed";
          } else if ("rgb".equals(networkStr)) {
              info.action = "RGB Asset Transfer";
              info.amount = "Client-side Validated";
          } else if ("statechain".equals(networkStr)) {
              info.action = "State Chain Transfer";
          } else if ("maven".equals(networkStr)) {
              info.action = "Maven Protocol Action";
          } else if ("bitvm".equals(networkStr)) {
              info.action = "BitVM Proof Signing";
          } else if ("liquid".equals(networkStr)) {
              info.action = "Liquid (L-BTC) Transaction";
              // Attempt to parse Liquid as a regular BTC tx if not blinded
              try {
                  byte[] txBytes = org.bouncycastle.util.encoders.Hex.decode(payloadHex);
                  org.bitcoinj.core.Transaction tx = new org.bitcoinj.core.Transaction(org.bitcoinj.params.MainNetParams.get(), txBytes);
                  long totalOut = 0;
                  for (org.bitcoinj.core.TransactionOutput out : tx.getOutputs()) totalOut += out.getValue().getValue();
                  info.amount = org.bitcoinj.core.Coin.valueOf(totalOut).toFriendlyString() + " (Unblinded)";
              } catch (Exception e) {}
          } else if ("bob".equals(networkStr)) {
              info.action = "BOB (EVM L2) Transaction";
              info.amount = "EVM Payload";
          }
      } catch (Exception e) {
          Log.e("SecureEnclave", "Parsing failed", e);
      }
      return info;
  }

  @PluginMethod
  public void signBatch(PluginCall call) {
    String vaultJson = call.getString("vault");
    String pin = call.getString("pin");
    String path = call.getString("path");
    com.getcapacitor.JSArray hashes = call.getArray("hashes");
    String networkStr = call.getString("network", "mainnet");
    String payload = call.getString("payload");

    if (vaultJson == null || path == null || hashes == null) {
      call.reject("Missing required parameters");
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
                .setTitle(info.amount.equals("Unknown") ? "⚠️ Confirm UNKNOWN Batch" : "Confirm Batch Signing")
                .setMessage("Action: " + info.action + "\nAmount: " + info.amount + "\nRecipient: " + info.recipient + "\nTotal Inputs: " + hashes.length() +
                            (info.amount.equals("Unknown") ? "\n\nWARNING: Transaction details could not be verified!" : ""))
                .setPositiveButton("Confirm", (dialog, which) -> {
                    new Thread(() -> {
                        try {
                            com.getcapacitor.JSArray signatures = new com.getcapacitor.JSArray();
                            for (int i = 0; i < hashes.length(); i++) {
                                String hashHex = hashes.getString(i);
                                JSObject res = executeSigningInternal(vaultJson, pin, path, hashHex, networkStr);
                                signatures.put(res);
                            }
                            JSObject ret = new JSObject();
                            ret.put("signatures", signatures);
                            call.resolve(ret);
                        } catch (Exception e) {
                            call.reject("Batch signing failed: " + e.getMessage());
                        }
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
                .setTitle(info.amount.equals("Unknown") ? "⚠️ Confirm UNKNOWN Transaction" : "Confirm Signing")
                .setMessage("Action: " + info.action + "\nAmount: " + info.amount + "\nRecipient: " + info.recipient + (info.amount.equals("Unknown") ? "\n\nWARNING: Transaction details could not be verified!" : ""))
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

  private JSObject executeSigningInternal(String vaultJson, String pin, String path, String messageHashHex, String networkStr) throws Exception {
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
                 throw new Exception("Session valid but wallet mismatch (salt). Unlock required.");
              }
          } else {
              throw new Exception("Session expired or invalid. Unlock required.");
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
        byte[] seedBytes = detSeed.getSeedBytes();
        org.bitcoinj.crypto.DeterministicKey rootKey = org.bitcoinj.crypto.HDKeyDerivation.createMasterPrivateKey(seedBytes);
        if (seedBytes != null) java.util.Arrays.fill(seedBytes, (byte) 0);
        
        String[] parts = path.split("/");
        org.bitcoinj.crypto.DeterministicKey child = rootKey;
        
        for (String part : parts) {
            if (part.equals("m")) continue;
            boolean hardened = part.endsWith("'") || part.endsWith("h");
            String numStr = part.replace("'", "").replace("h", "");
            int index = Integer.parseInt(numStr);
            child = org.bitcoinj.crypto.HDKeyDerivation.deriveChildKey(child, new org.bitcoinj.crypto.ChildNumber(index, hardened));
        }

        boolean useSchnorr = path.contains("86'") || "rgb".equals(networkStr) || "ark".equals(networkStr);

        if (useSchnorr) {
            return signSchnorrInternal(child, messageHashHex);
        }

        if (networkStr.equals("rsk") || networkStr.equals("ethereum") || networkStr.equals("evm") || networkStr.equals("stacks") || networkStr.equals("bob")) {
             byte[] privKey = child.getPrivKeyBytes();
             org.web3j.crypto.ECKeyPair keyPair = org.web3j.crypto.ECKeyPair.create(privKey);
             if (privKey != null) java.util.Arrays.fill(privKey, (byte) 0);
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
             
             return ret;
        } else {
            org.bitcoinj.core.Sha256Hash hash = org.bitcoinj.core.Sha256Hash.wrap(messageHashHex);
            org.bitcoinj.core.ECKey.ECDSASignature sig = child.sign(hash);
            
            byte[] r = sig.r.toByteArray();
            byte[] s = sig.s.toByteArray();
            byte[] raw = new byte[64];
            int rOffset = (r.length > 32) ? r.length - 32 : 0;
            int rLen = Math.min(32, r.length);
            System.arraycopy(r, rOffset, raw, 32 - rLen, rLen);
            int sOffset = (s.length > 32) ? s.length - 32 : 0;
            int sLen = Math.min(32, s.length);
            System.arraycopy(s, sOffset, raw, 64 - sLen, sLen);
            String sigHex = org.bouncycastle.util.encoders.Hex.toHexString(raw);
            
            JSObject ret = new JSObject();
            ret.put("signature", sigHex);
            ret.put("pubkey", child.getPublicKeyAsHex());
            
            return ret;
        }
      } finally {
        java.util.Arrays.fill(seed, (byte)0);
      }
    } catch (Exception e) {
      throw new Exception("Signing failed: " + e.getMessage());
    }
  }

  private byte[] taggedHash(String tag, byte[] msg) throws Exception {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] tagHash = digest.digest(tag.getBytes(StandardCharsets.UTF_8));
      digest.reset();
      digest.update(tagHash);
      digest.update(tagHash);
      digest.update(msg);
      return digest.digest();
  }

    private JSObject signSchnorrInternal(org.bitcoinj.crypto.DeterministicKey child, String messageHashHex) throws Exception {
      byte[] privKeyBytes = child.getPrivKeyBytes();
      byte[] msgHash = org.bouncycastle.util.encoders.Hex.decode(messageHashHex);

      BigInteger n = org.bitcoinj.core.ECKey.CURVE.getN();
      BigInteger dPrime = new BigInteger(1, privKeyBytes);

      org.bouncycastle.math.ec.ECPoint G = org.bitcoinj.core.ECKey.CURVE.getG();
      org.bouncycastle.math.ec.ECPoint P = G.multiply(dPrime).normalize();

      BigInteger d = P.getAffineYCoord().toBigInteger().mod(BigInteger.valueOf(2)).equals(BigInteger.ZERO)
                              ? dPrime : n.subtract(dPrime);

      P = G.multiply(d).normalize();
      byte[] px = P.getAffineXCoord().getEncoded();
      if (px.length != 32) {
          byte[] tmp = new byte[32];
          System.arraycopy(px, 0, tmp, 32 - px.length, px.length);
          px = tmp;
      }

      byte[] d32 = new byte[32];
      byte[] dRaw = d.toByteArray();
      int dOffset = Math.max(0, dRaw.length - 32);
      int dLen = Math.min(32, dRaw.length);
      System.arraycopy(dRaw, dOffset, d32, 32 - dLen, dLen);

      // BIP-340 Nonce Generation with auxiliary randomness for enhanced security
      byte[] auxRand = new byte[32];
      new java.security.SecureRandom().nextBytes(auxRand);
      byte[] tHash = taggedHash("BIP0340/aux", auxRand);
      byte[] t = new byte[32];
      for (int i = 0; i < 32; i++) t[i] = (byte) (d32[i] ^ tHash[i]);

      byte[] nonceCombined = new byte[96];
      System.arraycopy(t, 0, nonceCombined, 0, 32);
      System.arraycopy(px, 0, nonceCombined, 32, 32);
      System.arraycopy(msgHash, 0, nonceCombined, 64, 32);

      byte[] kPrimeBytes = taggedHash("BIP0340/nonce", nonceCombined);
      BigInteger kPrime = new BigInteger(1, kPrimeBytes).mod(n);
      if (kPrime.equals(BigInteger.ZERO)) throw new Exception("Generated nonce is zero");

      org.bouncycastle.math.ec.ECPoint R = G.multiply(kPrime).normalize();
      BigInteger k = R.getAffineYCoord().toBigInteger().mod(BigInteger.valueOf(2)).equals(BigInteger.ZERO)
                              ? kPrime : n.subtract(kPrime);

      R = G.multiply(k).normalize();
      byte[] rx = R.getAffineXCoord().getEncoded();
      if (rx.length != 32) {
          byte[] tmp = new byte[32];
          System.arraycopy(rx, 0, tmp, 32 - rx.length, rx.length);
          rx = tmp;
      }

      byte[] challengeCombined = new byte[96];
      System.arraycopy(rx, 0, challengeCombined, 0, 32);
      System.arraycopy(px, 0, challengeCombined, 32, 32);
      System.arraycopy(msgHash, 0, challengeCombined, 64, 32);

      byte[] eBytes = taggedHash("BIP0340/challenge", challengeCombined);
      BigInteger e = new BigInteger(1, eBytes).mod(n);

      BigInteger s = k.add(e.multiply(d)).mod(n);

      byte[] sBytes = s.toByteArray();
      byte[] sig = new byte[64];
      System.arraycopy(rx, 0, sig, 0, 32);
      int sOff = Math.max(0, sBytes.length - 32);
      int sL = Math.min(32, sBytes.length);
      System.arraycopy(sBytes, sOff, sig, 64 - sL, sL);

      // Memory Hardening: Zero-fill sensitive arrays
      java.util.Arrays.fill(privKeyBytes, (byte)0);
      java.util.Arrays.fill(d32, (byte)0);
      java.util.Arrays.fill(auxRand, (byte)0);
      java.util.Arrays.fill(t, (byte)0);

      JSObject ret = new JSObject();
      ret.put("signature", org.bouncycastle.util.encoders.Hex.toHexString(sig));
      ret.put("pubkey", org.bouncycastle.util.encoders.Hex.toHexString(px));
      return ret;
  }

      byte[] d32 = new byte[32];
      byte[] dRaw = d.toByteArray();
      int dOffset = Math.max(0, dRaw.length - 32);
      int dLen = Math.min(32, dRaw.length);
      System.arraycopy(dRaw, dOffset, d32, 32 - dLen, dLen);

      byte[] nonceCombined = new byte[64];
      System.arraycopy(d32, 0, nonceCombined, 0, 32);
      System.arraycopy(msgHash, 0, nonceCombined, 32, 32);

      byte[] kPrimeBytes = taggedHash("BIP0340/nonce", nonceCombined);
      BigInteger kPrime = new BigInteger(1, kPrimeBytes).mod(n);

      org.bouncycastle.math.ec.ECPoint R = G.multiply(kPrime).normalize();
      BigInteger k = R.getAffineYCoord().toBigInteger().mod(BigInteger.valueOf(2)).equals(BigInteger.ZERO)
                              ? kPrime : n.subtract(kPrime);

      R = G.multiply(k).normalize();
      byte[] rx = R.getAffineXCoord().getEncoded(); if (rx.length != 32) { byte[] tmp = new byte[32]; System.arraycopy(rx, 0, tmp, 32 - rx.length, rx.length); rx = tmp; }

      byte[] challengeCombined = new byte[96];
      System.arraycopy(rx, 0, challengeCombined, 0, 32);
      System.arraycopy(px, 0, challengeCombined, 32, 32);
      System.arraycopy(msgHash, 0, challengeCombined, 64, 32);

      byte[] eBytes = taggedHash("BIP0340/challenge", challengeCombined);
      BigInteger e = new BigInteger(1, eBytes).mod(n);

      BigInteger s = k.add(e.multiply(d)).mod(n);

      byte[] sBytes = s.toByteArray();
      byte[] sig = new byte[64];
      System.arraycopy(rx, 0, sig, 0, 32);
      int sOff = Math.max(0, sBytes.length - 32);
      int sL = Math.min(32, sBytes.length);
      System.arraycopy(sBytes, sOff, sig, 64 - sL, sL);

      java.util.Arrays.fill(privKeyBytes, (byte)0);

      JSObject ret = new JSObject();
      ret.put("signature", org.bouncycastle.util.encoders.Hex.toHexString(sig));
      ret.put("pubkey", org.bouncycastle.util.encoders.Hex.toHexString(px));
      return ret;
  }

  private void executeSigning(PluginCall call, String vaultJson, String pin, String path, String messageHashHex, String networkStr) {
    try {
      JSObject res = executeSigningInternal(vaultJson, pin, path, messageHashHex, networkStr);
      call.resolve(res);
    } catch (Exception e) {
      call.reject("Signing failed: " + e.getMessage());
    }
  }


}
