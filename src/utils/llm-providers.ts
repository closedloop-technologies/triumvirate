/**
 * LLM Providers Module
 *
 * This module provides a unified interface for interacting with different LLM providers.
 * It abstracts away the specific implementation details of each provider, allowing
 * the rest of the application to use LLMs in a provider-agnostic way.
 */

import { withErrorHandlingAndRetry } from './error-handling';
import type { OpenAIUsage } from '../types/usage';

// Constants
const API_TIMEOUT_MS = 60000; // 60 seconds
const MAX_API_RETRIES = 3;

// Types for LLM responses
export interface LLMUsage {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
}

export interface LLMResponse<T> {
    data: T;
    usage: LLMUsage;
}

// Provider interfaces
export interface LLMProvider {
    name: string;
    runStructured<T>(
        prompt: string,
        schema: Record<string, unknown>,
        maxRetries?: number
    ): Promise<LLMResponse<T>>;
    isAvailable(): boolean;
}

/**
 * Claude Provider Implementation
 */
export class ClaudeProvider implements LLMProvider {
    name = 'Claude';

    isAvailable(): boolean {
        return !!process.env['ANTHROPIC_API_KEY'];
    }

    async runStructured<T>(
        prompt: string,
        schema: Record<string, unknown>,
        maxRetries = MAX_API_RETRIES
    ): Promise<LLMResponse<T>> {
        if (!this.isAvailable()) {
            throw new Error('ANTHROPIC_API_KEY is not set');
        }

        const apiKey = process.env['ANTHROPIC_API_KEY'];
        if (!apiKey) {
            throw new Error('ANTHROPIC_API_KEY is not set');
        }
        const baseURL = 'https://api.anthropic.com/v1';

        // Define the tool for structured output
        const toolName = 'generate_structured_data';
        const tool = {
            name: toolName,
            description: 'Generate structured data based on the provided information',
            input_schema: schema,
        };

        return withErrorHandlingAndRetry(
            async (signal: AbortSignal) => {
                // Create request options
                const requestOptions = {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': apiKey,
                        'anthropic-version': '2023-06-01',
                    },
                    body: JSON.stringify({
                        model: 'claude-3-7-sonnet-20250219',
                        max_tokens: 4096,
                        messages: [{ role: 'user', content: prompt }],
                        tools: [tool],
                        tool_choice: { type: 'tool', name: toolName },
                    }),
                    signal,
                };

                // Make the API request
                const response = await fetch(`${baseURL}/messages`, requestOptions);

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Claude API error (${response.status}): ${errorText}`);
                }

                const result = (await response.json()) as {
                    content: Array<{
                        type: string;
                        name?: string;
                        input?: Record<string, unknown>;
                    }>;
                    usage: LLMUsage;
                };

                // Extract the tool call from the response
                const toolCallContent = result.content.find(
                    item => item.type === 'tool_use' && item.name === toolName
                );

                if (!toolCallContent) {
                    console.error('Claude tool response structure:', String(result));
                    throw new Error('Claude did not return expected tool use response');
                }

                const usage: LLMUsage = {
                    input_tokens: result.usage?.input_tokens || 0,
                    output_tokens: result.usage?.output_tokens || 0,
                    total_tokens:
                        (result.usage?.input_tokens || 0) + (result.usage?.output_tokens || 0),
                    cache_creation_input_tokens: result.usage?.cache_creation_input_tokens,
                    cache_read_input_tokens: result.usage?.cache_read_input_tokens,
                };

                // Return the properly extracted data and usage
                return {
                    data: toolCallContent.input as T,
                    usage,
                };
            },
            'Claude Structured',
            maxRetries,
            API_TIMEOUT_MS * 2 // Double timeout for structured responses
        );
    }
}

/**
 * OpenAI Provider Implementation
 */
export class OpenAIProvider implements LLMProvider {
    name = 'OpenAI';

    isAvailable(): boolean {
        return !!process.env['OPENAI_API_KEY'];
    }

    async runStructured<T>(
        prompt: string,
        schema: Record<string, unknown>,
        maxRetries = MAX_API_RETRIES
    ): Promise<LLMResponse<T>> {
        if (!this.isAvailable()) {
            throw new Error('OPENAI_API_KEY is not set');
        }

        const apiKey = process.env['OPENAI_API_KEY'];
        const baseURL = 'https://api.openai.com/v1';

        return withErrorHandlingAndRetry(
            async (signal: AbortSignal) => {
                // Create request options
                const requestOptions = {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${apiKey}`,
                    },
                    body: JSON.stringify({
                        model: 'gpt-4-turbo',
                        max_tokens: 4096,
                        messages: [{ role: 'user', content: prompt }],
                        functions: [
                            {
                                name: 'generate_structured_data',
                                description:
                                    'Generate structured data based on the provided information',
                                parameters: schema,
                            },
                        ],
                        function_call: { name: 'generate_structured_data' },
                    }),
                    signal,
                };

                // Make the API request
                const response = await fetch(`${baseURL}/chat/completions`, requestOptions);

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
                }

                const result = (await response.json()) as {
                    choices: Array<{
                        message: {
                            function_call: {
                                arguments: string;
                            };
                        };
                    }>;
                    usage: OpenAIUsage;
                };

                if (
                    !result.choices ||
                    !result.choices[0] ||
                    !result.choices[0].message ||
                    !result.choices[0].message.function_call
                ) {
                    console.error('OpenAI response structure:', JSON.stringify(result, null, 2));
                    throw new Error('OpenAI did not return expected function call response');
                }

                const functionCallArguments = result.choices[0].message.function_call.arguments;
                let parsedData: T;

                try {
                    parsedData = JSON.parse(functionCallArguments) as T;
                } catch {
                    console.error(
                        'Failed to parse OpenAI function call arguments:',
                        functionCallArguments
                    );
                    throw new Error('Failed to parse OpenAI function call response');
                }

                const usage: LLMUsage = {
                    input_tokens: result.usage?.input_tokens || 0,
                    output_tokens: result.usage?.output_tokens || 0,
                    total_tokens: result.usage?.total_tokens || 0,
                };

                return {
                    data: parsedData,
                    usage,
                };
            },
            'OpenAI Structured',
            maxRetries,
            API_TIMEOUT_MS * 2 // Double timeout for structured responses
        );
    }
}

/**
 * LLM Provider Factory
 * Creates and manages LLM provider instances
 */
export class LLMProviderFactory {
    private static providers: LLMProvider[] = [new ClaudeProvider(), new OpenAIProvider()];

    /**
     * Get the best available provider
     * Returns the first available provider in order of preference
     */
    static getBestAvailableProvider(): LLMProvider {
        for (const provider of this.providers) {
            if (provider.isAvailable()) {
                return provider;
            }
        }
        throw new Error('No LLM provider is available. Please set at least one API key.');
    }

    /**
     * Get a specific provider by name
     */
    static getProviderByName(name: string): LLMProvider | undefined {
        return this.providers.find(p => p.name === name);
    }

    /**
     * Get all available providers
     */
    static getAvailableProviders(): LLMProvider[] {
        return this.providers.filter(p => p.isAvailable());
    }

    /**
     * Run a structured prompt with the best available provider
     */
    static async runStructured<T>(
        prompt: string,
        schema: Record<string, unknown>,
        maxRetries = MAX_API_RETRIES
    ): Promise<LLMResponse<T>> {
        const provider = this.getBestAvailableProvider();
        console.log(`Using ${provider.name} provider for structured output`);
        return provider.runStructured<T>(prompt, schema, maxRetries);
    }
}
