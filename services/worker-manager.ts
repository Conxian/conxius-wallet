// @ts-nocheck
export class WorkerManager {
    private worker: Worker | null = null;

    constructor() {
        if (typeof window !== 'undefined' && window.Worker) {
            this.worker = new Worker(new URL('./crypto.worker.ts', import.meta.url), { type: 'module' });
        }
    }

    async derivePath(seed: Uint8Array | string, path: string, network: string = 'mainnet'): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this.worker) return reject(new Error("Worker not available"));

            const handleMessage = (e: MessageEvent) => {
                this.worker?.removeEventListener('message', handleMessage);
                if (e.data.type === 'SUCCESS') resolve(e.data.result);
                else reject(new Error(e.data.error));
            };

            const seedHex = seed instanceof Uint8Array ? Buffer.from(seed).toString('hex') : seed;

            this.worker.addEventListener('message', handleMessage);
            this.worker.postMessage({ type: 'DERIVE_ADDRESS', payload: { seed: seedHex, path, network } });
        });
    }
}

export const workerManager = new WorkerManager();
