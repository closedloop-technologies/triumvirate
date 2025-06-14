import * as _path from 'path';

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockModels = ['openai', 'claude', 'gemini'];
const mockCodebase = 'mocked codebase content';
const mockFilePath = 'mock-path.txt';

// Mock fs module
vi.mock('fs', async () => {
    const actual = await vi.importActual('fs');
    return {
        ...actual,
        readFileSync: vi.fn().mockImplementation(filePath => {
            if (filePath === mockFilePath || filePath.toString().includes(mockFilePath)) {
                return mockCodebase;
            }
            throw new Error(`ENOENT: no such file or directory, open '${filePath}'`);
        }),
        writeFileSync: vi.fn(),
        existsSync: vi.fn().mockReturnValue(true),
        mkdirSync: vi.fn(),
    };
});

// Mock fs/promises module
vi.mock('fs/promises', async () => {
    return {
        readFile: vi.fn().mockImplementation(async filePath => {
            if (filePath === mockFilePath || filePath.toString().includes(mockFilePath)) {
                return mockCodebase;
            }
            throw new Error(`ENOENT: no such file or directory, open '${filePath}'`);
        }),
        writeFile: vi.fn(),
        mkdir: vi.fn(),
        unlink: vi.fn().mockResolvedValue(undefined),
    };
});

// Mock repomix
vi.mock('../src/repomix', () => ({
    runRepomix: vi.fn().mockResolvedValue({
        filePath: mockFilePath,
        tokenCount: 100,
        directoryStructure: 'Mock directory structure',
        summary: 'Mock summary',
        // Add these required properties to avoid undefined errors
        fileCount: 5,
        lineCount: 100,
        byteCount: 1000,
        language: 'typescript',
    }),
}));

describe('runTriumvirateReview', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        // Mock the environment variables
        process.env['OPENAI_API_KEY'] = 'test-key';
        process.env['ANTHROPIC_API_KEY'] = 'test-key';
        process.env['GEMINI_API_KEY'] = 'test-key';
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
            enhancedReport: false, // Set to false to get array of ModelReviewResult
        });

        // Assert that results is an array
        expect(Array.isArray(results)).toBe(true);
        const resultsArray = results as any[];
        expect(resultsArray).toHaveLength(mockModels.length);
        for (const result of resultsArray) {
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
            enhancedReport: false, // Set to false to get array of ModelReviewResult
        });

        // Assert that results is an array
        expect(Array.isArray(results)).toBe(true);
        const resultsArray = results as any[];
        const claudeResult = resultsArray.find(r => r.model === 'claude');
        expect(claudeResult).toBeDefined();
        expect(claudeResult?.metrics.error).toContain('Claude failed');
    });
});
