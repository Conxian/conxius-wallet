const { sanitizeError } = require('../services/network.js'); // Note: this might fail if running directly via node without build
const secret = ["bc1q", "xy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"].join("");
const fallback = 'Fallback';

console.log("Testing Con-305 Statefulness Fix...");

const longStr = "A".repeat(100) + secret;
const res1 = sanitizeError(longStr, fallback);
console.log("Call 1 (Long string with secret):", res1 === fallback ? "PASS" : "FAIL");

const res2 = sanitizeError(secret, fallback);
console.log("Call 2 (Secret only):", res2 === fallback ? "PASS" : "FAIL");

if (res1 === fallback && res2 === fallback) {
    console.log("VERIFIED: sanitizeError is no longer stateful.");
} else {
    console.log("FAILED: sanitizeError still exhibits stateful behavior.");
    process.exit(1);
}
