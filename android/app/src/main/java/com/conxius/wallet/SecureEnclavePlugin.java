package com.conxius.wallet;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyInfo;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.bitcoinj.core.NetworkParameters;
import org.json.JSONObject;
import org.bitcoinj.crypto.DeterministicKey;
import org.bitcoinj.crypto.HDKeyDerivation;
import org.bitcoinj.params.MainNetParams;
import org.bitcoinj.params.TestNet3Params;
import org.bitcoinj.wallet.DeterministicSeed;

import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.List;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;

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

    private SecretKey getOrCreateMasterKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);
        if (keyStore.containsAlias("conxius_master_key")) {
            return (SecretKey) keyStore.getKey("conxius_master_key", null);
        }

        KeyGenerator keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        KeyGenParameterSpec.Builder builder = new KeyGenParameterSpec.Builder(
                "conxius_master_key",
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            try {
                builder.setIsStrongBoxBacked(true);
                keyGenerator.init(builder.build());
                return keyGenerator.generateKey();
            } catch (Exception e) {
                Log.w("SecureEnclave", "StrongBox unavailable, falling back to TEE", e);
                builder.setIsStrongBoxBacked(false);
            }
        }

        keyGenerator.init(builder.build());
        return keyGenerator.generateKey();
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("available", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void getSecurityLevel(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            SecretKey key = getOrCreateMasterKey();
            SecretKeyFactory factory = SecretKeyFactory.getInstance(key.getAlgorithm(), "AndroidKeyStore");
            KeyInfo keyInfo = (KeyInfo) factory.getKeySpec(key, KeyInfo.class);

            boolean isStrongBox = false;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                if (keyInfo.isInsideSecureHardware()) {
                    if (getContext().getPackageManager().hasSystemFeature(PackageManager.FEATURE_STRONGBOX_KEYSTORE)) {
                        ret.put("level", "STRONGBOX");
                        isStrongBox = true;
                    } else {
                        ret.put("level", "TEE");
                    }
                } else {
                    ret.put("level", "SOFTWARE");
                }
            } else if (keyInfo.isInsideSecureHardware()) {
                ret.put("level", "TEE");
            } else {
                ret.put("level", "SOFTWARE");
            }
            ret.put("isStrongBox", isStrongBox);
        } catch (Exception e) {
            ret.put("level", "ERROR");
            ret.put("isStrongBox", false);
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void setItem(PluginCall call) {
        String key = call.getString("key");
        String value = call.getString("value");
        if (key == null || value == null) {
            call.reject("Key and value are required");
            return;
        }
        try {
            SecretKey masterKey = getOrCreateMasterKey();
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, masterKey);
            byte[] iv = cipher.getIV();
            byte[] encrypted = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));

            String combined = Base64.encodeToString(iv, Base64.NO_WRAP) + ":" + Base64.encodeToString(encrypted, Base64.NO_WRAP);

            SharedPreferences prefs = getContext().getSharedPreferences("conxius_secure_storage", Context.MODE_PRIVATE);
            prefs.edit().putString(key, combined).apply();
            call.resolve();
        } catch (Exception e) {
            call.reject("Encryption failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getItem(PluginCall call) {
        String key = call.getString("key");
        if (key == null) {
            call.reject("Key is required");
            return;
        }
        try {
            SharedPreferences prefs = getContext().getSharedPreferences("conxius_secure_storage", Context.MODE_PRIVATE);
            String combined = prefs.getString(key, null);
            if (combined == null) {
                JSObject ret = new JSObject();
                ret.put("value", null);
                call.resolve(ret);
                return;
            }

            String[] parts = combined.split(":");
            byte[] iv = Base64.decode(parts[0], Base64.NO_WRAP);
            byte[] encrypted = Base64.decode(parts[1], Base64.NO_WRAP);

            SecretKey masterKey = getOrCreateMasterKey();
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, masterKey, new GCMParameterSpec(128, iv));
            byte[] decrypted = cipher.doFinal(encrypted);

            JSObject ret = new JSObject();
            ret.put("value", new String(decrypted, StandardCharsets.UTF_8));
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Decryption failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void hasItem(PluginCall call) {
        String key = call.getString("key");
        SharedPreferences prefs = getContext().getSharedPreferences("conxius_secure_storage", Context.MODE_PRIVATE);
        JSObject ret = new JSObject();
        ret.put("exists", prefs.contains(key));
        call.resolve(ret);
    }

    @PluginMethod
    public void removeItem(PluginCall call) {
        String key = call.getString("key");
        SharedPreferences prefs = getContext().getSharedPreferences("conxius_secure_storage", Context.MODE_PRIVATE);
        prefs.edit().remove(key).apply();
        call.resolve();
    }

    @PluginMethod
    public void authenticate(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("authenticated", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void clearBiometricSession(PluginCall call) {
        this.cachedSessionKey = null;
        this.cachedSessionSalt = null;
        this.cachedSessionExpiry = 0;
        call.resolve();
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
            this.cachedSessionExpiry = System.currentTimeMillis() + (30 * 60 * 1000);
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

    @PluginMethod
    public void getWalletInfo(PluginCall call) {
        String vaultJson = call.getString("vault");
        String pin = call.getString("pin");
        if (vaultJson == null || pin == null) {
            call.reject("Vault and PIN are required");
            return;
        }
        try {
            JSObject btc = executeSigningInternal(vaultJson, pin, "m/84'/0'/0'/0/0", "PUBKEY_DERIVATION", "mainnet");
            JSObject stx = executeSigningInternal(vaultJson, pin, "m/44'/5757'/0'/0/0", "PUBKEY_DERIVATION", "stacks");
            JSObject liquid = executeSigningInternal(vaultJson, pin, "m/84'/1776'/0'/0/0", "PUBKEY_DERIVATION", "liquid");
            JSObject evm = executeSigningInternal(vaultJson, pin, "m/44'/60'/0'/0/0", "PUBKEY_DERIVATION", "evm");
            JSObject taproot = executeSigningInternal(vaultJson, pin, "m/86'/0'/0'/0/0", "PUBKEY_DERIVATION", "mainnet");

            JSObject ret = new JSObject();
            ret.put("btcPubkey", btc.getString("pubkey"));
            ret.put("stxPubkey", stx.getString("pubkey"));
            ret.put("liquidPubkey", liquid.getString("pubkey"));
            ret.put("evmAddress", evm.getString("pubkey"));
            ret.put("taprootAddress", taproot.getString("pubkey"));
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to get wallet info: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getPublicKey(PluginCall call) {
        String vaultJson = call.getString("vault");
        String pin = call.getString("pin");
        String path = call.getString("path");
        String network = call.getString("network", "mainnet");
        if (vaultJson == null || path == null) {
            call.reject("Vault and path are required");
            return;
        }
        try {
            JSObject res = executeSigningInternal(vaultJson, pin, path, "PUBKEY_DERIVATION", network);
            JSObject ret = new JSObject();
            ret.put("pubkey", res.getString("pubkey"));
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to get public key: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getDerivedSecret(PluginCall call) {
        String vaultJson = call.getString("vault");
        String pin = call.getString("pin");
        String path = call.getString("path");
        if (vaultJson == null || path == null) {
            call.reject("Vault and path are required");
            return;
        }

        getActivity().runOnUiThread(() -> {
            new android.app.AlertDialog.Builder(getContext())
                .setTitle("⚠️ Security Warning")
                .setMessage("An application is requesting a derived private secret for path: " + path + "\n\nThis is a highly sensitive operation. Do you want to proceed?")
                .setPositiveButton("Allow", (dialog, which) -> {
                    new Thread(() -> {
                        try {
                            byte[] seed = NativeCrypto.decryptVault(vaultJson, pin);
                            try {
                                NetworkParameters params = MainNetParams.get();
                                DeterministicSeed detSeed = new DeterministicSeed(seed, (List<String>) null, 0L);
                                byte[] seedBytes = detSeed.getSeedBytes();
                                DeterministicKey rootKey = HDKeyDerivation.createMasterPrivateKey(seedBytes);
                                if (seedBytes != null) Arrays.fill(seedBytes, (byte) 0);

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
                                ret.put("secret", org.bouncycastle.util.encoders.Hex.toHexString(child.getPrivKeyBytes()));
                                ret.put("pubkey", child.getPublicKeyAsHex());
                                call.resolve(ret);
                            } finally {
                                Arrays.fill(seed, (byte) 0);
                            }
                        } catch (Exception e) {
                            call.reject("Failed to derive secret: " + e.getMessage());
                        }
                    }).start();
                })
                .setNegativeButton("Deny", (dialog, which) -> {
                    call.reject("User denied secret derivation");
                })
                .setCancelable(false)
                .show();
        });
    }

        private TransactionInfo parsePayload(String payload, String networkStr) {
        TransactionInfo info = new TransactionInfo();
        info.action = "Sign Hash";
        info.amount = "Unknown";
        info.recipient = "Unknown";
        if (payload == null || payload.isEmpty()) return info;

        try {
            if (payload.startsWith("{")) {
                JSONObject json = new JSONObject(payload);
                if ("stacks".equals(networkStr)) {
                    info.action = "Stacks Protocol";
                    if (json.has("amount")) info.amount = json.getString("amount") + " STX";
                    if (json.has("recipient")) info.recipient = json.getString("recipient");
                    if (json.has("postConditionMode") && json.getInt("postConditionMode") == 0x02) {
                        info.warning = true;
                        info.warningMessage = "REJECTED: Stacks PostConditionMode.ALLOW is not permitted for security reasons.";
                    }
                } else if ("rgb".equals(networkStr)) {
                    info.action = "RGB Asset Transfer";
                    if (json.has("assetId")) info.recipient = json.getString("assetId");
                    if (json.has("amount")) info.amount = json.getString("amount");
                } else if ("ark".equals(networkStr)) {
                    info.action = "Ark VTXO Transfer";
                    if (json.has("amount")) info.amount = json.getString("amount") + " sats";
                    if (json.has("recipient")) info.recipient = json.getString("recipient");
                } else if ("liquid".equals(networkStr)) {
                    info.action = "Liquid Transaction";
                    if (json.has("amount")) info.amount = json.getString("amount") + " L-BTC";
                    if (json.has("recipient")) info.recipient = json.getString("recipient");
                } else if (Arrays.asList("bob", "b2", "botanix", "mezo", "alpen", "zulu", "bison", "hemi", "nubit", "lorenzo", "citrea", "babylon", "merlin", "bitlayer").contains(networkStr)) {
                    info.action = networkStr.toUpperCase() + " (EVM L2) Transaction";
                    if (json.has("value")) info.amount = json.getString("value") + " ETH";
                    if (json.has("to")) info.recipient = json.getString("to");
                } else if ("taprootassets".equals(networkStr)) {
                    info.action = "Taproot Asset Transfer";
                    if (json.has("assetId")) info.recipient = json.getString("assetId");
                    if (json.has("amount")) info.amount = json.getString("amount");
                } else if ("statechain".equals(networkStr)) {
                    info.action = "State Chain Transfer";
                    if (json.has("amount")) info.amount = json.getString("amount") + " sats";
                } else if ("maven".equals(networkStr)) {
                    info.action = "Maven Protocol Action";
                } else if ("bitvm".equals(networkStr)) {
                    info.action = "BitVM Proof Signing";
                }
            } else {
                // Hex Payload (Bitcoin/EVM Raw)
                if ("mainnet".equals(networkStr) || "testnet".equals(networkStr) || "bitcoin".equals(networkStr)) {
                    NetworkParameters params = "testnet".equals(networkStr) ? TestNet3Params.get() : MainNetParams.get();
                    byte[] txBytes = org.bouncycastle.util.encoders.Hex.decode(payload);
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
                } else if ("stacks".equals(networkStr)) {
                    // Raw stacks tx
                    byte[] data = org.bouncycastle.util.encoders.Hex.decode(payload);
                    if (data.length > 2) {
                        int postConditionMode = data[1] & 0xFF;
                        if (postConditionMode == 0x02) {
                            info.warning = true;
                            info.warningMessage = "REJECTED: Stacks PostConditionMode.ALLOW is not permitted for security reasons.";
                        }
                        info.action = "Stacks Raw Transaction";
                    }
                }
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
                try {
                    JSObject res = executeSigningInternal(vaultJson, pin, path, messageHashHex, networkStr);
                    call.resolve(res);
                } catch (Exception e) {
                    call.reject(e.getMessage());
                }
            }).start();
            return;
        }

        TransactionInfo info = parsePayload(payload, networkStr);
        if (info.warning) {
            call.reject(info.warningMessage);
            return;
        }

        getActivity().runOnUiThread(() -> {
            new android.app.AlertDialog.Builder(getContext())
                .setTitle(info.amount.equals("Unknown") ? "⚠️ Confirm UNKNOWN Transaction" : "Confirm Signing")
                .setMessage("Action: " + info.action + "\nAmount: " + info.amount + "\nRecipient: " + info.recipient + (info.amount.equals("Unknown") ? "\n\nWARNING: Transaction details could not be verified!" : ""))
                .setPositiveButton("Confirm", (dialog, which) -> {
                    new Thread(() -> {
                        try {
                            JSObject res = executeSigningInternal(vaultJson, pin, path, messageHashHex, networkStr);
                            call.resolve(res);
                        } catch (Exception e) {
                            call.reject(e.getMessage());
                        }
                    }).start();
                })
                .setNegativeButton("Cancel", (dialog, which) -> {
                    call.reject("User cancelled signing");
                })
                .setCancelable(false)
                .show();
        });
    }

    private JSObject executeSigningInternal(String vaultJson, String pin, String path, String messageHashHex, String networkStr) throws Exception {
        byte[] seed = NativeCrypto.decryptVault(vaultJson, pin);
        try {
            NetworkParameters params = "testnet".equals(networkStr) ? TestNet3Params.get() : MainNetParams.get();
            DeterministicSeed detSeed = new DeterministicSeed(seed, (List<String>) null, 0L);
            byte[] seedBytes = detSeed.getSeedBytes();
            DeterministicKey rootKey = HDKeyDerivation.createMasterPrivateKey(seedBytes);
            if (seedBytes != null) Arrays.fill(seedBytes, (byte) 0);

            String[] parts = path.split("/");
            DeterministicKey child = rootKey;
            for (String part : parts) {
                if (part.equals("m")) continue;
                boolean hardened = part.endsWith("'") || part.endsWith("h");
                String numStr = part.replace("'", "").replace("h", "");
                int index = Integer.parseInt(numStr);
                child = HDKeyDerivation.deriveChildKey(child, new org.bitcoinj.crypto.ChildNumber(index, hardened));
            }

            if (messageHashHex.equals("PUBKEY_DERIVATION")) {
                JSObject ret = new JSObject();
                ret.put("pubkey", child.getPublicKeyAsHex());
                return ret;
            }

            boolean useSchnorr = path.contains("86'") || "rgb".equals(networkStr) || "ark".equals(networkStr);
            if (useSchnorr) {
                return signSchnorrInternal(child, messageHashHex);
            }

            if (Arrays.asList("rsk", "ethereum", "evm", "stacks", "bob", "b2", "botanix", "mezo", "alpen", "zulu", "bison", "hemi", "nubit", "lorenzo", "citrea", "babylon", "merlin", "bitlayer").contains(networkStr)) {
                byte[] privKey = child.getPrivKeyBytes();
                org.web3j.crypto.ECKeyPair keyPair = org.web3j.crypto.ECKeyPair.create(privKey);
                Arrays.fill(privKey, (byte) 0);
                byte[] msgHash = org.bouncycastle.util.encoders.Hex.decode(messageHashHex);
                org.web3j.crypto.Sign.SignatureData signature = org.web3j.crypto.Sign.signMessage(msgHash, keyPair, false);

                byte[] retval = new byte[65];
                System.arraycopy(signature.getR(), 0, retval, 0, 32);
                System.arraycopy(signature.getS(), 0, retval, 32, 32);
                byte v = signature.getV()[0];
                if (networkStr.equals("stacks") && v >= 27) v -= 27;
                retval[64] = v;

                JSObject ret = new JSObject();
                ret.put("signature", org.web3j.utils.Numeric.toHexString(retval));
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

                JSObject ret = new JSObject();
                ret.put("signature", org.bouncycastle.util.encoders.Hex.toHexString(raw));
                ret.put("pubkey", child.getPublicKeyAsHex());
                return ret;
            }
        } finally {
            Arrays.fill(seed, (byte) 0);
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

    private JSObject signSchnorrInternal(DeterministicKey child, String messageHashHex) throws Exception {
        byte[] privKeyBytes = child.getPrivKeyBytes();
        byte[] msgHash = org.bouncycastle.util.encoders.Hex.decode(messageHashHex);
        BigInteger n = org.bitcoinj.core.ECKey.CURVE.getN();
        BigInteger dPrime = new BigInteger(1, privKeyBytes);
        org.bouncycastle.math.ec.ECPoint G = org.bitcoinj.core.ECKey.CURVE.getG();
        org.bouncycastle.math.ec.ECPoint P = G.multiply(dPrime).normalize();
        BigInteger d = P.getAffineYCoord().toBigInteger().mod(BigInteger.valueOf(2)).equals(BigInteger.ZERO) ? dPrime : n.subtract(dPrime);
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
        org.bouncycastle.math.ec.ECPoint R = G.multiply(kPrime).normalize();
        BigInteger k = R.getAffineYCoord().toBigInteger().mod(BigInteger.valueOf(2)).equals(BigInteger.ZERO) ? kPrime : n.subtract(kPrime);
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
        Arrays.fill(privKeyBytes, (byte) 0);
        Arrays.fill(d32, (byte) 0);
        Arrays.fill(auxRand, (byte) 0);
        Arrays.fill(t, (byte) 0);
        JSObject ret = new JSObject();
        ret.put("signature", org.bouncycastle.util.encoders.Hex.toHexString(sig));
        ret.put("pubkey", org.bouncycastle.util.encoders.Hex.toHexString(px));
        return ret;
    }
}
