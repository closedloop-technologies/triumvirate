// Mock the GoogleGenerativeAI module
vi.mock('@google/generative-ai', async () => {
    return {
        GoogleGenerativeAI: class {
            constructor(_apiKey: string) {}
            getGenerativeModel() {
                return {
                    generateContent: async (_opts: any) => ({
                        response: {
                            candidates: [
                                { content: { parts: [{ text: 'Gemini review for code' }] } },
                            ],
                            text: () => 'Gemini review for code',
                            usageMetadata: {
                                promptTokenCount: 10,
                                candidatesTokenCount: 15,
                                totalTokenCount: 25,
                            },
                        },
                    }),
                };
            }
        },
    };
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { ClaudeProvider, OpenAIProvider, GeminiProvider } from '../src/utils/llm-providers';

const mockUsage = {
    input_tokens: 10,
    output_tokens: 15,
    total_tokens: 25,
};

describe('ClaudeProvider', () => {
    let provider: ClaudeProvider;
    beforeEach(() => {
        provider = new ClaudeProvider();
        vi.resetAllMocks();
        process.env['ANTHROPIC_API_KEY'] = 'test';
    });

    it('runCompletion returns text', async () => {
        vi.spyOn(global, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => ({
                content: [{ type: 'text', text: 'Claude response' }],
                usage: mockUsage,
            }),
        } as any);

        const result = await provider.runCompletion('prompt');
        if (typeof result.data === 'string') {
            expect(result.data).toContain('Claude response');
        } else {
            throw new Error('result.data is not a string');
        }
        expect(result.usage).toBeDefined();
    });

    it('runStructured returns structured data', async () => {
        vi.spyOn(global, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => ({
                id: 'msg_123',
                type: 'message',
                role: 'assistant',
                model: 'claude-3-5-sonnet-20241022',
                content: [
                    {
                        type: 'tool_use',
                        name: 'generate_structured_data',
                        input: { foo: 'bar' },
                    },
                ],
                stop_reason: 'tool_use',
                stop_sequence: null,
                usage: mockUsage,
            }),
        } as any);

        const schema = { type: 'object', properties: { foo: { type: 'string' } } };
        const result = await provider.runStructured<{ foo: string }>('prompt', schema);
        expect(typeof result.data).toBe('object');
        expect(result.data.foo).toBe('bar');
    });
});

// Mock the OpenAI module for SDK v6
vi.mock('openai', () => {
    return {
        default: class OpenAI {
            chat = {
                completions: {
                    create: vi.fn().mockResolvedValue({
                        choices: [{ message: { content: 'OpenAI response' } }],
                        usage: { prompt_tokens: 10, completion_tokens: 15, total_tokens: 25 },
                    }),
                },
            };
        },
    };
});

describe('OpenAIProvider', () => {
    let provider: OpenAIProvider;
    beforeEach(() => {
        provider = new OpenAIProvider();
        vi.resetAllMocks();
        process.env['OPENAI_API_KEY'] = 'test';
    });

    it('runCompletion returns text', async () => {
        const result = await provider.runCompletion('prompt');
        if (typeof result.data === 'string') {
            expect(result.data).toContain('OpenAI response');
        } else {
            throw new Error('result.data is not a string');
        }
        expect(result.usage).toBeDefined();
    });

    it('runStructured returns structured data', async () => {
        vi.spyOn(global, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => ({
                choices: [{ message: { function_call: { arguments: '{"foo": "bar"}' } } }],
                usage: { prompt_tokens: 10, completion_tokens: 15, total_tokens: 25 },
            }),
        } as any);

        const schema = { type: 'object', properties: { foo: { type: 'string' } } };
        const result = await provider.runStructured<{ foo: string }>('prompt', schema);
        expect(typeof result.data).toBe('object');
        expect(result.data.foo).toBe('bar');
    });
});

describe('GeminiProvider', () => {
    let provider: GeminiProvider;
    beforeEach(() => {
        provider = new GeminiProvider();
        vi.resetAllMocks();
        process.env['GEMINI_API_KEY'] = 'test';
    });

    it('runCompletion returns text', async () => {
        const result = await provider.runCompletion('test code');
        expect(result).toBeDefined();
        expect(typeof result.data === 'string' && result.data).toContain('Gemini review for code');
        expect(result.usage).toBeDefined();
    });

    it('runStructured throws error', async () => {
        await expect(provider.runStructured('prompt', {})).rejects.toThrow(
            'Invalid schema for Gemini: must be an object with a properties field'
        );
    });
});
