import { Web5 } from '@web5/api';
import { getDerivedSecretNative } from './enclave-storage';

/**
 * Web5 Service for Conxius Wallet
 * Integrates TBD Web5 SDK for Decentralized Identifiers (DID)
 * and Decentralized Web Nodes (DWN).
 */
export class Web5Service {
    private static instance: Web5Service;
    private web5: any = null;
    private did: string = '';
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
     * Uses the Secure Enclave for key management via a custom KeyManager if possible,
     * or defaults to the Web5 built-in KeyManager for the initial implementation.
     */
    async connect(): Promise<{ web5: any; did: string }> {
        if (this.web5 && this.did) {
            return { web5: this.web5, did: this.did };
        }

        if (this.isConnecting) {
            // Wait for existing connection attempt
            while (this.isConnecting) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            return { web5: this.web5, did: this.did };
        }

        this.isConnecting = true;
        try {
            console.log("[Web5] Connecting...");

            // In a production environment, we would use a custom KeyManager
            // that calls getDerivedSecretNative. For this phase, we use
            // the default Web5 KeyManager which handles its own local storage.
            const { web5, did } = await Web5.connect({
                sync: 'on'
            });

            this.web5 = web5;
            this.did = did;
            console.log("[Web5] Connected with DID:", did);
            return { web5, did };
        } catch (error) {
            console.error("[Web5] Connection failed:", error);
            throw error;
        } finally {
            this.isConnecting = false;
        }
    }

    /**
     * Creates a record in the user's DWN.
     */
    async createRecord(data: any, schema: string): Promise<any> {
        const { web5 } = await this.connect();
        const { record } = await web5.dwn.records.create({
            data,
            message: {
                schema,
                dataFormat: 'application/json'
            }
        });
        return record;
    }

    /**
     * Reads all records for a specific schema from the user's DWN.
     */
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

    /**
     * Updates an existing record in the DWN.
     */
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

    /**
     * Deletes a record from the DWN.
     */
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

    /**
     * Returns the current DID.
     */
    async getDid(): Promise<string> {
        if (!this.did) {
            await this.connect();
        }
        return this.did;
    }
}
