const sensitivePatterns = [
    /stack/i, /at /i, /node_modules/i, /(?<![a-zA-Z0-9])0x[a-fA-F0-9]{40}(?![a-zA-Z0-9])/i,
    /rpc/i, /internal/i, /database/i, /query/i, /connect/i, /__/,
    /(?<![a-zA-Z0-9])(([a-z]{3,}[\s\W_0-9]+){11,23}[a-z]{3,})(?![a-zA-Z0-9])/i,
    /(?<![a-zA-Z0-9])([a-z]{3,}){12}(?![a-zA-Z0-9])/i,
    /(?<![a-zA-Z0-9])((?:0x)?(?:[a-fA-F0-9]{64,66}|[a-fA-F0-9]{128}))(?![a-zA-Z0-9])/i,
    /(?<![a-zA-Z0-9])([xtuvyz](?:pub|prv)[1-9A-HJ-NP-Za-km-z]{50,110})(?![a-zA-Z0-9])/i,
    /(?<![a-zA-Z0-9])(bc1[qp][a-z0-9]{33,58}|[13][a-km-zA-NP-Z1-9]{25,39}|tb1[qp][a-z0-9]{33,58}|[mn2][a-km-zA-NP-Z1-9]{25,39})(?![a-zA-Z0-9])/i,
    /(?<![a-zA-Z0-9])(S[PST][0-9A-Z]{28,41})(?![a-zA-Z0-9])/i,
    /(?<![a-zA-Z0-9])((?:lq|tlq|elq)1[qp][a-z0-9]{38,110})(?![a-zA-Z0-9])/i,
    /(?<![a-zA-Z0-9])(nsec1[a-z0-9]{50,200}|npub1[a-z0-9]{50,200})(?![a-zA-Z0-9])/i,
    /(?<![a-zA-Z0-9])(sp1[a-z0-9]{50,200})(?![a-zA-Z0-9])/i,
    /(?<![a-zA-Z0-9])[5KL9c][1-9A-HJ-NP-Za-km-z]{50,51}(?![a-zA-Z0-9])/i,
    /(?<![a-zA-Z0-9])(ln(?:bc|tb|bcrt|dev)[0-9a-z]+)(?![a-zA-Z0-9])/i,
    /(?<![a-zA-Z0-9])AIzaSy[a-zA-Z0-9_-]{33}(?![a-zA-Z0-9])/i,
    /(?<![a-zA-Z0-9])sk-[a-zA-Z0-9_-]{20,}(?![a-zA-Z0-9])/i
];
const input = "Invalid address";
sensitivePatterns.forEach(p => {
    if (p.test(input)) console.log("Matched:", p);
});
const errorObj = { message: "Invalid address" };
const fullScan = JSON.stringify(errorObj);
sensitivePatterns.forEach(p => {
    if (p.test(fullScan)) console.log("Scan Matched:", p);
});
