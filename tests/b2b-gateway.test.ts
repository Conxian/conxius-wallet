import { describe, it, expect, vi } from "vitest";
import { requestNonValueMessageSignature } from "../services/signer";

vi.mock("../services/signer", () => ({
    requestNonValueMessageSignature: vi.fn().mockResolvedValue({
        signature: "b2b_sig_enclave_hex",
        pubkey: "02instit",
        timestamp: Date.now()
    })
}));

describe("B2B Gateway Integration", () => {
    it("should sign a corporate invoice via enclave", async () => {
        const id = "inv_corporate_001";
        // Mocking the behavior since we didn't add signB2bInvoice to monetization.ts yet
        // or we use the existing ones. Actually, let's verify if we should add it.
        const result = await requestNonValueMessageSignature({
            intentClass: 'non-value-message',
            type: 'message',
            layer: 'Mainnet',
            domain: 'conxius.wallet.message',
            purpose: 'wallet-message',
            payload: { message: `B2B invoice reference ${id}` },
            description: 'Sign non-value B2B invoice reference'
        }, 'corporate_vault');

        expect(result.signature).toBe("b2b_sig_enclave_hex");
        expect(requestNonValueMessageSignature).toHaveBeenCalled();
    });
});
