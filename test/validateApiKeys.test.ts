import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { validateApiKeys } from '../src/utils/api-keys';

const originalEnv = { ...process.env };

beforeEach(() => {
    process.env = { ...originalEnv };
});

afterEach(() => {
    process.env = { ...originalEnv };
});

describe('validateApiKeys', () => {
    it('detects missing API keys', () => {
        delete process.env.OPENAI_API_KEY;
        const result = validateApiKeys(['openai']);
        expect(result.valid).toBe(false);
        expect(result.missingKeys).toContain('OPENAI_API_KEY');
    });

    it('detects invalid API key format', () => {
        process.env.OPENAI_API_KEY = 'invalid';
        const result = validateApiKeys(['openai']);
        expect(result.valid).toBe(false);
        expect(result.invalidKeys).toContain('OPENAI_API_KEY');
    });

    it('passes when API key is valid', () => {
        process.env.OPENAI_API_KEY = 'sk-' + 'a'.repeat(40);
        const result = validateApiKeys(['openai']);
        expect(result.valid).toBe(true);
    });
});
