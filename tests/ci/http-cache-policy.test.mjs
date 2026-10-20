import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

// Exercise the installed transitive package, including pnpm's registered patch.
// Resolution fails if that actual dependency is absent; no mock substitutes it.
const require = createRequire(import.meta.url);
const policyPath = require.resolve('http-cache-semantics', {
  paths: [new URL('../../node_modules/.pnpm/node_modules/', import.meta.url).pathname],
});
const CachePolicy = require(policyPath);

const request = {
  method: 'GET', url: 'https://cache-test.invalid/account',
  headers: { host: 'cache-test.invalid' },
};

function policy(headers) {
  const result = new CachePolicy(request, { status: 200, headers }, { shared: true });
  const created = result.now();
  result.now = () => created + 120_000;
  return result;
}

function evaluate(value, maxStale = 'max-stale=999999') {
  return value.evaluateRequest({ ...request, headers: {
    ...request.headers, 'cache-control': maxStale,
  } });
}

describe('installed HTTP cache security-zeroed lifetime', () => {
  for (const headers of [
    { 'cache-control': 'private', 'set-cookie': 'synthetic=one' },
    { 'cache-control': 'no-store' },
    { 'cache-control': 'no-cache, stale-while-revalidate=999999' },
    { 'cache-control': 'max-age=0, stale-while-revalidate=999999' },
    { 'set-cookie': 'synthetic=one' },
    { vary: '*' },
  ]) {
    it(`requires revalidation for ${JSON.stringify(headers)}`, () => {
      const value = policy(headers);
      expect(value.maxAge()).toBe(0);
      expect(evaluate(value).response).toBeUndefined();
      expect(evaluate(value, 'max-stale').response).toBeUndefined();
    });
  }

  it('retains permitted stale reuse for a positive public freshness lifetime', () => {
    const value = policy({ 'cache-control': 'public, max-age=60' });
    expect(value.stale()).toBe(true);
    expect(evaluate(value, 'max-stale=120').response).toBeDefined();
    expect(evaluate(value, 'max-stale=30').response).toBeUndefined();
  });

  it('retains fresh explicit-public cache behavior', () => {
    const value = policy({ 'cache-control': 'public, max-age=600', 'set-cookie': 'synthetic=one' });
    expect(value.stale()).toBe(false);
    expect(evaluate(value).response).toBeDefined();
  });

  it('still rejects a request for a different cache identity', () => {
    const value = policy({ 'cache-control': 'public, max-age=600' });
    expect(value.evaluateRequest({ ...request, url: 'https://cache-test.invalid/other' }).response)
      .toBeUndefined();
  });
});
