use std::str;

use bip39::Mnemonic;
use bitcoin::bip32::{ChildNumber, Xpriv};
use secp256k1::{PublicKey, Secp256k1, SecretKey};
use zeroize::Zeroizing;

use crate::{
    codec::{MAX_MNEMONIC_BYTES, MAX_PASSPHRASE_BYTES},
    error::NativeErrorCode,
};

const HARDENED_INDEX_LIMIT: u32 = 1 << 31;

/// Network values are deliberately explicit at the binary boundary. Test-like networks use the
/// BIP-44 test coin type, but are not silently accepted as an unknown network value.
#[repr(u8)]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Network {
    Mainnet = 0,
    Testnet = 1,
    Signet = 2,
    Regtest = 3,
}

impl Network {
    pub const fn from_code(code: u8) -> Option<Self> {
        Some(match code {
            0 => Self::Mainnet,
            1 => Self::Testnet,
            2 => Self::Signet,
            3 => Self::Regtest,
            _ => return None,
        })
    }

    pub const fn code(self) -> u8 {
        self as u8
    }

    pub const fn coin_type(self) -> u32 {
        match self {
            Self::Mainnet => 0,
            Self::Testnet | Self::Signet | Self::Regtest => 1,
        }
    }
}

/// Derived receiver keys. The scan secret remains private to the native scan call.
pub struct DerivedReceiverKeys {
    pub scan_secret: Zeroizing<[u8; 32]>,
    pub spend_public_key: [u8; 33],
}

impl std::fmt::Debug for DerivedReceiverKeys {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str("DerivedReceiverKeys(REDACTED)")
    }
}

/// Derive BIP-352 scan/spend keys from a BIP39 mnemonic entirely inside Rust.
///
/// Paths are fixed to `m/352'/coin_type'/account'/1'/0` for scanning and
/// `m/352'/coin_type'/account'/0'/0` for spending. Account zero is the only public protocol
/// value accepted by this phase, while the derivation helper keeps the account parameter explicit
/// for future versioned expansion.
pub fn derive_receiver_keys(
    mnemonic_bytes: &[u8],
    passphrase_bytes: &[u8],
    network: Network,
    account: u32,
) -> Result<DerivedReceiverKeys, NativeErrorCode> {
    if mnemonic_bytes.is_empty() || mnemonic_bytes.len() > MAX_MNEMONIC_BYTES {
        return Err(NativeErrorCode::InvalidSecret);
    }
    if passphrase_bytes.len() > MAX_PASSPHRASE_BYTES {
        return Err(NativeErrorCode::InvalidSecret);
    }
    if account >= HARDENED_INDEX_LIMIT {
        return Err(NativeErrorCode::InvalidSecret);
    }

    let mnemonic_str =
        str::from_utf8(mnemonic_bytes).map_err(|_| NativeErrorCode::InvalidSecret)?;
    let passphrase_str =
        str::from_utf8(passphrase_bytes).map_err(|_| NativeErrorCode::InvalidSecret)?;
    let mnemonic = Mnemonic::parse(mnemonic_str).map_err(|_| NativeErrorCode::InvalidSecret)?;
    let seed = Zeroizing::new(mnemonic.to_seed(passphrase_str));

    let coin_type = network.coin_type();
    let scan_secret = derive_path(&seed, [352, coin_type, account, 1, 0])?;
    let spend_secret = derive_path(&seed, [352, coin_type, account, 0, 0])?;
    let mut spend_secret_key =
        SecretKey::from_byte_array(&spend_secret).map_err(|_| NativeErrorCode::InvalidSecret)?;
    let spend_public_key =
        PublicKey::from_secret_key(&Secp256k1::new(), &spend_secret_key).serialize();
    spend_secret_key.non_secure_erase();

    Ok(DerivedReceiverKeys {
        scan_secret,
        spend_public_key,
    })
}

