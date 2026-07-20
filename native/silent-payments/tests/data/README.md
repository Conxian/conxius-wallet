# Official BIP-352 test data

`send_and_receive_test_vectors.json` is copied from the Bitcoin BIPs repository at the pinned
revision below; do not replace it with self-generated expected values:

- Revision: `8c369ac8e60629ac6c032ffe21bb5ec5b35213d7`
- Source: <https://raw.githubusercontent.com/bitcoin/bips/8c369ac8e60629ac6c032ffe21bb5ec5b35213d7/bip-0352/send_and_receive_test_vectors.json>
- Specification: <https://github.com/bitcoin/bips/blob/8c369ac8e60629ac6c032ffe21bb5ec5b35213d7/bip-0352.mediawiki>
- SHA-256: `f5f9ed4afd76a1b76f3c70b1cbe67532f89abbe559f8e02d7fc3d8ecb93af4a1`

The fixture is consumed directly by `tests/official_bip352.rs`. Because receiver vectors provide
the cryptographic transaction/output material rather than complete wallet UTXO metadata, the
test adapter adds deterministic synthetic outpoint/value metadata only where the Rust API needs
it to verify mapping passthrough.
