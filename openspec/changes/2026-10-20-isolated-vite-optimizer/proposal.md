# Isolate Vite dependency optimizer modernization

Parent: Wallet #357; preservation source: #756. Current #756 head includes unrelated policy and audit-exception changes. Preserve its useful Vite 8 optimizer correction in a narrow independent candidate based on current dev, without rewriting or deleting its source history.

Remove deprecated optimizeDeps.esbuildOptions while retaining the explicit json-bigint and algosdk optimizer include list. Preserve the corresponding baseline-report note. Keep branch-promotion scripts/tests, audit exception records, all dependency manifests/locks and native/MSRV settings byte-identical to dev. The baseline report is historical context, not fresh release or audit acceptance.

Validate actual Vite configuration behavior in hosted web/unit/E2E lanes, run existing promotion conformance and check tree scope. Existing dependency-audit failures must remain visible; no exception renewal or approval is authorized by this optimizer change. Require fresh exact-head checks and genuine independent review before dev integration; normal staged/main and device/release acceptance remain separate. Keep #756 and its unique records until useful-source retention and successor acceptance are verified.
