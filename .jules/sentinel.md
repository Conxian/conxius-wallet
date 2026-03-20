## 2026-05-24 - [Medium] Security Bypass in Error Sanitization via Nested Objects and Obfuscation
**Vulnerability:** The `sanitizeError` utility used `JSON.stringify` for scanning complex error objects, which fails to include non-enumerable properties like `message` and `stack` on native `Error` objects. Furthermore, the scanner did not normalize the `message` string before pattern matching, allowing attackers to bypass redaction using Zero-Width Characters (ZWCs).
**Learning:** Standard serialization (`JSON.stringify`) is insufficient for security-critical inspection of `Error` objects because it ignores their most sensitive properties. Additionally, visual masking via ZWCs can effectively hide secrets from regex-based scanners while remaining semantic to the underlying system or LLM.
**Prevention:** Always use a custom replacer in `JSON.stringify` to explicitly map non-enumerable `Error` properties into a serializable format. Mandatory normalization (stripping ZWCs) must be performed on all candidate strings before sensitive pattern matching.

## 2026-03-08 - [Medium] Redaction Gap for 64-byte (128-char) Hex Seeds
**Vulnerability:** The AI security layer's `hexRegex` only targeted 32-byte identifiers (64 or 66 characters including `0x`), failing to redact the 64-byte master seeds (128 hex characters) used by the TypeScript fallback signer.
**Learning:** Security filters must be aligned with the specific lengths of ALL sensitive cryptographic material used in the app, not just standard 32-byte hashes or keys. Master seeds are often twice as long as standard keys.
**Prevention:** Explicitly include 128-character patterns in hex redaction filters and ensure they are tested against both purely numeric and alphabetic hex strings.
