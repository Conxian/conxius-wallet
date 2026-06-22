import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fdc3Service, FDC3Context } from '../services/fdc3';

// Mock Capacitor Fdc3 plugin
const mockRaiseIntent = vi.fn().mockResolvedValue(undefined);
const mockBroadcast = vi.fn().mockResolvedValue(undefined);

vi.mock('@capacitor/core', () => ({
  registerPlugin: vi.fn().mockReturnValue({
    raiseIntent: (args: any) => mockRaiseIntent(args),
    broadcast: (args: any) => mockBroadcast(args)
  })
}));

describe('FDC3 Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockContext: FDC3Context = {
    type: 'fdc3.instrument',
    name: 'Bitcoin',
    id: { ticker: 'BTC' }
  };

  it('should raise an intent correctly', async () => {
    await fdc3Service.raiseIntent('VIEW_INSTRUMENT', mockContext);

    expect(mockRaiseIntent).toHaveBeenCalledWith({
      intent: 'VIEW_INSTRUMENT',
      context: mockContext
    });
  });

  it('should broadcast context correctly', async () => {
    await fdc3Service.broadcast(mockContext);

    expect(mockBroadcast).toHaveBeenCalledWith({
      context: mockContext
    });
  });
});
