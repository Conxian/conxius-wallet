import { createRequire } from 'node:module';
import { readFileSync, readdirSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as sdk from '@conxian/market-sdk';

const sdkRoot = realpathSync(new URL('../../node_modules/@conxian/market-sdk', import.meta.url));
const sdkEntry = join(sdkRoot, 'dist/index.js');
const sdkRequire = createRequire(sdkEntry);
const schemaNames = ['M2MSettlementResponseSchema', 'ProtocolFeeRecordSchema', 'SettlementResultSchema'];

function assertFixedSchema(schema, seen = new Set()) {
  if (seen.has(schema)) return;
  seen.add(schema);
  expect(seen.size).toBeLessThan(64);
  const def = schema._def;
  if (def.typeName === 'ZodObject') {
    expect(def.unknownKeys).toBe('strip');
    for (const child of Object.values(def.shape())) assertFixedSchema(child, seen);
  } else if (def.typeName === 'ZodOptional') {
    assertFixedSchema(def.innerType, seen);
  } else if (def.typeName === 'ZodEffects') {
    expect(def.effect.type).toBe('transform');
    assertFixedSchema(def.schema, seen);
  } else {
    expect(['ZodString', 'ZodNumber', 'ZodBoolean', 'ZodNativeEnum']).toContain(def.typeName);
  }
}

describe('installed Market SDK Zod 3 advisory reachability boundary', () => {
  it('pins the reviewed consumer and rejects new Zod import surfaces', () => {
    expect(JSON.parse(readFileSync(join(sdkRoot, 'package.json'), 'utf8')).version).toBe('0.2.4');
    expect(JSON.parse(readFileSync(sdkRequire.resolve('zod/package.json'), 'utf8')).version).toBe('3.25.76');
    const importers = readdirSync(dirname(sdkEntry)).filter(name => name.endsWith('.js'))
      .filter(name => /(?:from\s*|require\s*\(\s*|import\s*\(\s*)["']zod(?:["'/])/.test(readFileSync(join(dirname(sdkEntry), name), 'utf8')));
    expect(importers).toEqual(['wire_contract.js']);
    expect(Object.keys(sdk).filter(name => sdk[name]?._def).sort()).toEqual(schemaNames);
  });

  it('has only fixed object/scalar schema nodes, with no array, set, map, record or lazy parser', () => {
    for (const name of schemaNames) assertFixedSchema(sdk[name]);
  });

  it('rejects containers without enumerating their elements', () => {
    const oversized = new Proxy(new Array(1_000_000), {
      get(target, key, receiver) {
        if (key === Symbol.iterator || /^(?:0|[1-9]\d*)$/.test(String(key))) {
          throw new Error('Untrusted container elements must not be enumerated');
        }
        return Reflect.get(target, key, receiver);
      },
      ownKeys() { throw new Error('Untrusted container keys must not be enumerated'); },
    });
    for (const name of schemaNames) {
      for (const input of [oversized, new Map(), new Set()]) {
        const result = sdk[name].safeParse(input);
        expect(result.success).toBe(false);
        expect(result.error.issues).toHaveLength(1);
      }
      const fields = Object.fromEntries(Object.keys(sdk[name].shape).map(key => [key, oversized]));
      const result = sdk[name].safeParse(fields);
      expect(result.success).toBe(false);
      expect(result.error.issues.length).toBeLessThan(32);
    }
  });

  it('retains monetary wire conversion and valid settlement behavior', () => {
    const fee = {
      settlementId: 'fixture-settlement', rail: sdk.SettlementRail.Lightning,
      tier: sdk.TrustTier.Managed, amountSat: '9007199254740993', feeSat: '1',
      feeBps: 1, timestamp: 1700000000, builderId: 'fixture-builder',
    };
    expect(sdk.ProtocolFeeRecordSchema.parse(fee).amountSat).toBe(9007199254740993n);
    const result = sdk.SettlementResultSchema.parse({ success: true, settlementId: fee.settlementId, rail: fee.rail, fee });
    expect(result.fee.feeSat).toBe(1n);
    expect(sdk.M2MSettlementResponseSchema.parse({ txId: 'fixture-tx' })).toEqual({ txId: 'fixture-tx' });
  });
});
