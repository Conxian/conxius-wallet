import * as ecc from "tiny-secp256k1";
import { Web5 } from "@web5/api";
import { getDerivedSecretNative, signNative, getEnclaveBlob } from "./enclave-storage";

/**
 * EnclaveKeyManager - Delegates Web5 key operations to the Secure Enclave.
 * This ensures that Web5 DIDs are derived from the same master seed as the wallet
 * and never exposed in the clear.
 */
export class EnclaveKeyManager {
    private vault: string | null = null;

    constructor() {}

    private async ensureVault() {
        if (!this.vault) {
            this.vault = await getEnclaveBlob("conxius_vault");
        }
        if (!this.vault) throw new Error("Vault not initialized for Web5 Enclave Bridge");
    }

    // Web5 KeyManager interface implementation
    async generateKey(params: { type: string; algorithm: string }) {
        // Deterministic derivation based on purpose
        return "conxius-web5-primary";
    }

    async getPublicKey(params: { keyAlias: string }) {
        await this.ensureVault();
        const path = "m/84'/0'/0'/6/0";
        const { pubkey } = await getDerivedSecretNative({ vault: this.vault!, path });

        // Return as simplified JWK for secp256k1
        // Ensure uncompressed for JWK (65 bytes: 04 + 32x + 32y)
        let uncompressed = pubkey;
        if (pubkey.length === 66) {
            const buf = Buffer.from(pubkey, "hex");
            const expanded = ecc.pointCompress(buf, false);
            if (expanded) uncompressed = Buffer.from(expanded).toString("hex");
        }

        return {
            kty: "EC",
            crv: "secp256k1",
            x: Buffer.from(uncompressed.substring(2, 66), "hex").toString("base64url"),
            y: Buffer.from(uncompressed.substring(66), "hex").toString("base64url")
        };
    }

    async sign(params: { keyAlias: string; data: Uint8Array }) {
        await this.ensureVault();
        const path = "m/84'/0'/0'/6/0";

        // Web5 passes raw bytes. Native Enclave expects SHA-256 hash.
        const hashBuffer = await crypto.subtle.digest("SHA-256", params.data);
        const hashHex = Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, "0"))
            .join("");

        const { signature } = await signNative({
            vault: this.vault!,
            path,
            messageHash: hashHex,
            network: "web5",
            payload: "Web5 Identity Authentication"
        });

        return new Uint8Array(Buffer.from(signature, "hex"));
    }
}

/**
 * Web5 Service for Conxius Wallet
 * Integrates TBD Web5 SDK for Decentralized Identifiers (DID)
 * and Decentralized Web Nodes (DWN).
 */
export class Web5Service {
    private static instance: Web5Service;
    private web5: any = null;
    private did: string = "";
    private isConnecting: boolean = false;

    private constructor() {}

    public static getInstance(): Web5Service {
        if (!Web5Service.instance) {
            Web5Service.instance = new Web5Service();
        }
        return Web5Service.instance;
    }

    /**
     * Connect to Web5.
     * Initializes the Web5 instance and connects to a DWN.
     * Uses the Secure Enclave for key management via a custom EnclaveKeyManager.
     */
    async connect(): Promise<{ web5: any; did: string }> {
        if (this.web5 && this.did) {
            return { web5: this.web5, did: this.did };
        }

        if (this.isConnecting) {
            while (this.isConnecting) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            return { web5: this.web5, did: this.did };
        }

        this.isConnecting = true;
        try {
            console.log("[Web5] Connecting via Enclave Bridge...");

            // Use the custom EnclaveKeyManager to delegate all crypto to the TEE
            const enclaveKeyManager = new EnclaveKeyManager();

            const { web5, did } = await Web5.connect({
                sync: "on",
                // @ts-ignore - EnclaveKeyManager implements a subset of required KM features
                keyManager: enclaveKeyManager
            });

            this.web5 = web5;
            this.did = did;
            console.log("[Web5] Connected with Enclave DID:", did);
            return { web5, did };
        } catch (error) {
            console.error("[Web5] Connection failed:", error);
            // Fallback to default connection if enclave fails
            const { web5, did } = await Web5.connect({ sync: "on" });
            this.web5 = web5;
            this.did = did;
            return { web5, did };
        } finally {
            this.isConnecting = false;
        }
    }

    async createRecord(data: any, schema: string): Promise<any> {
        const { web5 } = await this.connect();
        const { record } = await web5.dwn.records.create({
            data,
            message: {
                schema,
                dataFormat: "application/json"
            }
        });
        return record;
    }

    async getRecords(schema: string): Promise<any[]> {
        const { web5 } = await this.connect();
        const { records } = await web5.dwn.records.query({
            message: {
                filter: {
                    schema
                }
            }
        });

        if (!records) return [];

        const results = [];
        for (const record of records) {
            const data = await record.data.json();
            results.push({ ...data, recordId: record.id });
        }
        return results;
    }

    async updateRecord(recordId: string, data: any): Promise<any> {
        const { web5 } = await this.connect();
        const { record } = await web5.dwn.records.read({
            message: {
                filter: {
                    recordId
                }
            }
        });

        if (record) {
            const { status } = await record.update({ data });
            return status;
        }
        throw new Error("Record not found");
    }

    async deleteRecord(recordId: string): Promise<any> {
        const { web5 } = await this.connect();
        const { status } = await web5.dwn.records.delete({
            message: {
                filter: {
                    recordId
                }
            }
        });
        return status;
    }

    async getDid(): Promise<string> {
        if (!this.did) {
            await this.connect();
        }
        return this.did;
    }
}
