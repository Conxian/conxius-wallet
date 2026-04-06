const sensitivePatterns = [
    /stack/i, /at /i, /node_modules/i, /(?<![a-zA-Z0-9])0x[a-fA-F0-9]{40}(?![a-zA-Z0-9])/i,
    /rpc/i, /internal/i, /database/i, /query/i, /connect/i, /__/
];
const msg = "Invalid address";
sensitivePatterns.forEach(p => {
    if (p.test(msg)) console.log("Matched:", p);
});
