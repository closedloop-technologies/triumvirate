import { describe, expect, it } from 'vitest';

import { DEFAULT_REVIEW_MARKUP_PERCENT, reviewPricing } from '../src/index.js';

describe('review pricing', () => {
    it('applies the default 40 percent markup to provider cost', () => {
        expect(DEFAULT_REVIEW_MARKUP_PERCENT).toBe(40);
        expect(reviewPricing(2.5)).toEqual({
            markupPercent: 40,
            providerCost: 2.5,
            customerPrice: 3.5,
        });
    });

    it('supports an explicit markup and rejects invalid prices', () => {
        expect(reviewPricing(2.5, 20).customerPrice).toBe(3);
        expect(() => reviewPricing(-1)).toThrow('provider cost');
        expect(() => reviewPricing(1, -1)).toThrow('markup percent');
    });
});
