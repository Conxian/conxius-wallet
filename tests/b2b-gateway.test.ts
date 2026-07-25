import { describe, it, expect, vi } from "vitest";
import { signB2bInvoice } from "../services/monetization";
import { signAuthorizedValueOperation } from "../services/app-private/value-operation-signer";
import { ValueOperationAuthorizer, ValueOperationRequest } from '../services/value-operation';
import { createAppPrivateValueOperationAuthority } from '../services/app-private/value-operation-authority';

const rejectionAuthority = createAppPrivateValueOperationAuthority('test-vault');
const rejectAuthorization: ValueOperationAuthorizer = Object.assign(
    async (request: ValueOperationRequest) => rejectionAuthority.reject(request),
    { consumer: rejectionAuthority.consumer },
);

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