fn derive_path(seed: &[u8; 64], path: [u32; 5]) -> Result<Zeroizing<[u8; 32]>, NativeErrorCode> {
    // `bitcoin::bip32` performs BIP-32 CKDpriv, including the required parent compressed public
    // key in the HMAC input for the final non-hardened child `0`. Do not replace this with a
    // private-key-only derivation: that produces the wrong receiver keys for every canonical path.
    let master = Xpriv::new_master(bitcoin::Network::Bitcoin, seed)
        .map_err(|_| NativeErrorCode::InvalidSecret)?;
    let child_numbers = [
        ChildNumber::from_hardened_idx(path[0]).map_err(|_| NativeErrorCode::InvalidSecret)?,
        ChildNumber::from_hardened_idx(path[1]).map_err(|_| NativeErrorCode::InvalidSecret)?,
        ChildNumber::from_hardened_idx(path[2]).map_err(|_| NativeErrorCode::InvalidSecret)?,
        ChildNumber::from_hardened_idx(path[3]).map_err(|_| NativeErrorCode::InvalidSecret)?,
        ChildNumber::from_normal_idx(path[4]).map_err(|_| NativeErrorCode::InvalidSecret)?,
    ];
    let secp = bitcoin::secp256k1::Secp256k1::new();
    let derived = master
        .derive_priv(&secp, &child_numbers)
        .map_err(|_| NativeErrorCode::InvalidSecret)?;
    let secret_bytes = derived.private_key.secret_bytes();
    SecretKey::from_byte_array(&secret_bytes).map_err(|_| NativeErrorCode::InvalidSecret)?;
    Ok(Zeroizing::new(secret_bytes))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;

    const CROSS_LANGUAGE_FIXTURE: &str =
        include_str!("../tests/fixtures/bip32-cross-language.json");

    fn hex(bytes: &[u8]) -> String {
        bytes.iter().map(|byte| format!("{byte:02x}")).collect()
    }

    fn fixture_bytes(value: &Value) -> Vec<u8> {
        value
            .as_array()
            .expect("fixture passphrase bytes")
            .iter()
            .map(|byte| {
                u8::try_from(byte.as_u64().expect("fixture passphrase byte"))
                    .expect("fixture passphrase byte range")
            })
            .collect()
    }

    const PUBLIC_FIXTURE_PASSPHRASE: &[u8] = &[0x54, 0x52, 0x45, 0x5a, 0x4f, 0x52];

    #[test]
    fn derives_canonical_receiver_paths_against_public_only_fixture() {
        let mnemonic = b"abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
        let keys = derive_receiver_keys(mnemonic, PUBLIC_FIXTURE_PASSPHRASE, Network::Mainnet, 0)
            .expect("known BIP39/BIP32 fixture");
        let secp = Secp256k1::new();
        let scan_secret = SecretKey::from_byte_array(&keys.scan_secret).expect("scan secret");
        assert_eq!(
            PublicKey::from_secret_key(&secp, &scan_secret).serialize(),
            [
                0x02, 0x93, 0xfb, 0xbc, 0xfb, 0xc4, 0x90, 0x16, 0x2b, 0x5e, 0xed, 0x58, 0x3f, 0x00,
                0x71, 0xea, 0x71, 0x08, 0x51, 0x2a, 0x1d, 0xbe, 0x0e, 0x91, 0x72, 0x88, 0xf1, 0x45,
                0xc2, 0xb4, 0xef, 0x74, 0xa0,
            ]
        );
        assert_eq!(
            keys.spend_public_key,
            [
                0x02, 0x5a, 0x03, 0x14, 0xea, 0x69, 0x74, 0xf8, 0x19, 0x96, 0xd2, 0xd3, 0xc3, 0x55,
                0x80, 0x1d, 0x3b, 0x5b, 0xce, 0xca, 0xa7, 0xe9, 0xad, 0x09, 0xe5, 0x0d, 0x96, 0x44,
                0x5d, 0x17, 0x10, 0x6a, 0x94,
            ]
        );
    }

    #[test]
    fn matches_standard_bip32_public_vector_without_returning_private_material() {
        let seed = [
            0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d,
            0x0e, 0x0f,
        ];
        let master = Xpriv::new_master(bitcoin::Network::Bitcoin, &seed).expect("BIP32 master");
        let path = [
            ChildNumber::from_hardened_idx(0).expect("hardened index"),
            ChildNumber::from_normal_idx(1).expect("normal index"),
            ChildNumber::from_hardened_idx(2).expect("hardened index"),
            ChildNumber::from_normal_idx(2).expect("normal index"),
        ];
        let secp = bitcoin::secp256k1::Secp256k1::new();
        let derived = master.derive_priv(&secp, &path).expect("BIP32 vector path");
        assert_eq!(
            derived.private_key.public_key(&secp).serialize(),
            [
                0x02, 0xe8, 0x44, 0x50, 0x82, 0xa7, 0x2f, 0x29, 0xb7, 0x5c, 0xa4, 0x87, 0x48, 0xa9,
                0x14, 0xdf, 0x60, 0x62, 0x2a, 0x60, 0x9c, 0xac, 0xfc, 0xe8, 0xed, 0x0e, 0x35, 0x80,
                0x45, 0x60, 0x74, 0x1d, 0x29,
            ]
        );
    }

    #[test]
    fn native_public_keys_match_shared_typescript_bip32_fixture() {
        let fixture: Value = serde_json::from_str(CROSS_LANGUAGE_FIXTURE).expect("fixture JSON");
        let mnemonic = fixture["mnemonic"]
            .as_str()
            .expect("fixture mnemonic")
            .as_bytes();
        let passphrase = fixture_bytes(&fixture["passphrase_bytes"]);

        for vector in fixture["vectors"].as_array().expect("fixture vectors") {
            let network = match vector["network"].as_str().expect("fixture network") {
                "mainnet" => Network::Mainnet,
                "testnet" => Network::Testnet,
                other => panic!("unsupported fixture network: {other}"),
            };
            let account = vector["account"].as_u64().expect("fixture account") as u32;
            let keys = derive_receiver_keys(mnemonic, &passphrase, network, account)
                .expect("native fixture derivation");
            let scan_secret =
                SecretKey::from_byte_array(&keys.scan_secret).expect("fixture scan secret");
            let scan_public_key = PublicKey::from_secret_key(&Secp256k1::new(), &scan_secret);

            assert_eq!(
                hex(&scan_public_key.serialize()),
                vector["scan_pub"]
                    .as_str()
                    .expect("fixture scan public key")
            );
            assert_eq!(
                hex(&keys.spend_public_key),
                vector["spend_pub"]
                    .as_str()
                    .expect("fixture spend public key")
            );
        }
    }

    #[test]
    fn rejects_invalid_mnemonic_and_unknown_network_is_unrepresentable() {
        assert!(matches!(
            derive_receiver_keys(b"not a mnemonic", b"", Network::Mainnet, 0),
            Err(NativeErrorCode::InvalidSecret)
        ));
        assert_eq!(Network::from_code(99), None);
    }
}
