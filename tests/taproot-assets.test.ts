import { describe, it, expect, vi } from "vitest";
import { discoverTaprootAssets, transferTaprootAsset } from "../services/taproot-assets";
import { requestEnclaveSignature } from "../services/signer";

vi.mock("../services/signer", () => ({
    requestEnclaveSignature: vi.fn().mockResolvedValue({
        signature: "taproot_sig_1234567890abcdef",
        pubkey: "02abcdef",
        timestamp: Date.now()
    })
}));

describe("Taproot Assets Service", () => {
    it("should discover assets", async () => {
        const assets = await discoverTaprootAssets();
        expect(assets.length).toBeGreaterThan(0);
        expect(assets[0].name).toBe("Citadel Credits");
    });

    it("quarantines transfer and never derives a signature-shaped txid", async () => {
        const transfer = {
            assetId: "tap:123",
            amount: 100n,
            recipientAddr: "taproot_addr_abc"
        };
        await expect(transferTaprootAsset(transfer, "test_vault"))
            .rejects.toThrow('MISSING_AUTHORITATIVE_EVIDENCE');
        expect(requestEnclaveSignature).not.toHaveBeenCalled();
    });
});
