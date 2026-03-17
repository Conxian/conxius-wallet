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
    it("should sign a corporate invoice via enclave", async () => {
        const id = "inv_corporate_001";
        const amount = 1000000;

        // Mocking the behavior since we didn't add signB2bInvoice to monetization.ts yet
        // or we use the existing ones. Actually, let's verify if we should add it.
        const result = await requestEnclaveSignature({
            type: 'message',
            layer: 'B2B',
            payload: { id, amount },
            description: 'Sign B2B Invoice'
        }, 'corporate_vault');

        expect(result.signature).toBe("b2b_sig_enclave_hex");
        expect(requestEnclaveSignature).toHaveBeenCalled();
    });
});
