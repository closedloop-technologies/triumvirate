/**
 * LLM Providers Module
 *
 * This module provides a unified interface for interacting with different LLM providers.
 * It abstracts away the specific implementation details of each provider, allowing
 * the rest of the application to use LLMs in a provider-agnostic way.
 */

// Add necessary imports for Gemini structured output
import type {
    FunctionDeclaration,
    FunctionDeclarationSchema,
    FunctionCallingMode,
    Tool,
    GenerateContentResponse, // Import the response type
} from '@google/generative-ai';
import { GoogleGenerativeAI } from '@google/generative-ai'; // Ensure this is imported
import OpenAI from 'openai';

import { COST_RATES } from './constants';
import { enhancedLogger } from './enhanced-logger.js';
// Import directly from the consolidated error-handling module
import {
    withErrorHandlingAndRetry,
    createModelError,
    ErrorCategory,
    TriumvirateError, // Import base error if needed
} from './error-handling';
// No longer need model-utils.ts
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
            // Use TriumvirateError directly or a helper if preferred
            throw new TriumvirateError(
                'ANTHROPIC_API_KEY is not set',
                ErrorCategory.AUTHENTICATION,
                this.name
            );
        }

        const apiKey = process.env['ANTHROPIC_API_KEY'];
        if (!apiKey) {
            throw new TriumvirateError(
                'ANTHROPIC_API_KEY is not set (checked again)',
                ErrorCategory.AUTHENTICATION,
                this.name
            );
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
                    // Throw a generic error here, let withErrorHandlingAndRetry categorize it
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
                        total_tokens: number; // Note: Claude sometimes returns total_tokens
                    };
                }

                const result = (await response.json()) as ClaudeResponse;

                if (
                    !result.content ||
                    !Array.isArray(result.content) ||
                    result.content.length === 0 ||
                    !result.usage // Add usage check
                ) {
                    throw new TriumvirateError(
                        'Claude API returned an unexpected response format',
                        ErrorCategory.INVALID_RESPONSE,
                        this.name,
                        false,
                        result
                    );
                }

                // Extract the text content from the response
                const messageContent = result.content
                    .filter(item => item.type === 'text' && item.text)
                    .map(item => item.text as string)
                    .join('');

                // Extract usage information
                const usage: LLMUsage = {
                    input_tokens: result.usage.input_tokens || 0,
                    output_tokens: result.usage.output_tokens || 0,
                    total_tokens:
                        result.usage.total_tokens ||
                        (result.usage.input_tokens || 0) + (result.usage.output_tokens || 0), // Calculate if missing
                };
                // Ensure total_tokens is correct
                usage.total_tokens = usage.input_tokens + usage.output_tokens;

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
            this.name, // Use provider name as component
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
            throw new TriumvirateError(
                'ANTHROPIC_API_KEY is not set',
                ErrorCategory.AUTHENTICATION,
                this.name
            );
        }

        const apiKey = process.env['ANTHROPIC_API_KEY'];
        if (!apiKey) {
            throw new TriumvirateError(
                'ANTHROPIC_API_KEY is not set (checked again)',
                ErrorCategory.AUTHENTICATION,
                this.name
            );
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
                // More specific type for structured response
                interface ClaudeStructuredApiResult {
                    id: string;
                    type: string;
                    role: string;
                    model: string;
                    content: Array<{
                        type: string;
                        name?: string;
                        input?: Record<string, unknown>;
                        text?: string; // Can contain text even with tool use
                    }>;
                    stop_reason: string;
                    stop_sequence: string | null;
                    usage: LLMUsage & {
                        // Include specific Claude usage fields
                        cache_creation_input_tokens?: number;
                        cache_read_input_tokens?: number;
                    };
                }

                const result = json_result as ClaudeStructuredApiResult;

                if (!result.usage) {
                    console.error(
                        'Claude structured response missing usage:',
                        JSON.stringify(result, null, 2)
                    );
                    throw new TriumvirateError(
                        'Claude structured response missing usage data',
                        ErrorCategory.INVALID_RESPONSE,
                        `${this.name} Structured`,
                        false,
                        result
                    );
                }

                // Extract the tool call from the response
                const toolCallContent = result.content.find(
                    item => item.type === 'tool_use' && item.name === toolName
                );

                // Check if the model refused to use the tool but provided text instead
                if (!toolCallContent && result.stop_reason === 'tool_use') {
                    console.warn(
                        `Claude indicated tool use but no tool call content found for tool '${toolName}'. Checking for text fallback.`
                    );
                    // Attempt to find text content as fallback
                    const textContent = result.content.find(item => item.type === 'text')?.text;
                    if (textContent) {
                        console.warn(
                            `Falling back to text content due to missing tool call: ${textContent.slice(0, 100)}...`
                        );
                        // Try to parse the text content as JSON - this is a common fallback pattern
                        try {
                            const parsedText = JSON.parse(textContent) as T;
                            console.warn('Successfully parsed fallback text content as JSON.');

                            const usage: LLMUsage = {
                                input_tokens: result.usage.input_tokens || 0,
                                output_tokens: result.usage.output_tokens || 0,
                                total_tokens:
                                    (result.usage.input_tokens || 0) +
                                    (result.usage.output_tokens || 0),
                            };
                            const cost = estimateCost(
                                this.model,
                                usage.input_tokens,
                                usage.output_tokens
                            );

                            enhancedLogger.logApiCall({
                                timestamp: new Date().toISOString(),
                                model: this.model,
                                operation: 'structured_output (text fallback)',
                                inputTokens: usage.input_tokens,
                                outputTokens: usage.output_tokens,
                                totalTokens: usage.total_tokens,
                                success: true, // Considered successful if we got parsable data
                                cost: cost,
                            });

                            return { data: parsedText, usage, cost };
                        } catch (parseError) {
                            console.error(
                                'Failed to parse fallback text content as JSON:',
                                parseError
                            );
                            throw new TriumvirateError(
                                `Claude did not return expected tool use input for '${toolName}' and fallback text parsing failed.`,
                                ErrorCategory.INVALID_RESPONSE,
                                `${this.name} Structured`,
                                false,
                                result
                            );
                        }
                    }
                }

                if (!toolCallContent || !toolCallContent.input) {
                    // Check if input exists
                    console.error(
                        'Claude response missing expected tool use input:',
                        JSON.stringify(result, null, 2)
                    );
                    throw new TriumvirateError(
                        `Claude did not return expected tool use input for '${toolName}'`,
                        ErrorCategory.INVALID_RESPONSE,
                        `${this.name} Structured`,
                        false,
                        result
                    );
                }

                // Use usage directly from result
                const usage: LLMUsage = {
                    input_tokens: result.usage.input_tokens || 0,
                    output_tokens: result.usage.output_tokens || 0,
                    total_tokens:
                        (result.usage.input_tokens || 0) + (result.usage.output_tokens || 0),
                    cache_creation_input_tokens: result.usage.cache_creation_input_tokens,
                    cache_read_input_tokens: result.usage.cache_read_input_tokens,
                };
                const cost = estimateCost(this.model, usage.input_tokens, usage.output_tokens);

                enhancedLogger.logApiCall({
                    timestamp: new Date().toISOString(),
                    model: this.model,
                    operation: 'structured_output',
                    inputTokens: usage.input_tokens,
                    outputTokens: usage.output_tokens,
                    totalTokens: usage.total_tokens,
                    success: true,
                    cost: cost,
                });

                // Return the properly extracted data and usage
                return {
                    data: toolCallContent.input as T,
                    usage,
                    cost,
                };
            },
            `${this.name} Structured`, // Use specific component name
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
                this.name,
                false,
                new Error('OPENAI_API_KEY is not set')
            );
        }

        // Validate input
        if (!prompt || typeof prompt !== 'string') {
            throw createModelError(
                'Invalid prompt: must be a non-empty string',
                ErrorCategory.INVALID_RESPONSE,
                this.name,
                false,
                new Error('Invalid prompt')
            );
        }

        const openai = new OpenAI({ apiKey: process.env['OPENAI_API_KEY'] });

        return withErrorHandlingAndRetry(
            async (signal: AbortSignal) => {
                // Keep try...catch within the apiCall function
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
                    throw new TriumvirateError(
                        'OpenAI returned an empty response',
                        ErrorCategory.INVALID_RESPONSE,
                        this.name,
                        false,
                        response
                    );
                }

                if (!response.choices?.[0]?.message?.content) {
                    // Simplified check
                    throw new TriumvirateError(
                        'OpenAI response is missing expected content',
                        ErrorCategory.INVALID_RESPONSE,
                        this.name,
                        false,
                        response
                    );
                }

                const messageContent = response.choices[0].message.content;

                // Validate usage data
                if (!response.usage) {
                    throw new TriumvirateError(
                        'OpenAI response is missing usage data',
                        ErrorCategory.INVALID_RESPONSE,
                        this.name,
                        false,
                        response
                    );
                }

                // Extract usage information
                const usage: LLMUsage = {
                    input_tokens: response.usage.prompt_tokens || 0,
                    output_tokens: response.usage.completion_tokens || 0,
                    total_tokens: response.usage.total_tokens || 0,
                };
                usage.total_tokens = usage.total_tokens || usage.input_tokens + usage.output_tokens;
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
            },
            this.name,
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
            throw createModelError(
                'OPENAI_API_KEY is not set',
                ErrorCategory.AUTHENTICATION,
                this.name,
                false
            );
        }
        // Basic schema validation
        if (
            !schema ||
            typeof schema !== 'object' ||
            !schema['properties'] ||
            typeof schema['properties'] !== 'object'
        ) {
            throw createModelError(
                'Invalid schema: must be an object with a properties field.',
                ErrorCategory.INVALID_RESPONSE,
                `${this.name} Structured`,
                false
            );
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
                    throw new Error(`OpenAI API error (${response.status}): ${errorText}`); // Let HOF categorize
                }

                // Use OpenAI's specific type if available, otherwise a generic structure
                const result = (await response.json()) as {
                    choices?: Array<{
                        message?: {
                            function_call?: {
                                arguments?: string;
                            };
                            tool_calls?: Array<{
                                // Also check tool_calls for newer API versions
                                function?: {
                                    arguments?: string;
                                };
                            }>;
                        };
                    }>;
                    usage?: OpenAIUsage; // Use specific usage type
                };

                // Find the function call arguments, checking both structures
                let functionCallArguments: string | undefined;
                const message = result.choices?.[0]?.message;

                if (message?.function_call?.arguments) {
                    functionCallArguments = message.function_call.arguments;
                } else if (message?.tool_calls?.[0]?.function?.arguments) {
                    functionCallArguments = message.tool_calls[0].function.arguments;
                }

                if (!functionCallArguments) {
                    console.error('OpenAI response structure:', JSON.stringify(result, null, 2));
                    throw new TriumvirateError(
                        'OpenAI did not return expected function call arguments in response',
                        ErrorCategory.INVALID_RESPONSE,
                        `${this.name} Structured`,
                        false,
                        result
                    );
                }

                let parsedData: T;

                try {
                    parsedData = JSON.parse(functionCallArguments) as T;
                } catch (parseError) {
                    console.error(
                        'Failed to parse OpenAI function call arguments:',
                        functionCallArguments
                    );
                    // Use createModelError for consistency
                    throw createModelError(
                        `Failed to parse OpenAI function call response: ${(parseError as Error).message}`,
                        ErrorCategory.INVALID_RESPONSE,
                        `${this.name} Structured`,
                        false, // Not retryable if parsing fails consistently
                        parseError
                    );
                }

                if (!result.usage) {
                    throw new TriumvirateError(
                        'OpenAI structured response missing usage data',
                        ErrorCategory.INVALID_RESPONSE,
                        `${this.name} Structured`,
                        false,
                        result
                    );
                }

                const usage: LLMUsage = {
                    input_tokens: result.usage.input_tokens || 0,
                    output_tokens: result.usage.output_tokens || 0,
                    total_tokens: result.usage.total_tokens || 0,
                };
                // Recalculate total_tokens for safety
                usage.total_tokens = usage.input_tokens + usage.output_tokens;

                const cost = estimateCost(this.model, usage.input_tokens, usage.output_tokens);

                // Log the successful API call for structured output
                enhancedLogger.logApiCall({
                    timestamp: new Date().toISOString(),
                    model: this.model,
                    operation: 'structured_output', // Use a specific operation name
                    inputTokens: usage.input_tokens,
                    outputTokens: usage.output_tokens,
                    totalTokens: usage.total_tokens,
                    success: true,
                    cost: cost,
                });

                return {
                    data: parsedData,
                    usage,
                    cost,
                };
            },
            `${this.name} Structured`, // Specific component name
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
    model = 'gemini-2.5-pro-exp-03-25'; // Or 'gemini-pro' for the stable version

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
                this.name, // Use this.name
                false,
                new Error('GOOGLE_API_KEY is not set')
            );
        }

        // Validate input
        if (!prompt || typeof prompt !== 'string') {
            throw createModelError(
                'Invalid prompt: must be a non-empty string',
                ErrorCategory.INVALID_RESPONSE,
                this.name, // Use this.name
                false,
                new Error('Invalid prompt')
            );
        }

        const apiKey = process.env['GOOGLE_API_KEY'];
        if (!apiKey) {
            throw createModelError(
                'GOOGLE_API_KEY is not set (checked again)', // More specific error
                ErrorCategory.AUTHENTICATION,
                this.name,
                false,
                new Error('GOOGLE_API_KEY is not set')
            );
        }

        // Use the GoogleGenAI library
        const genAI = new GoogleGenerativeAI(apiKey);
        const modelInstance = genAI.getGenerativeModel({ model: this.model }); // Renamed to avoid conflict

        return withErrorHandlingAndRetry(
            async (_signal: AbortSignal) => {
                // Gemini SDK might not use signal directly
                const result = await modelInstance.generateContent(prompt); // Use modelInstance
                const response: GenerateContentResponse = result.response; // Access the response object, explicitly type it

                // Validate response structure
                if (!response) {
                    throw new TriumvirateError(
                        'Gemini returned an empty response object',
                        ErrorCategory.INVALID_RESPONSE,
                        this.name,
                        false,
                        result
                    );
                }

                // Check for safety blocks
                if (response.promptFeedback?.blockReason) {
                    throw createModelError(
                        `Gemini request blocked due to safety settings: ${response.promptFeedback.blockReason}`,
                        ErrorCategory.INVALID_RESPONSE, // Or a specific category for safety blocks
                        this.name,
                        false, // Usually not retryable
                        response.promptFeedback
                    );
                }
                if (!response.candidates?.length || !response.candidates[0]?.content) {
                    throw new TriumvirateError(
                        'Gemini response missing expected candidate content',
                        ErrorCategory.INVALID_RESPONSE,
                        this.name,
                        false,
                        response
                    );
                }

                // FIXED: Extract text from the response object asynchronously
                if (
                    !response.candidates?.length ||
                    !response.candidates[0]?.content?.parts?.length
                ) {
                    throw new TriumvirateError(
                        'Gemini response missing expected candidate content',
                        ErrorCategory.INVALID_RESPONSE,
                        this.name,
                        false,
                        response
                    );
                }

                // Extract text from response
                const textContent = response.candidates[0]?.content?.parts[0]?.text || '';
                const text = textContent;

                // FIXED: Extract usage from the response object
                const usage: LLMUsage = {
                    input_tokens: response.usageMetadata?.promptTokenCount || 0,
                    output_tokens: response.usageMetadata?.candidatesTokenCount || 0,
                    total_tokens: response.usageMetadata?.totalTokenCount || 0,
                };
                // Ensure total_tokens is calculated if missing
                if (
                    usage.total_tokens === 0 &&
                    (usage.input_tokens > 0 || usage.output_tokens > 0)
                ) {
                    usage.total_tokens = usage.input_tokens + usage.output_tokens;
                }

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
            },
            this.name, // Use this.name
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
            throw createModelError(
                'GOOGLE_API_KEY is not set',
                ErrorCategory.AUTHENTICATION,
                this.name,
                false,
                new Error('GOOGLE_API_KEY is not set')
            );
        }
        if (!prompt || typeof prompt !== 'string') {
            throw createModelError(
                'Invalid prompt: must be a non-empty string',
                ErrorCategory.INVALID_RESPONSE,
                this.name,
                false,
                new Error('Invalid prompt')
            );
        }
        // Add basic schema validation for Gemini
        if (
            !schema ||
            typeof schema !== 'object' ||
            !schema['properties'] ||
            typeof schema['properties'] !== 'object'
        ) {
            throw createModelError(
                'Invalid schema for Gemini: must be an object with a properties field.',
                ErrorCategory.INVALID_RESPONSE,
                `${this.name} Structured`,
                false
            );
        }

        const apiKey = process.env['GOOGLE_API_KEY'];
        if (!apiKey) {
            throw createModelError(
                'GOOGLE_API_KEY is not set (checked again)',
                ErrorCategory.AUTHENTICATION,
                this.name,
                false,
                new Error('GOOGLE_API_KEY is not set')
            );
        }

        const genAI = new GoogleGenerativeAI(apiKey);

        // Define the tool for Gemini based on the provided schema
        const functionDeclaration: FunctionDeclaration = {
            name: 'generate_structured_data', // Consistent name
            description: 'Generate structured data based on the provided information and schema.',
            parameters: schema as unknown as FunctionDeclarationSchema, // Cast the generic schema
        };

        const tools: Tool[] = [{ functionDeclarations: [functionDeclaration] }];

        // Force the model to use the tool
        const toolConfig = {
            functionCallingConfig: {
                mode: 'ANY' as FunctionCallingMode, // Use 'ANY' or 'AUTO', 'NONE' would disable it
                // Optionally force a specific function if multiple were provided
                allowedFunctionNames: ['generate_structured_data'],
            },
        };

        const modelInstance = genAI.getGenerativeModel({
            model: this.model,
            tools, // Pass tools here
            toolConfig, // Pass tool config here
        });

        return withErrorHandlingAndRetry(
            async (_signal: AbortSignal) => {
                // Gemini SDK might not use signal directly

                const result = await modelInstance.generateContent(prompt);
                const response = result.response;

                if (!response) {
                    throw new TriumvirateError(
                        'Gemini returned an empty response object for structured call',
                        ErrorCategory.INVALID_RESPONSE,
                        `${this.name} Structured`,
                        false,
                        result
                    );
                }

                // Check for safety blocks before checking function calls
                if (response.promptFeedback?.blockReason) {
                    throw createModelError(
                        `Gemini structured request blocked due to safety settings: ${response.promptFeedback.blockReason}`,
                        ErrorCategory.INVALID_RESPONSE,
                        `${this.name} Structured`,
                        false,
                        response.promptFeedback
                    );
                }
                if (!response.candidates?.length || !response.candidates[0]?.content) {
                    throw new TriumvirateError(
                        'Gemini structured response missing expected candidate content',
                        ErrorCategory.INVALID_RESPONSE,
                        `${this.name} Structured`,
                        false,
                        response
                    );
                }

                // Check for function calls in the response
                const functionCalls = response.functionCalls();
                if (!functionCalls || functionCalls.length === 0) {
                    console.error(
                        'Gemini response content (no function call):',
                        await response.text()
                    ); // Log text content if no function call
                    throw new TriumvirateError(
                        'Gemini did not return the expected function call.',
                        ErrorCategory.INVALID_RESPONSE,
                        `${this.name} Structured`,
                        false,
                        response
                    );
                }

                // Assuming the first function call is the one we want
                const functionCall = functionCalls[0];
                if (functionCall?.name !== 'generate_structured_data') {
                    throw new TriumvirateError(
                        `Gemini returned an unexpected function call name: ${functionCall?.name}`,
                        ErrorCategory.INVALID_RESPONSE,
                        `${this.name} Structured`,
                        false,
                        response
                    );
                }

                // The arguments are already parsed into an object by the SDK
                const parsedData = functionCall.args as T;

                if (!parsedData) {
                    throw new TriumvirateError(
                        'Gemini function call arguments are missing or empty.',
                        ErrorCategory.INVALID_RESPONSE,
                        `${this.name} Structured`,
                        false,
                        response
                    );
                }

                // Extract usage from the response object
                if (!response.usageMetadata) {
                    console.warn(
                        'Gemini structured response missing usageMetadata. Tokens/Cost will be zero.'
                    );
                }
                const usage: LLMUsage = {
                    input_tokens: response.usageMetadata?.promptTokenCount || 0,
                    output_tokens: response.usageMetadata?.candidatesTokenCount || 0,
                    total_tokens: response.usageMetadata?.totalTokenCount || 0,
                };
                if (
                    usage.total_tokens === 0 &&
                    (usage.input_tokens > 0 || usage.output_tokens > 0)
                ) {
                    usage.total_tokens = usage.input_tokens + usage.output_tokens;
                }

                const cost = estimateCost(this.model, usage.input_tokens, usage.output_tokens);

                // Log the successful API call
                enhancedLogger.logApiCall({
                    timestamp: new Date().toISOString(),
                    model: this.model,
                    operation: 'structured_output', // Specific operation
                    inputTokens: usage.input_tokens,
                    outputTokens: usage.output_tokens,
                    totalTokens: usage.total_tokens,
                    success: true,
                    cost: cost,
                });

                return {
                    data: parsedData,
                    usage,
                    cost,
                };
            },
            `${this.name} Structured`, // Unique component name
            maxRetries,
            API_TIMEOUT_MS * 2 // Longer timeout for potentially complex structured calls
        );
    }
}
