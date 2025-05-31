import { describe, it, expect } from 'vitest';

import { estimateCost } from '../src/utils/llm-providers';

describe('estimateCost', () => {
    it('calculates cost using model specific rates', () => {
        const cost = estimateCost('openai/gpt-4.1', 1000, 500);
        expect(cost).toBeCloseTo(0.002 + 0.004, 6);
    });

    it('defaults to openai rates when model is unknown', () => {
        const cost = estimateCost('unknown/provider', 1000, 1000);
        expect(cost).toBeCloseTo(0.002 + 0.008, 6);
    });
});
