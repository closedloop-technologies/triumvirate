/**
 * LLM Providers Module
 *
 * This module provides a unified interface for interacting with different LLM providers.
 * It abstracts away the specific implementation details of each provider, allowing
 * the rest of the application to use LLMs in a provider-agnostic way.
 */

import OpenAI from 'openai';

import { COST_RATES } from './constants';
import { enhancedLogger } from './enhanced-logger.js';
import { withErrorHandlingAndRetry } from './error-handling';
import { createModelError, handleModelError, ErrorCategory } from './model-utils';
import llmCosts from '../../llm_costs.json';
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
    cost: number;
}

// Provider interfaces
export interface LLMProvider {
    name: string;
    runStructured<T>(
        prompt: string,
        schema: Record<string, unknown>,
        maxRetries?: number
    ): Promise<LLMResponse<T>>;
    runCompletion(prompt: string, maxRetries?: number): Promise<LLMResponse<string>>;
    isAvailable(): boolean;
}

/**
 * Estimate the cost of a model run based on input and output tokens
 */
export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
    // Try to look up exact model in the costs file
    const costs = llmCosts as Record<
        string,
        { input_cost_per_token?: number; output_cost_per_token?: number }
    >;

    let info = costs[model];
    if (!info) {
        const parts = model.split('/');
        if (parts.length > 1) {
            info = costs[parts.slice(1).join('/')];
        }
    }

    if (info && info.input_cost_per_token && info.output_cost_per_token) {
        return inputTokens * info.input_cost_per_token + outputTokens * info.output_cost_per_token;
    }

    // Fallback to provider level rates
    const provider = model.split('/')[0] ?? '';
    if (provider in COST_RATES) {
        return (
            inputTokens * COST_RATES[provider as keyof typeof COST_RATES].input +
            outputTokens * COST_RATES[provider as keyof typeof COST_RATES].output
        );
    }

    // Default to OpenAI rates if everything else fails
    return inputTokens * COST_RATES.openai.input + outputTokens * COST_RATES.openai.output;
}

/**
 * Claude Provider Implementation
 */
export class ClaudeProvider implements LLMProvider {
    name = 'Claude';
    model: string;

    constructor(model = 'claude-3-7-sonnet-20250219') {
        this.model = model;
    }

    isAvailable(): boolean {
        return !!process.env['ANTHROPIC_API_KEY'];
    }

