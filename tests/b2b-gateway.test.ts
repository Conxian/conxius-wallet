import { describe, it, expect, vi } from "vitest";
import { signB2bInvoice } from "../services/monetization";
import { requestEnclaveSignature } from "../services/signer";

vi.mock("../services/signer", () => ({
    requestEnclaveSignature: vi.fn().mockResolvedValue({
        signature: "b2b_sig_enclave_hex",
        pubkey: "02instit",
        timestamp: Date.now()
    })
}));

describe("B2B Gateway Integration", () => {
    it("quarantines value-bearing invoice authorization without authoritative evidence", async () => {
        const id = "inv_corporate_001";
        const amount = 1000000;

        await expect(signB2bInvoice(id, amount, 'BTC', 'corporate_vault'))
            .rejects.toThrow('MISSING_AUTHORITATIVE_EVIDENCE');
        expect(requestEnclaveSignature).not.toHaveBeenCalled();
    });
});
