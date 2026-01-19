export function buildBip21Uri(address: string, params?: { amount?: number; label?: string; message?: string }) {
  const scheme = 'bitcoin:';
  if (!address) return '';
  const query: string[] = [];
  if (params?.amount && params.amount > 0) query.push(`amount=${params.amount}`);
  if (params?.label) query.push(`label=${encodeURIComponent(params.label)}`);
  if (params?.message) query.push(`message=${encodeURIComponent(params.message)}`);
  return query.length ? `${scheme}${address}?${query.join('&')}` : `${scheme}${address}`;
}

export function parseBip21(input: string): { address: string; amount?: number; label?: string; message?: string } {
  const trimmed = (input || '').trim();
  if (!trimmed) return { address: '' };
  const noScheme = trimmed.toLowerCase().startsWith('bitcoin:') ? trimmed.slice('bitcoin:'.length) : trimmed;
  const [addressPart, queryPart] = noScheme.split('?', 2);
  const address = addressPart.trim();
  const result: { address: string; amount?: number; label?: string; message?: string } = { address };
  if (!queryPart) return result;
  const params = new URLSearchParams(queryPart);
  const amountStr = params.get('amount');
  const label = params.get('label');
  const message = params.get('message');
  if (amountStr) {
    const amount = Number(amountStr);
    if (!Number.isNaN(amount) && Number.isFinite(amount) && amount > 0) result.amount = amount;
  }
  if (label) result.label = label;
  if (message) result.message = message;
  return result;
}
