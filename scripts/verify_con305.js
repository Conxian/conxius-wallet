import { SENSITIVE_SCAN_PATTERNS } from '../services/security-constants.js';

// Minimal verification of non-statefulness
const secret = "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh";
const longStr = "A".repeat(100) + secret;

const btcScanner = SENSITIVE_SCAN_PATTERNS.find(p => p.source.includes("bc1"));

console.log("Testing with long string:");
console.log("Result 1:", btcScanner.test(longStr));
console.log("lastIndex:", btcScanner.lastIndex);

console.log("\nTesting with secret directly:");
console.log("Result 2:", btcScanner.test(secret));
console.log("lastIndex:", btcScanner.lastIndex);

if (btcScanner.test(longStr) && btcScanner.test(secret)) {
    console.log("\nSUCCESS: Patterns are consistent and non-stateful.");
} else {
    console.log("\nFAILURE: Patterns failed consistency check.");
    process.exit(1);
}
