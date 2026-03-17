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

    it("should initiate a transfer and call the enclave", async () => {
        const transfer = {
            assetId: "tap:123",
            amount: 100n,
            recipientAddr: "taproot_addr_abc"
        };
        const txid = await transferTaprootAsset(transfer, "test_vault");

        expect(txid).toContain("taproot_txid_");
        expect(requestEnclaveSignature).toHaveBeenCalled();
    });
});
