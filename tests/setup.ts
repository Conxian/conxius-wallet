import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

// Extends Vitest's expect method with methods from react-testing-library
// expect.extend(matchers);

// Runs a cleanup after each test case (e.g. clearing jsdom)
afterEach(() => {
  cleanup();
});

// Polyfill for TextEncoder/TextDecoder in JSDOM
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
// @ts-ignore
global.TextDecoder = TextDecoder;

// Polyfill for crypto.subtle
import { webcrypto } from 'crypto';
// @ts-ignore
if (!global.crypto) {
    // @ts-ignore
    global.crypto = webcrypto;
}

// Ensure URL is globally available
import { URL } from 'url';
global.URL = URL;
