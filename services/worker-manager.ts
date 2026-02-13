/**
 * Worker Manager
 * Singleton interface for the Persistent Crypto Worker.
 */
class WorkerManager {
  private static instance: WorkerManager;
  private worker: Worker | null = null;
  private nextId = 0;
  private callbacks = new Map<number, { resolve: Function; reject: Function }>();

  private constructor() {
    if (typeof window !== 'undefined') {
      try {
        this.initWorker();
      } catch (e) {
        console.error('[WorkerManager] Failed to initialize worker:', e);
      }
    }
  }

  public static getInstance(): WorkerManager {
    if (!WorkerManager.instance) {
      WorkerManager.instance = new WorkerManager();
    }
    return WorkerManager.instance;
  }

  private initWorker() {
    // In a Vite environment, we use the ?worker suffix or new URL()
    try {
      this.worker = new Worker(new URL('./crypto.worker.ts', import.meta.url), {
        type: 'module'
      });

      this.worker.onmessage = (e) => {
        const { id, result, error } = e.data;
        const cb = this.callbacks.get(id);
        if (cb) {
          this.callbacks.delete(id);
          if (error) cb.reject(new Error(error));
          else cb.resolve(result);
        }
      };

      this.worker.onerror = (e) => {
        console.error('[WorkerManager] Worker error:', e);
      };
    } catch (e) {
      console.error('[WorkerManager] Worker creation failed:', e);
    }
  }

  private postTask(type: string, payload: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        // Fallback or error
        reject(new Error('Worker not initialized'));
        return;
      }
      const id = this.nextId++;
      this.callbacks.set(id, { resolve, reject });
      this.worker.postMessage({ id, type, payload });
    });
  }

  public async deriveSeed(mnemonic: string, passphrase = ''): Promise<Uint8Array> {
    try {
      return await this.postTask('DERIVE_SEED', { mnemonic, passphrase });
    } catch (e) {
      // Fallback to main thread if worker fails
      const bip39 = await import('bip39');
      const seed = await bip39.mnemonicToSeed(mnemonic, passphrase);
      return new Uint8Array(seed);
    }
  }

  public async derivePath(seed: Uint8Array, path: string): Promise<{ publicKey: string; privateKey?: string }> {
    try {
      return await this.postTask('DERIVE_PATH', { seed, path });
    } catch (e) {
      // Fallback to main thread
      const { BIP32Factory } = await import('bip32');
      const ecc = await import('tiny-secp256k1');
      const bip32 = BIP32Factory(ecc);
      const root = bip32.fromSeed(Buffer.from(seed));
      const child = root.derivePath(path);
      return {
        publicKey: child.publicKey.toString('hex'),
        privateKey: child.privateKey?.toString('hex')
      };
    }
  }

  public async clearCache(): Promise<void> {
    if (!this.worker) return;
    try {
      await this.postTask('CLEAR_CACHE', {});
    } catch (e) {
      console.warn('[WorkerManager] Clear cache failed:', e);
    }
  }
}

export const workerManager = WorkerManager.getInstance();
