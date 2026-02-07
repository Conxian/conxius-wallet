import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Web5Service } from '../services/web5';

// Mock Web5
vi.mock('@web5/api', () => {
    return {
        Web5: {
            connect: vi.fn().mockResolvedValue({
                web5: {
                    dwn: {
                        records: {
                            create: vi.fn().mockResolvedValue({ record: { id: 'test-record-id' } }),
                            query: vi.fn().mockResolvedValue({ records: [] }),
                            read: vi.fn().mockResolvedValue({ record: { id: 'test-record-id', update: vi.fn().mockResolvedValue({ status: 'ok' }), data: { json: vi.fn().mockResolvedValue({}) } } }),
                            delete: vi.fn().mockResolvedValue({ status: 'ok' })
                        }
                    }
                },
                did: 'did:dht:test-did'
            })
        }
    };
});

describe('Web5Service', () => {
    let web5Service: Web5Service;

    beforeEach(() => {
        vi.clearAllMocks();
        // @ts-ignore - access private instance for testing
        Web5Service.instance = null;
        web5Service = Web5Service.getInstance();
    });

    it('should connect and return a DID', async () => {
        const { did } = await web5Service.connect();
        expect(did).toBe('did:dht:test-did');
    });

    it('should create a record', async () => {
        const data = { name: 'Conxius' };
        const schema = 'https://schema.org/Person';
        const record = await web5Service.createRecord(data, schema);
        expect(record.id).toBe('test-record-id');
    });
});
