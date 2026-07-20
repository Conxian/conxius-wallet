use std::str;

use bip39::Mnemonic;
use hmac::{Hmac, Mac};
use secp256k1::{PublicKey, Scalar, Secp256k1, SecretKey};
use sha2::Sha512;
use zeroize::Zeroizing;

use crate::{
    codec::{MAX_MNEMONIC_BYTES, MAX_PASSPHRASE_BYTES},
    error::NativeErrorCode,
};

type HmacSha512 = Hmac<Sha512>;
const HARDENED: u32 = 1 << 31;

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
    if account >= HARDENED {
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
    let master = hmac_sha512(b"Bitcoin seed", seed)?;
    let mut secret = Zeroizing::new([0u8; 32]);
    secret.copy_from_slice(&master[..32]);
    let mut chain_code = Zeroizing::new([0u8; 32]);
    chain_code.copy_from_slice(&master[32..]);
    SecretKey::from_byte_array(&secret).map_err(|_| NativeErrorCode::InvalidSecret)?;

    for (position, index) in path.into_iter().enumerate() {
        let child_index = if position < 4 {
            index
                .checked_add(HARDENED)
                .ok_or(NativeErrorCode::InvalidSecret)?
        } else {
            index
        };
        let mut child_data = Zeroizing::new([0u8; 37]);
        child_data[0] = 0;
        child_data[1..33].copy_from_slice(&*secret);
        child_data[33..].copy_from_slice(&child_index.to_be_bytes());
        let child = hmac_sha512(&*chain_code, &*child_data)?;

        let mut left = Zeroizing::new([0u8; 32]);
        left.copy_from_slice(&child[..32]);
        let tweak = Scalar::from_be_bytes(*left).map_err(|_| NativeErrorCode::InvalidSecret)?;
        let parent =
            SecretKey::from_byte_array(&secret).map_err(|_| NativeErrorCode::InvalidSecret)?;
        let child_secret = parent
            .add_tweak(&tweak)
            .map_err(|_| NativeErrorCode::InvalidSecret)?;
        secret.copy_from_slice(&child_secret.secret_bytes());
        chain_code.copy_from_slice(&child[32..]);

        let mut parent_copy = parent;
        parent_copy.non_secure_erase();
        let mut child_copy = child_secret;
        child_copy.non_secure_erase();
        let mut tweak_copy = tweak;
        tweak_copy.non_secure_erase();
    }

    Ok(secret)
}

fn hmac_sha512(key: &[u8], message: &[u8]) -> Result<Zeroizing<[u8; 64]>, NativeErrorCode> {
    let mut mac = HmacSha512::new_from_slice(key).map_err(|_| NativeErrorCode::Internal)?;
    mac.update(message);
    let output = mac.finalize().into_bytes();
    let mut result = Zeroizing::new([0u8; 64]);
    result.copy_from_slice(&output);
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    const PUBLIC_FIXTURE_PASSPHRASE: &[u8] = &[0x54, 0x52, 0x45, 0x5a, 0x4f, 0x52];

    #[test]
    fn derives_canonical_receiver_paths_against_independent_bip32_fixture() {
        let mnemonic = b"abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
        let keys = derive_receiver_keys(mnemonic, PUBLIC_FIXTURE_PASSPHRASE, Network::Mainnet, 0)
            .expect("known BIP39/BIP32 fixture");
        assert_eq!(
            keys.scan_secret.as_ref(),
            &[
                0x6b, 0xa4, 0xf4, 0x6e, 0x16, 0xc4, 0x5b, 0xdb, 0x61, 0xdf, 0x96, 0x2c, 0x46, 0x6a,
                0xa9, 0x51, 0x23, 0xcf, 0xa6, 0x65, 0xfc, 0xb9, 0xbe, 0x72, 0x44, 0xc0, 0x12, 0x06,
                0x86, 0xfb, 0x14, 0x82,
            ]
        );
        assert_eq!(
            derive_receiver_keys(mnemonic, PUBLIC_FIXTURE_PASSPHRASE, Network::Mainnet, 0)
                .expect("same fixture")
                .spend_public_key,
            {
                let secret = [
                    0x12, 0x7d, 0x4b, 0xe8, 0xb3, 0xf7, 0x9e, 0x02, 0x3c, 0xa6, 0xe6, 0xf6, 0x7e,
                    0x33, 0x88, 0x5d, 0x77, 0xa6, 0x3e, 0x7a, 0x55, 0x22, 0x23, 0x23, 0x4f, 0x8e,
                    0x57, 0x18, 0x0c, 0xe2, 0x42, 0x84,
                ];
                PublicKey::from_secret_key(
                    &Secp256k1::new(),
                    &SecretKey::from_byte_array(&secret).expect("fixture spend secret"),
                )
                .serialize()
            }
        );
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
