import { fetchWithRetry } from './network';

export const fetchBtcPrice = async (): Promise<number> => {
  try {
    const response = await fetchWithRetry('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
    const data = await response.json();
    return data.bitcoin.usd;
  } catch { return 68500; }
};

export const fetchStxPrice = async (): Promise<number> => {
  try {
    const response = await fetchWithRetry('https://api.coingecko.com/api/v3/simple/price?ids=stacks&vs_currencies=usd');
    const data = await response.json();
    return data.stacks.usd;
  } catch { return 2.45; }
};
