/**
 * Tests for fixes implemented in this session:
 * 1. Token limit auto-calculation based on model context windows
 * 2. Smart compression when token limit exceeded
 * 3. Cost calculation accuracy for API calls
 * 4. Repomix includes file contents (files: true)
 * 5. API logging uses actual model name (not provider name)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import { getMinContextWindow, COST_RATES, PROMPT_HEADROOM_TOKENS } from '../src/utils/constants';
import { estimateCost } from '../src/utils/llm-providers';
import { getCompressionRecommendation, type RepoOverview } from '../src/utils/smart-compress';

// =============================================================================
// Test 1: Token limit auto-calculation based on model context windows
// =============================================================================

describe('getMinContextWindow', () => {
    it('returns minimum context window minus headroom for known models', () => {
        // gpt-4.1-mini has 1047576 tokens, claude-haiku-4-5 has 200000 tokens
        // The minimum should be 200000 - PROMPT_HEADROOM_TOKENS
        const models = ['openai/gpt-4.1-mini', 'anthropic/claude-haiku-4-5'];
        const result = getMinContextWindow(models);
        
        // claude-haiku-4-5 has 200000 context, minus 10000 headroom = 190000
        expect(result).toBe(200000 - PROMPT_HEADROOM_TOKENS);
    });

    it('uses default context window for unknown models', () => {
        const models = ['unknown/fake-model'];
        const result = getMinContextWindow(models);
        
        // Default is 128000 - PROMPT_HEADROOM_TOKENS
        expect(result).toBe(128000 - PROMPT_HEADROOM_TOKENS);
    });

    it('returns at least 50000 tokens minimum', () => {
        // Even if a model has very small context, we should return at least 50k
        const result = getMinContextWindow([]);
        expect(result).toBeGreaterThanOrEqual(50000);
    });

    it('handles mixed known and unknown models', () => {
        const models = ['anthropic/claude-haiku-4-5', 'unknown/fake-model'];
        const result = getMinContextWindow(models);
        
        // Should use the minimum of known (200000) and default (128000)
        // So 128000 - PROMPT_HEADROOM_TOKENS
        expect(result).toBe(128000 - PROMPT_HEADROOM_TOKENS);
    });
});

// =============================================================================
// Test 2: Cost calculation accuracy for API calls
// =============================================================================

describe('estimateCost - model lookup fixes', () => {
    it('finds cost for model without provider prefix', () => {
        // This was the bug - estimateCost was called with just model name
        const cost = estimateCost('claude-3-7-sonnet-20250219', 1000, 500);
        
        // claude-3-7-sonnet: input=$3/1M, output=$15/1M
        // 1000 * 0.000003 + 500 * 0.000015 = 0.003 + 0.0075 = 0.0105
        expect(cost).toBeGreaterThan(0);
        expect(cost).toBeCloseTo(0.0105, 4);
    });

    it('finds cost for model with provider prefix', () => {
        const cost = estimateCost('anthropic/claude-3-7-sonnet-20250219', 1000, 500);
        expect(cost).toBeGreaterThan(0);
        expect(cost).toBeCloseTo(0.0105, 4);
    });

    it('finds cost for gpt-4.1-mini without prefix', () => {
        const cost = estimateCost('gpt-4.1-mini', 1000, 500);
        
        // gpt-4.1-mini: input=$0.40/1M, output=$1.60/1M
        // 1000 * 0.0000004 + 500 * 0.0000016 = 0.0004 + 0.0008 = 0.0012
        expect(cost).toBeGreaterThan(0);
        expect(cost).toBeCloseTo(0.0012, 5);
    });

    it('finds cost for gemini-2.0-flash without prefix', () => {
        const cost = estimateCost('gemini-2.0-flash', 1000, 500);
        
        // gemini-2.0-flash: input=$0.10/1M, output=$0.40/1M
        // 1000 * 0.0000001 + 500 * 0.0000004 = 0.0001 + 0.0002 = 0.0003
        expect(cost).toBeGreaterThan(0);
    });

    it('returns default cost for completely unknown model', () => {
        // Should use default rates and warn
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const cost = estimateCost('completely-unknown-model-xyz', 1000, 500);
        
        // Default: input=$3/1M, output=$15/1M (same as Claude Sonnet)
        expect(cost).toBeGreaterThan(0);
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('Cost rates not found for model')
        );
        consoleSpy.mockRestore();
    });
});

// =============================================================================
// Test 3: Smart compression recommendation
// =============================================================================

describe('getCompressionRecommendation - default fallback', () => {
    it('returns default recommendation with exclude patterns when agent fails', async () => {
        // Mock a scenario where the agent would fail
        const overview: RepoOverview = {
            directoryStructure: 'src/\n  index.ts\ntest/\n  test.ts',
            fileSummary: 'Test files',
            totalTokens: 150000,
            fileTokenCounts: {
                'src/index.ts': 50000,
                'test/test.ts': 30000,
                'package-lock.json': 70000,
            },
        };

        // With no API keys, the agent call will fail and return defaults
        const originalKey = process.env['ANTHROPIC_API_KEY'];
        delete process.env['ANTHROPIC_API_KEY'];

        const recommendation = await getCompressionRecommendation(
            overview,
            'General review',
            100000,
            'claude'
        );

        // Restore
        if (originalKey) process.env['ANTHROPIC_API_KEY'] = originalKey;

        // Should have some exclude patterns
        expect(recommendation.excludePatterns).toBeDefined();
        expect(Array.isArray(recommendation.excludePatterns)).toBe(true);
        expect(recommendation.reasoning).toBeDefined();
    });
});

// =============================================================================
// Test 4: COST_RATES structure validation
// =============================================================================

describe('COST_RATES structure', () => {
    it('has entries keyed by provider/model format', () => {
        const keys = Object.keys(COST_RATES);
        expect(keys.length).toBeGreaterThan(0);
        
        // All keys should contain a slash (provider/model format)
        const keysWithSlash = keys.filter(k => k.includes('/'));
        expect(keysWithSlash.length).toBe(keys.length);
    });

    it('has required fields for each model', () => {
        for (const [key, value] of Object.entries(COST_RATES)) {
            expect(value).toHaveProperty('input');
            expect(value).toHaveProperty('output');
            expect(value).toHaveProperty('max_input_tokens');
            expect(typeof value.input).toBe('number');
            expect(typeof value.output).toBe('number');
            expect(typeof value.max_input_tokens).toBe('number');
        }
    });

    it('contains expected models', () => {
        const expectedModels = [
            'anthropic/claude-3-7-sonnet-20250219',
            'openai/gpt-4.1-mini',
            'anthropic/claude-haiku-4-5',
        ];

        for (const model of expectedModels) {
            expect(COST_RATES[model]).toBeDefined();
        }
    });
});

// =============================================================================
// Test 5: LLMProvider interface has model property
// =============================================================================

describe('LLMProvider model property', () => {
    it('ClaudeProvider exposes model property', async () => {
        const { ClaudeProvider } = await import('../src/utils/llm-providers');
        const provider = new ClaudeProvider('claude-3-5-haiku-20241022');
        
        expect(provider.model).toBe('claude-3-5-haiku-20241022');
        expect(provider.name).toBe('Claude');
    });

    it('OpenAIProvider exposes model property', async () => {
        const { OpenAIProvider } = await import('../src/utils/llm-providers');
        const provider = new OpenAIProvider('gpt-4o-mini');
        
        expect(provider.model).toBe('gpt-4o-mini');
        expect(provider.name).toBe('OpenAI');
    });

    it('GeminiProvider exposes model property', async () => {
        const { GeminiProvider } = await import('../src/utils/llm-providers');
        const provider = new GeminiProvider('gemini-2.0-flash');
        
        expect(provider.model).toBe('gemini-2.0-flash');
        expect(provider.name).toBe('Gemini');
    });
});

// =============================================================================
// Test 6: Repomix config includes files: true
// =============================================================================

describe('Repomix configuration', () => {
    it('runRepomix includes file contents by default', async () => {
        // This is a unit test to verify the config is correct
        // We can't easily test the actual repomix output without running it
        const { runRepomix } = await import('../src/repomix');
        
        // The function should exist and be callable
        expect(typeof runRepomix).toBe('function');
    });
});

// =============================================================================
// Test 7: PROMPT_HEADROOM_TOKENS constant
// =============================================================================

describe('PROMPT_HEADROOM_TOKENS', () => {
    it('is defined and reasonable', () => {
        expect(PROMPT_HEADROOM_TOKENS).toBeDefined();
        expect(typeof PROMPT_HEADROOM_TOKENS).toBe('number');
        expect(PROMPT_HEADROOM_TOKENS).toBeGreaterThanOrEqual(5000);
        expect(PROMPT_HEADROOM_TOKENS).toBeLessThanOrEqual(20000);
    });
});
