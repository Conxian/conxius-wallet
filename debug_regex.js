import { SENSITIVE_SCAN_PATTERNS } from './services/security-constants.js';
const msg = "Trust Policy Violation: T2 (Hybrid) requires hardened configuration for wormhole_ntt.";
console.log("Testing message:", msg);
SENSITIVE_SCAN_PATTERNS.forEach((p, i) => {
  if (p.test(msg)) {
    console.log("Matched pattern index:", i, p.toString());
  }
});
