import { registerPlugin } from '@capacitor/core';

export interface FDC3Context {
  type: string;
  name?: string;
  id?: { [key: string]: string };
}

export interface Fdc3Plugin {
  raiseIntent(options: { intent: string, context: FDC3Context }): Promise<void>;
  broadcast(options: { context: FDC3Context }): Promise<void>;
}

const Fdc3 = registerPlugin<Fdc3Plugin>('Fdc3');

/**
 * FDC3 Service
 * Bridges financial intents between corporate treasury apps and the wallet.
 * Aligned with v1.9.2 Native Resolver (CON-1181).
 */
export const fdc3Service = {
  /**
   * Raises an FDC3 intent to be handled by a native Android application.
   */
  raiseIntent: async (intent: string, context: FDC3Context): Promise<void> => {
    console.log(`[FDC3] Raising intent: ${intent}`, context);
    return Fdc3.raiseIntent({ intent, context });
  },

  /**
   * Broadcasts context to other FDC3-aware applications.
   */
  broadcast: async (context: FDC3Context): Promise<void> => {
    console.log('[FDC3] Broadcasting context', context);
    return Fdc3.broadcast({ context });
  }
};
