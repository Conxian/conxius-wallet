import { describe, it, expect, vi } from "vitest";
import { signB2bInvoice } from "../services/monetization";
import { signAuthorizedValueOperation } from "../services/app-private/value-operation-signer";
import { ValueOperationAuthorizer } from '../services/value-operation';
import { createAppPrivateValueOperationAuthority } from '../services/app-private/value-operation-authority';

const rejectAuthorization: ValueOperationAuthorizer = async (request) =>
    createAppPrivateValueOperationAuthority('test-vault').reject(request);

vi.mock("../services/app-private/value-operation-signer", () => ({
    signAuthorizedValueOperation: vi.fn().mockResolvedValue({
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
        expect(signAuthorizedValueOperation).not.toHaveBeenCalled();
    });
});
