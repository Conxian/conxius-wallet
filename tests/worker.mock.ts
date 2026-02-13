export class MockWorker {
  onmessage: (e: any) => void = () => {};
  onerror: (e: any) => void = () => {};

  constructor(stringUrl: string | URL, options?: WorkerOptions) {
    // Simulate worker loading
  }

  postMessage(data: any) {
    // Simulate the worker's onmessage logic in crypto.worker.ts
    // We can use the actual logic or a mock.
    // For now, let's just bypass and call back directly if possible,
    // but the worker manager expects async.
  }

  terminate() {}
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() { return true; }
}

if (typeof globalThis !== 'undefined') {
  (globalThis as any).Worker = MockWorker;
}
