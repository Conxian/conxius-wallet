/**
* @vitest-environment jsdom
*/
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppContext, initialAppState } from '../context';
import StackingManager from '../components/StackingManager';

const stackingMocks = vi.hoisted(() => ({
  estimateStackingApy: vi.fn(),
  fetchPoxInfo: vi.fn(),
  fetchRewardHistory: vi.fn(),
  fetchStackerInfo: vi.fn(),
}));

vi.mock('../services/stacking', () => stackingMocks);

const originalResizeObserver = globalThis.ResizeObserver;
const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;

const restoreGlobal = (key: string, value: unknown) => {
  if (value === undefined) {
    Reflect.deleteProperty(globalThis, key);
    return;
  }

  Object.defineProperty(globalThis, key, {
    configurable: true,
    writable: true,
    value,
  });
};

class FixedResizeObserver {
  private readonly callback: ResizeObserverCallback;
  private active = true;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe(target: Element) {
    const rect = target.getBoundingClientRect();
    const entry = {
      target,
      contentRect: { width: rect.width, height: rect.height },
    } as ResizeObserverEntry;

    queueMicrotask(() => {
      if (this.active) this.callback([entry], this as unknown as ResizeObserver);
    });
  }

  unobserve() {}

  disconnect() {
    this.active = false;
  }
}

const renderStacking = () =>
  render(
    <AppContext.Provider
      value={
        {
          state: { ...initialAppState, language: 'en' },
          notify: vi.fn(),
        } as never
      }
    >
      <StackingManager />
    </AppContext.Provider>,
  );

const getChartSurface = () =>
  document.querySelector<SVGSVGElement>('svg.recharts-surface[role="application"]');

const waitForChartSurface = async (): Promise<SVGSVGElement> => {
  await waitFor(
    () => {
      expect(getChartSurface()).not.toBeNull();
    },
    { timeout: 5000 },
  );
  const surface = getChartSurface();
  if (!surface) {
    throw new Error('Expected a Recharts chart surface');
  }
  return surface;
};

describe('real Recharts SVG rendering', () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, 'ResizeObserver', {
      configurable: true,
      writable: true,
      value: FixedResizeObserver,
    });

    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
      const isTextMeasurement = this.id === 'recharts_measurement_span';
      const measuredTextWidth = Math.max((this.textContent?.length ?? 0) * 8, 8);
      return {
        bottom: 256,
        height: isTextMeasurement ? 16 : 256,
        left: 0,
        right: isTextMeasurement ? measuredTextWidth : 640,
        top: 0,
        width: isTextMeasurement ? measuredTextWidth : 640,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      };
    };

    globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(performance.now()), 16)) as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = ((handle: number) => {
      window.clearTimeout(handle);
    }) as typeof cancelAnimationFrame;
  });

  afterAll(() => {
    restoreGlobal('ResizeObserver', originalResizeObserver);
    HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    restoreGlobal('requestAnimationFrame', originalRequestAnimationFrame);
    restoreGlobal('cancelAnimationFrame', originalCancelAnimationFrame);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    stackingMocks.estimateStackingApy.mockResolvedValue(0);
    stackingMocks.fetchPoxInfo.mockResolvedValue({
      currentCycle: 123,
      nextCycleIn: 42,
      totalStacked: 1_000_000,
      rewardSlots: 4000,
      minThreshold: 125_000_000_000,
      blocksPerCycle: 2100,
      currentBurnBlockHeight: 873042,
    });
    stackingMocks.fetchRewardHistory.mockResolvedValue([]);
    stackingMocks.fetchStackerInfo.mockResolvedValue({
      isStacking: false,
      amountStacked: 0,
      lockPeriod: 0,
      unlockHeight: 0,
      poxAddress: '',
      rewardCycleStart: 0,
    });
  });

  it('renders a named empty chart with its fallback tick and no area curve', async () => {
    renderStacking();

    const surface = await waitForChartSurface();

    expect(surface).toHaveAttribute('tabindex', '0');
    expect(surface.querySelector('title')).toHaveTextContent('Yield Performance');
    expect(surface.querySelector('desc')).toHaveTextContent('BTC rewards earned per stacking cycle.');
    expect(surface).toHaveAccessibleName('Yield Performance');
    expect(surface).toHaveAccessibleDescription('BTC rewards earned per stacking cycle.');
    expect(surface).toHaveTextContent('—');
    expect(surface.querySelector('.recharts-area-curve')).toBeNull();
  });

  it('renders deterministic reward labels and non-empty Area paths', async () => {
    const rewardHistory = [
      { cycle: '#301', btc: 0.0012, date: 'Jul 20' },
      { cycle: '#302', btc: 0.0015, date: 'Jul 21' },
      { cycle: '#303', btc: 0.0018, date: 'Jul 22' },
    ];
    stackingMocks.fetchRewardHistory.mockResolvedValue(rewardHistory);

    renderStacking();

    await waitForChartSurface();
    await waitFor(() => {
      const surface = getChartSurface();
      expect(surface).not.toBeNull();
      if (!surface) {
        return;
      }
      expect(surface).toHaveTextContent('#301');
      expect(surface).toHaveTextContent('#302');
      expect(surface).toHaveTextContent('#303');
      expect(surface.querySelector('.recharts-area-curve')).not.toBeNull();
      expect(surface.querySelector('.recharts-area-area')).not.toBeNull();
    }, { timeout: 5000 });

    const surface = getChartSurface();
    expect(surface).not.toBeNull();
    expect(surface?.querySelector('.recharts-area-curve')).toHaveAttribute('d');
    expect(surface?.querySelector('.recharts-area-area')).toHaveAttribute('d');
    expect(surface?.querySelector('.recharts-area-curve')?.getAttribute('d')).not.toBe('');
    expect(surface?.querySelector('.recharts-area-area')?.getAttribute('d')).not.toBe('');
  });
});
