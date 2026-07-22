/**
* @vitest-environment jsdom
*/
import type { ReactNode } from 'react';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppContext, initialAppState } from '../context';
import Benchmarking from '../components/Benchmarking';
import ReserveSystem from '../components/ReserveSystem';
import StackingManager from '../components/StackingManager';

type MockChartProps = {
  children?: ReactNode;
  data?: unknown;
  dataKey?: string;
  name?: string;
};

vi.mock('recharts', async () => {
  const { Children, createElement } = await import('react');
  const serialize = (value: unknown) => (value === undefined ? undefined : JSON.stringify(value));
  const leaf = (testId: string) => ({ children }: MockChartProps) =>
    createElement('div', { 'data-testid': testId }, children);
  const dataChart = (testId: string) => ({ data, children }: MockChartProps) =>
    createElement(
      'div',
      { 'data-testid': testId, 'data-chart-data': serialize(data) },
      Children.toArray(children).filter((child) => {
        if (typeof child !== 'object' || child === null || !('type' in child)) return true;
        return child.type !== 'defs';
      }),
    );
  const keyed = (testId: string) => ({ dataKey, children }: MockChartProps) =>
    createElement('div', { 'data-testid': testId, 'data-data-key': dataKey }, children);
  const namedKeyed = (testId: string) => ({ dataKey, name, children }: MockChartProps) =>
    createElement('div', { 'data-testid': testId, 'data-data-key': dataKey, 'data-name': name }, children);

  return {
    Area: keyed('area'),
    AreaChart: dataChart('area-chart'),
    Bar: keyed('bar'),
    BarChart: dataChart('bar-chart'),
    CartesianGrid: leaf('cartesian-grid'),
    Cell: leaf('cell'),
    Legend: leaf('legend'),
    Line: keyed('line'),
    LineChart: dataChart('line-chart'),
    Pie: ({ data, dataKey, children }: MockChartProps) =>
      createElement(
        'div',
        { 'data-testid': 'pie', 'data-chart-data': serialize(data), 'data-data-key': dataKey },
        children,
      ),
    PieChart: leaf('pie-chart'),
    PolarAngleAxis: keyed('polar-angle-axis'),
    PolarGrid: leaf('polar-grid'),
    PolarRadiusAxis: leaf('polar-radius-axis'),
    Radar: namedKeyed('radar'),
    RadarChart: dataChart('radar-chart'),
    ResponsiveContainer: leaf('responsive-container'),
    Tooltip: leaf('tooltip'),
    XAxis: keyed('x-axis'),
    YAxis: keyed('y-axis'),
  };
});

const stackingMocks = vi.hoisted(() => ({
  estimateStackingApy: vi.fn(),
  fetchPoxInfo: vi.fn(),
  fetchRewardHistory: vi.fn(),
  fetchStackerInfo: vi.fn(),
}));

const geminiMocks = vi.hoisted(() => ({
  getAssetInsight: vi.fn(),
}));

const protocolMocks = vi.hoisted(() => ({
  fetchGlobalReserveMetrics: vi.fn(),
}));

vi.mock('../services/stacking', () => stackingMocks);
vi.mock('../services/gemini', () => geminiMocks);
vi.mock('../services/protocol', () => protocolMocks);
vi.mock('@google/genai', () => ({ GoogleGenAI: vi.fn() }));

const renderWithContext = (ui: React.ReactElement, stateOverrides: Record<string, unknown> = {}) =>
  render(
    <AppContext.Provider
      value={
        {
          state: { ...initialAppState, language: 'en', ...stateOverrides },
          notify: vi.fn(),
        } as never
      }
    >
      {ui}
    </AppContext.Provider>,
  );

