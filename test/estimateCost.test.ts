import { describe, it, expect } from 'vitest';

import { estimateCost } from '../src/utils/llm-providers';

describe('estimateCost', () => {
    it('calculates cost using model specific rates', () => {
        const cost = estimateCost('openai/gpt-4.1', 1000, 500);
        expect(cost).toBeCloseTo(0.002 + 0.004, 6);
    });

    it('returns 0 when model is unknown and no fallback exists', () => {
        // When model is unknown and there's no matching provider or 'openai' key in COST_RATES,
        // the function returns 0 (since COST_RATES['openai'] doesn't exist - only 'openai/model' keys)
        const cost = estimateCost('unknown/provider', 1000, 1000);
        expect(cost).toBe(0);
    });
});
