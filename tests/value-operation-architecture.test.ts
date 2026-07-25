import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const authorityImport = /services\/app-private\/value-operation-authority|app-private\/value-operation-authority/;
const registryImport = /(?:app-private\/|\.\/)value-operation-capability-registry/;

function productionFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(join(root, directory))) {
    const absolute = join(root, directory, entry);
    const path = relative(root, absolute).replaceAll('\\', '/');
    if (statSync(absolute).isDirectory()) {
      files.push(...productionFiles(path));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      files.push(path);
    }
  }
  return files;
}

describe('App-private value-operation authority architecture', () => {
  it('allows only App.tsx to import the production confirmer', () => {
    const candidates = ['App.tsx', ...productionFiles('components'), ...productionFiles('services'), ...productionFiles('core')];
    const importers = candidates.filter((path) => authorityImport.test(readFileSync(join(root, path), 'utf8')));
    expect(importers).toEqual(['App.tsx']);
  });

  it('keeps the capability issuer registry private to the authority and shared consumer facade', () => {
    const candidates = ['App.tsx', ...productionFiles('components'), ...productionFiles('services'), ...productionFiles('core')];
    const importers = candidates.filter((path) => registryImport.test(readFileSync(join(root, path), 'utf8'))).sort();
    expect(importers).toEqual([
      'services/app-private/value-operation-authority.ts',
      'services/value-operation.ts',
    ]);
  });

  it('does not expose a constructible confirmer from the shared feature API', () => {
    const shared = readFileSync(join(root, 'services/value-operation.ts'), 'utf8');
    expect(shared).not.toMatch(/createWalletValueOperationGate|createAppPrivateValueOperationAuthority/);
    expect(shared).not.toMatch(/export\s+(?:async\s+)?function\s+\w*(?:confirm|issue)\w*/i);
  });

  it('carries the queue-issued settlement capability into PaymentPortal submission', () => {
    const portal = readFileSync(join(root, 'components/PaymentPortal.tsx'), 'utf8');
    expect(portal).toContain('requireValueOperationSettlementAuthorization(lightningOutcome, lightningRequest)');
    expect(portal).toContain('payLightningInvoice(recipient, settlementAuthorization, network)');
    expect(portal).toContain('payLnurl(lnDetail.params, amountSats, settlementAuthorization, network)');
  });
});