    async runCompletion(
        prompt: string,
        maxRetries = MAX_API_RETRIES
    ): Promise<LLMResponse<string>> {
        if (!this.isAvailable()) {
            throw new Error('ANTHROPIC_API_KEY is not set');
        }

        const apiKey = process.env['ANTHROPIC_API_KEY'];
        if (!apiKey) {
            throw new Error('ANTHROPIC_API_KEY is not set');
        }

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
                        model: this.model,
                        max_tokens: 4096,
                        messages: [{ role: 'user', content: prompt }],
                    }),
                    signal,
                };

                // Make the API request
                const response = await fetch(
                    'https://api.anthropic.com/v1/messages',
                    requestOptions
                );

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Claude API error (${response.status}): ${errorText}`);
                }

                // Define the expected response type
                interface ClaudeResponse {
                    content: Array<{
                        type: string;
                        text?: string;
                    }>;
                    usage: {
                        input_tokens: number;
                        output_tokens: number;
                        total_tokens: number;
                    };
                }

                const result = (await response.json()) as ClaudeResponse;

                if (
                    !result.content ||
                    !Array.isArray(result.content) ||
                    result.content.length === 0
                ) {
                    throw new Error('Claude API returned an unexpected response format');
                }

                // Extract the text content from the response
                const messageContent = result.content
                    .filter(item => item.type === 'text' && item.text)
                    .map(item => item.text as string)
                    .join('');

                // Extract usage information
                const usage: LLMUsage = {
                    input_tokens: result.usage?.input_tokens || 0,
                    output_tokens: result.usage?.output_tokens || 0,
                    total_tokens: result.usage?.total_tokens || 0,
                };
                usage.total_tokens = usage.total_tokens || usage.input_tokens | usage.output_tokens;

                const cost = estimateCost(this.model, usage.input_tokens, usage.output_tokens);

                // Log the successful API call
                enhancedLogger.logApiCall({
                    timestamp: new Date().toISOString(),
                    model: this.model,
                    operation: 'completion',
                    inputTokens: usage.input_tokens,
                    outputTokens: usage.output_tokens,
                    totalTokens: usage.total_tokens,
                    success: true,
                    cost,
                });

                return {
                    data: messageContent,
                    usage,
                    cost,
                };
            },
            'Claude',
            maxRetries,
            API_TIMEOUT_MS
        );
    }

    async runStructured<T>(
        prompt: string,
        schema: Record<string, unknown>,
        maxRetries = MAX_API_RETRIES,
        toolName = 'generate_structured_data',
        toolDescription = 'Generate structured data based on the provided information',
        maxTokens = 4096
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
        const tool = {
            name: toolName,
            description: toolDescription,
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
                        model: this.model,
                        max_tokens: maxTokens,
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

                const json_result = await response.json();
                const result = json_result as {
                    id: string;
                    type: string;
                    role: string;
                    model: string;
                    content: Array<{
                        type: string;
                        name?: string;
                        input?: Record<string, unknown>;
                    }>;
                    stop_reason: string;
                    stop_sequence: string | null;
                    usage: LLMUsage;
                };

                // Extract the tool call from the response
                const toolCallContent = result.content.find(
                    item => item.type === 'tool_use' && item.name === toolName
                );

                if (!toolCallContent) {
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
                const cost = estimateCost(this.model, usage.input_tokens, usage.output_tokens);
                // Return the properly extracted data and usage
                return {
                    data: toolCallContent.input as T,
                    usage,
                    cost,
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
    model: string;

    constructor(model = 'gpt-4.1') {
        this.model = model;
    }

    isAvailable(): boolean {
        return !!process.env['OPENAI_API_KEY'];
    }

    async runCompletion(
        prompt: string,
        maxRetries = MAX_API_RETRIES
    ): Promise<LLMResponse<string>> {
        // Validate input and API key
        if (!this.isAvailable()) {
            throw createModelError(
                'OPENAI_API_KEY is not set',
                ErrorCategory.AUTHENTICATION,
                'OpenAI',
                false,
                new Error('OPENAI_API_KEY is not set')
            );
        }

        // Validate input
        if (!prompt || typeof prompt !== 'string') {
            throw createModelError(
                'Invalid prompt: must be a non-empty string',
                ErrorCategory.INVALID_RESPONSE,
                'OpenAI',
                false,
                new Error('Invalid prompt')
            );
        }

        const openai = new OpenAI({ apiKey: process.env['OPENAI_API_KEY'] });

        return withErrorHandlingAndRetry(
            async (signal: AbortSignal) => {
                try {
                    const response = await openai.chat.completions.create(
                        {
                            model: this.model,
                            messages: [{ role: 'user', content: prompt }],
                            temperature: 0.2,
                        },
                        { signal }
                    );

                    // Validate response structure
                    if (!response) {
                        throw new Error('OpenAI returned an empty response');
                    }

                    if (!response.choices || !response.choices[0] || !response.choices[0].message) {
                        throw new Error('OpenAI response is missing choices');
                    }

                    const messageContent = response.choices[0].message.content || '';

                    // Validate usage data
                    if (!response.usage) {
                        throw new Error('OpenAI response is missing usage data');
                    }

                    // Extract usage information
                    const usage: LLMUsage = {
                        input_tokens: response.usage.prompt_tokens || 0,
                        output_tokens: response.usage.completion_tokens || 0,
                        total_tokens: response.usage.total_tokens || 0,
                    };
                    usage.total_tokens =
                        usage.total_tokens || usage.input_tokens + usage.output_tokens;
                    const cost = estimateCost(this.model, usage.input_tokens, usage.output_tokens);

                    // Log the successful API call
                    enhancedLogger.logApiCall({
                        timestamp: new Date().toISOString(),
                        model: this.model,
                        operation: 'completion',
                        inputTokens: usage.input_tokens,
                        outputTokens: usage.output_tokens,
                        totalTokens: usage.total_tokens,
                        success: true,
                        cost: cost,
                    });

                    return {
                        data: messageContent,
                        usage,
                        cost,
                    };
                } catch (error) {
                    // Log the failed API call
                    enhancedLogger.logApiCall({
                        timestamp: new Date().toISOString(),
                        model: this.model,
                        operation: 'completion',
                        success: false,
                        error: error instanceof Error ? error.message : String(error),
                        cost: 0,
                    });

                    // Convert to a ModelError with appropriate category
                    throw handleModelError(error, 'OpenAI', maxRetries);
                }
            },
            'OpenAI',
            maxRetries,
            API_TIMEOUT_MS
        );
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
                        model: this.model,
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
                const cost = estimateCost(this.model, usage.input_tokens, usage.output_tokens);

                return {
                    data: parsedData,
                    usage,
                    cost,
                };
            },
            'OpenAI Structured',
            maxRetries,
            API_TIMEOUT_MS * 2 // Double timeout for structured responses
        );
    }
}

/**
 * Gemini Provider Implementation
 */
export class GeminiProvider implements LLMProvider {
    name = 'Gemini';
    model: string;

    constructor(model = 'gemini-2.5-pro-exp-03-25') {
        this.model = model;
    }

    isAvailable(): boolean {
        return !!process.env['GOOGLE_API_KEY'];
    }

    async runCompletion(
        prompt: string,
        maxRetries = MAX_API_RETRIES
    ): Promise<LLMResponse<string>> {
        // Validate input and API key
        if (!this.isAvailable()) {
            throw createModelError(
                'GOOGLE_API_KEY is not set',
                ErrorCategory.AUTHENTICATION,
                'Gemini',
                false,
                new Error('GOOGLE_API_KEY is not set')
            );
        }

        // Validate input
        if (!prompt || typeof prompt !== 'string') {
            throw createModelError(
                'Invalid prompt: must be a non-empty string',
                ErrorCategory.INVALID_RESPONSE,
                'Gemini',
                false,
                new Error('Invalid prompt')
            );
        }

        const apiKey = process.env['GOOGLE_API_KEY'];
        if (!apiKey) {
            throw createModelError(
                'GOOGLE_API_KEY is not set',
                ErrorCategory.AUTHENTICATION,
                'Gemini',
                false,
                new Error('GOOGLE_API_KEY is not set')
            );
        }

        // Use the GoogleGenAI library
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: this.model });

        return withErrorHandlingAndRetry(
            async (_signal: AbortSignal) => {
                try {
                    // Note: Gemini API might not directly support AbortSignal
                    // We're using the signal in our HOF, but the actual API call might not use it
                    const response = await model.generateContent(prompt);
                    const result = response.response;

                    // Validate response structure
                    if (!result) {
                        throw new Error('Gemini returned an empty response');
                    }

                    // Extract text from the response
                    const text = result.text();

                    const usage: LLMUsage = {
                        input_tokens: result.usageMetadata?.promptTokenCount || 0,
                        output_tokens: result.usageMetadata?.candidatesTokenCount || 0,
                        total_tokens: result.usageMetadata?.totalTokenCount || 0,
                    };
                    usage.total_tokens =
                        usage.total_tokens || usage.input_tokens + usage.output_tokens;

                    const cost = estimateCost(this.model, usage.input_tokens, usage.output_tokens);

                    // Log the successful API call
                    enhancedLogger.logApiCall({
                        timestamp: new Date().toISOString(),
                        model: this.model,
                        operation: 'completion',
                        inputTokens: usage.input_tokens,
                        outputTokens: usage.output_tokens,
                        totalTokens: usage.total_tokens,
                        success: true,
                        cost: cost,
                    });

                    return {
                        data: text,
                        usage,
                        cost,
                    };
                } catch (error) {
                    // Log the failed API call
                    enhancedLogger.logApiCall({
                        timestamp: new Date().toISOString(),
                        model: this.model,
                        operation: 'completion',
                        success: false,
                        error: error instanceof Error ? error.message : String(error),
                        cost: 0,
                    });

                    // Convert to a ModelError with appropriate category
                    throw handleModelError(error, 'Gemini', maxRetries);
                }
            },
            'Gemini',
            maxRetries,
            API_TIMEOUT_MS
        );
    }

    async runStructured<T>(
        prompt: string,
        schema: Record<string, unknown>,
        maxRetries = MAX_API_RETRIES
    ): Promise<LLMResponse<T>> {
        if (!this.isAvailable()) {
            throw new Error('GOOGLE_API_KEY is not set');
        }

        const apiKey = process.env['GOOGLE_API_KEY'];
        if (!apiKey) {
            throw new Error('GOOGLE_API_KEY is not set');
        }

        const { GoogleGenerativeAI, FunctionCallingMode } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(apiKey);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tools: any = [
            {
                functionDeclarations: [
                    {
                        name: 'generate_structured_data',
                        description: 'Generate structured data based on the provided information',
                        parameters: schema,
                    },
                ],
            },
        ];

        const model = genAI.getGenerativeModel({
            model: this.model,
            tools,
            toolConfig: { functionCallingConfig: { mode: FunctionCallingMode.ANY } },
            generationConfig: {
                responseMimeType: 'application/json',
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                responseSchema: schema as any,
                maxOutputTokens: 4096,
            },
        });

        return withErrorHandlingAndRetry(
            async (_signal: AbortSignal) => {
                const response = await model.generateContent(prompt);
                const result = response.response;

                if (!result) {
                    throw new Error('Gemini returned an empty response');
                }

                let parsedData: T;
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const calls = result.functionCalls ? result.functionCalls() : undefined;
                if (Array.isArray(calls) && calls.length > 0) {
                    parsedData = (calls[0] as { args: unknown }).args as T;
                } else {
                    const text = result.text();
                    try {
                        parsedData = JSON.parse(text) as T;
                    } catch {
                        throw new Error('Gemini did not return valid structured data');
                    }
                }

                const usage: LLMUsage = {
                    input_tokens: result.usageMetadata?.promptTokenCount || 0,
                    output_tokens: result.usageMetadata?.candidatesTokenCount || 0,
                    total_tokens: result.usageMetadata?.totalTokenCount || 0,
                };
                usage.total_tokens = usage.total_tokens || usage.input_tokens + usage.output_tokens;

                const cost = estimateCost(this.model, usage.input_tokens, usage.output_tokens);

                enhancedLogger.logApiCall({
                    timestamp: new Date().toISOString(),
                    model: this.model,
                    operation: 'structured_output',
                    inputTokens: usage.input_tokens,
                    outputTokens: usage.output_tokens,
                    totalTokens: usage.total_tokens,
                    success: true,
                    cost,
                });

                return {
                    data: parsedData,
                    usage,
                    cost,
                };
            },
            'Gemini Structured',
            maxRetries,
            API_TIMEOUT_MS * 2
        );
    }
}
