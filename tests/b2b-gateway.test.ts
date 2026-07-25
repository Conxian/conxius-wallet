import { describe, it, expect, vi } from "vitest";
import { signB2bInvoice } from "../services/monetization";
import { requestEnclaveSignature } from "../services/signer";
import { createWalletValueOperationGate, ValueOperationAuthorizer } from '../services/value-operation';

const rejectAuthorization: ValueOperationAuthorizer = async (request) =>
    createWalletValueOperationGate('test-vault').reject(request);

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

        await expect(signB2bInvoice(id, amount, 'BTC', rejectAuthorization))
            .rejects.toThrow('USER_REJECTED');
        expect(requestEnclaveSignature).not.toHaveBeenCalled();
    });
});
