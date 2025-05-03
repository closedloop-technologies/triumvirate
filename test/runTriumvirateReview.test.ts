vi.mock('fs', () => ({
    readFileSync: vi.fn(path => {
        if (path === 'mock-path.txt') {
            return 'mocked codebase content';
        }
        return '';
    }),
    writeFileSync: vi.fn(),
}));

vi.mock('../src/repomix', () => ({
    runRepomix: vi.fn().mockResolvedValue({
        filePath: 'mock-path.txt',
        tokenCount: 100,
    }),
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
// Do NOT import runTriumvirateReview or models here!

const mockModels = ['openai', 'claude', 'gemini'];

// Mock fs.readFileSync
vi.mock('fs', () => ({
    readFileSync: vi.fn().mockReturnValue('mocked codebase content'),
    writeFileSync: vi.fn(),
}));

// Mock repomix
vi.mock('../src/repomix', () => ({
    runRepomix: vi.fn().mockResolvedValue({
        filePath: 'mock-path.txt',
        tokenCount: 100,
    }),
}));

describe('runTriumvirateReview', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        // Mock the environment variables
        process.env['OPENAI_API_KEY'] = 'test-key';
        process.env['ANTHROPIC_API_KEY'] = 'test-key';
        process.env['GOOGLE_API_KEY'] = 'test-key';
    });

    it('runs reviews for all models and aggregates results', async () => {
        const { runTriumvirateReview } = await import('../src/index');
        const models = await import('../src/models');
        // Mock runModelReview to use our mocked providers
        vi.spyOn(models, 'runModelReview').mockImplementation(async (_prompt, model) => {
            return {
                text: `review for ${model}`,
                usage: { input_tokens: 5, output_tokens: 5, total_tokens: 10 },
            };
        });

        const results = await runTriumvirateReview({
            models: mockModels,
            exclude: [],
            diffOnly: false,
            failOnError: false,
            summaryOnly: false,
            outputPath: '.',
            tokenLimit: 1000,
        });

        expect(results).toHaveLength(mockModels.length);
        for (const result of results) {
            expect(result.model).toBeDefined();
            expect(result.review).toContain('review for');
            expect(result.metrics.error).toBeFalsy();
        }
    });

    it('handles model errors gracefully', async () => {
        const { runTriumvirateReview } = await import('../src/index');
        const models = await import('../src/models');
        // Mock runModelReview to throw an error for claude
        vi.spyOn(models, 'runModelReview').mockImplementation(async (_prompt, model) => {
            if (model === 'claude') {
                return {
                    text: '',
                    usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
                    metrics: { error: 'Claude failed' },
                };
            }
            return {
                text: `review for ${model}`,
                usage: { input_tokens: 5, output_tokens: 5, total_tokens: 10 },
            };
        });

        const results = await runTriumvirateReview({
            models: mockModels,
            exclude: [],
            diffOnly: false,
            failOnError: false,
            summaryOnly: false,
            outputPath: '.',
            tokenLimit: 1000,
        });

        const claudeResult = results.find(r => r.model === 'claude');
        expect(claudeResult).toBeDefined();
        expect(claudeResult?.metrics.error).toContain('Claude failed');
    });
});
