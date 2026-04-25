// @ts-nocheck
export const workerManager = {
    derivePath: async (seed: string, path: string, network: string) => {
        return {
            address: 'bc1q_mock_worker_address',
            publicKey: 'mock_worker_pubkey',
            privateKey: 'mock_worker_privkey'
        };
    }
};