describe('Recharts consumer regressions', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    stackingMocks.estimateStackingApy.mockResolvedValue(9.8);
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
    geminiMocks.getAssetInsight.mockResolvedValue('PoX insight');
    protocolMocks.fetchGlobalReserveMetrics.mockResolvedValue(null);
  });

  it('passes representative reward history and data keys to the AreaChart', async () => {
    const rewardHistory = [
      { cycle: '#123', btc: 0.0012, date: 'Jul 20' },
      { cycle: '#124', btc: 0.0015, date: 'Jul 21' },
    ];
    stackingMocks.fetchRewardHistory.mockResolvedValue(rewardHistory);

    renderWithContext(<StackingManager />, {
      walletConfig: {
        type: 'single',
        stacksAddress: 'SP2C2M1...',
        taprootAddress: 'bc1p-rewards',
      },
    });

    expect(screen.getByRole('heading', { name: 'Stacking (PoX)' })).toBeInTheDocument();
    expect(screen.getByText('Yield Performance')).toBeInTheDocument();
    expect(screen.getByText('BTC Rewards')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('area-chart')).toHaveAttribute(
        'data-chart-data',
        JSON.stringify(rewardHistory),
      );
    });
    expect(screen.getByTestId('x-axis')).toHaveAttribute('data-data-key', 'cycle');
    expect(screen.getByTestId('area')).toHaveAttribute('data-data-key', 'btc');
  });

  it('keeps the AreaChart usable with the empty reward-history fallback', async () => {
    renderWithContext(<StackingManager />);

    const fallbackData = [{ cycle: '—', btc: 0, date: '' }];
    await waitFor(() => {
      expect(screen.getByTestId('area-chart')).toHaveAttribute(
        'data-chart-data',
        JSON.stringify(fallbackData),
      );
    });
    expect(screen.getByTestId('x-axis')).toHaveAttribute('data-data-key', 'cycle');
    expect(screen.getByTestId('area')).toHaveAttribute('data-data-key', 'btc');
    expect(screen.getByRole('button', { name: 'Lock STX and Start Earning' })).toBeInTheDocument();
  });

  it('passes benchmark dimensions and series keys to the RadarChart', async () => {
    renderWithContext(<Benchmarking />);

    const chartData = [
      { subject: 'Sovereignty', Conxius: 98, IndustryAvg: 45, NicheCompetitor: 85 },
      { subject: 'Multi-Layer', Conxius: 95, IndustryAvg: 30, NicheCompetitor: 60 },
      { subject: 'Privacy', Conxius: 92, IndustryAvg: 20, NicheCompetitor: 75 },
      { subject: 'UX/AI', Conxius: 90, IndustryAvg: 85, NicheCompetitor: 40 },
      { subject: 'Fees', Conxius: 88, IndustryAvg: 50, NicheCompetitor: 70 },
    ];

    expect(screen.getByRole('heading', { name: 'Ecosystem Benchmark' })).toBeInTheDocument();
    expect(screen.getByText('Feature Parity Matrix')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();

    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId('radar-chart').getAttribute('data-chart-data') || 'null')).toEqual(chartData);
    });
    expect(screen.getByTestId('polar-angle-axis')).toHaveAttribute('data-data-key', 'subject');
    expect(screen.getAllByTestId('radar').map((node) => node.getAttribute('data-data-key'))).toEqual([
      'Conxius',
      'IndustryAvg',
    ]);
    await waitFor(() => {
      expect(screen.getByText('Strategic intelligence feed interrupted. Maintain local node synchronization.')).toBeInTheDocument();
    });
  });

  it('retains initial reserve allocation data when verification has no result', async () => {
    renderWithContext(<ReserveSystem />);

    expect(screen.getByRole('heading', { name: /Sovereign Reserve Engine/ })).toBeInTheDocument();
    expect(screen.getByText('Reserve Allocation')).toBeInTheDocument();

    await waitFor(() => expect(protocolMocks.fetchGlobalReserveMetrics).toHaveBeenCalledWith());

    const chartData = JSON.parse(screen.getByTestId('pie').getAttribute('data-chart-data') || 'null');
    expect(chartData).toEqual([
      { name: 'Liquid (L-BTC)', value: 32 },
      { name: 'Stacks (sBTC)', value: 20 },
      { name: 'Rootstock (RBTC)', value: 8 },
      { name: 'Wormhole NTT', value: 39 },
    ]);
    expect(screen.getByTestId('pie')).toHaveAttribute('data-data-key', 'value');
    expect(screen.getByText('Liquid (L-BTC)')).toBeInTheDocument();
    expect(screen.getByText('Wormhole NTT')).toBeInTheDocument();
  });
});
