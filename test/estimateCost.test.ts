import { describe, it, expect, vi } from 'vitest';

import { estimateCost } from '../src/utils/llm-providers';

describe('estimateCost', () => {
    it('calculates cost using model specific rates with provider prefix', () => {
        const cost = estimateCost('openai/gpt-4.1', 1000, 500);
        expect(cost).toBeCloseTo(0.002 + 0.004, 6);
    });

    it('calculates cost using model specific rates without provider prefix', () => {
        // This tests the fix for model lookup without provider prefix
        const cost = estimateCost('gpt-4.1', 1000, 500);
        expect(cost).toBeCloseTo(0.002 + 0.004, 6);
    });

    it('returns default cost when model is unknown', () => {
        // When model is unknown, the function now returns a default cost (Claude Sonnet rates)
        // and logs a warning
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const cost = estimateCost('unknown/provider', 1000, 1000);
        
        // Default: input=$3/1M, output=$15/1M
        // 1000 * 0.000003 + 1000 * 0.000015 = 0.003 + 0.015 = 0.018
        expect(cost).toBeCloseTo(0.018, 5);
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });
});
