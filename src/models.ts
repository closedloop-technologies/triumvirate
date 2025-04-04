import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { normalizeUsage } from './types/usage';
import type { ModelUsage, OpenAIUsage, ClaudeUsage, GeminiUsage } from './types/usage';
import {
    handleModelError,
    exponentialBackoff,
    withErrorHandlingAndRetry,
    ErrorCategory,
    createModelError,
    type ModelError,
} from './utils/model-utils';
import { API_TIMEOUT_MS, MAX_API_RETRIES } from './utils/constants';

// Load environment variables from .env file
dotenv.config();

/**
 * Run the OpenAI model with the given prompt
 * @param prompt - The prompt to send to the model
 * @param retryCount - Current retry count
 * @param maxRetries - Maximum number of retries
 * @returns Promise with the model response text and usage statistics
 */
async function runOpenAIModel(
    prompt: string,
    retryCount = 0,
    maxRetries = MAX_API_RETRIES
): Promise<{ text: string; usage: OpenAIUsage }> {
    // Validate API key
    if (!process.env['OPENAI_API_KEY']) {
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
                const response = await openai.responses.create(
                    {
                        model: 'gpt-4o',
                        input: prompt,
                        temperature: 0.2,
                        store: false,
                    },
                    { signal }
                );

                // Validate response structure
                if (!response) {
                    throw new Error('OpenAI returned an empty response');
                }

                const { output_text, usage } = response;

                // Validate usage data
                if (!usage) {
                    throw new Error('OpenAI response is missing usage data');
                }

                // Validate output text
                return {
                    text: output_text ?? '',
                    usage: usage as OpenAIUsage,
                };
            } catch (error) {
                // Convert to a ModelError with appropriate category
                throw handleModelError(error, 'OpenAI', maxRetries);
            }
        },
        'OpenAI',
        maxRetries,
        API_TIMEOUT_MS
    );
}

/**
 * Run the Claude model with the given prompt
 * @param prompt - The prompt to send to the model
 * @param retryCount - Current retry count
 * @param maxRetries - Maximum number of retries
 * @returns Promise with the model response text and usage statistics
 */
async function runClaudeModel(
    prompt: string,
    retryCount = 0,
    maxRetries = MAX_API_RETRIES
): Promise<{ text: string; usage: ClaudeUsage }> {
    // Validate API key
    if (!process.env['ANTHROPIC_API_KEY']) {
        throw createModelError(
            'ANTHROPIC_API_KEY is not set',
            ErrorCategory.AUTHENTICATION,
            'Claude',
            false,
            new Error('ANTHROPIC_API_KEY is not set')
        );
    }

    // Validate input
    if (!prompt || typeof prompt !== 'string') {
        throw createModelError(
            'Invalid prompt: must be a non-empty string',
            ErrorCategory.INVALID_RESPONSE,
            'Claude',
            false,
            new Error('Invalid prompt')
        );
    }

    // Create Anthropic client with OpenAI compatibility layer
    const openai = new OpenAI({
        apiKey: process.env['ANTHROPIC_API_KEY'],
        baseURL: 'https://api.anthropic.com/v1/',
    });

    return withErrorHandlingAndRetry(
        async (signal: AbortSignal) => {
            try {
                const msg = await openai.chat.completions.create(
                    {
                        model: 'claude-3-7-sonnet-20250219',
                        max_tokens: 1024,
                        messages: [{ role: 'user', content: prompt }],
                    },
                    { signal }
                );

                // Validate response structure
                if (!msg || !msg.choices) {
                    throw new Error('Claude returned an invalid response structure');
                }

                const { choices } = msg;

                // Check if choices array is empty or first choice is missing
                if (!choices.length || !choices[0]) {
                    throw new Error('Claude response is missing choices');
                }

                // Safely extract message content with nullish coalescing
                const messageContent = choices[0]?.message?.content ?? '';

                // Create usage object with safe defaults
                const usage: ClaudeUsage = {
                    input_tokens: msg.usage?.prompt_tokens ?? 0,
                    output_tokens: msg.usage?.completion_tokens ?? 0,
                    total_tokens: msg.usage?.total_tokens ?? 0,
                };

                return { text: messageContent, usage };
            } catch (error) {
                // Convert to a ModelError with appropriate category
                throw handleModelError(error, 'Claude', maxRetries);
            }
        },
        'Claude',
        maxRetries,
        API_TIMEOUT_MS
    );
}

/**
 * Run Claude model with structured output using the Tools API
 * This approach provides more reliable structured data than json_object response format
 */
async function runClaudeModelStructured<T>(
    prompt: string,
    schema: Record<string, unknown>,
    retryCount = 0,
    maxRetries = MAX_API_RETRIES
): Promise<{ data: T; usage: ClaudeUsage }> {
    if (!process.env['ANTHROPIC_API_KEY']) {
        throw new Error('ANTHROPIC_API_KEY is not set');
    }

    const apiKey = process.env['ANTHROPIC_API_KEY'];
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

            const result = (await response.json()) as { content: any[]; usage: ClaudeUsage };

            console.log('runClaudeModelStructured result', JSON.stringify(result, null, 2));

            // Extract the tool call from the response
            const toolCallContent = result.content.find(
                (item: any) => item.type === 'tool_use' && item.name === toolName
            );

            if (!toolCallContent) {
                console.error('Claude tool response structure:', String(result));
                throw new Error('Claude did not return expected tool use response');
            }

            const usage: ClaudeUsage = {
                input_tokens: result.usage?.input_tokens || 0,
                output_tokens: result.usage?.output_tokens || 0,
                total_tokens:
                    (result.usage?.input_tokens || 0) + (result.usage?.output_tokens || 0),
                cache_creation_input_tokens: result.usage?.cache_creation_input_tokens,
                cache_read_input_tokens: result.usage?.cache_read_input_tokens,
            };

            // Log the full input for debugging
            console.log(
                `Claude tool '${toolName}' response:`,
                JSON.stringify(toolCallContent.input, null, 2)
            );

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

/**
 * Run the Gemini model with the given prompt
 * @param prompt - The prompt to send to the model
 * @param retryCount - Current retry count
 * @param maxRetries - Maximum number of retries
 * @returns Promise with the model response text and usage statistics
 */
async function runGeminiModel(
    prompt: string,
    retryCount = 0,
    maxRetries = MAX_API_RETRIES
): Promise<{ text: string; usage: GeminiUsage }> {
    // Validate API key
    if (!process.env['GOOGLE_API_KEY']) {
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

    const ai = new GoogleGenAI({ apiKey: process.env['GOOGLE_API_KEY'] });

    return withErrorHandlingAndRetry(
        async (signal: AbortSignal) => {
            try {
                // Note: Gemini API might not directly support AbortSignal
                // We're using the signal in our HOF, but the actual API call might not use it
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-pro-exp-03-25',
                    contents: prompt,
                });

                // Validate response structure
                if (!response) {
                    throw new Error('Gemini returned an empty response');
                }

                const { usageMetadata, candidates } = response;

                // Create usage object with safe defaults using nullish coalescing
                const usage: GeminiUsage = {
                    input_tokens: usageMetadata?.promptTokenCount ?? 0,
                    output_tokens: usageMetadata?.candidatesTokenCount ?? 0,
                    total_tokens: usageMetadata?.totalTokenCount ?? 0,
                    promptTokenCount: usageMetadata?.promptTokenCount,
                    candidatesTokenCount: usageMetadata?.candidatesTokenCount,
                    totalTokenCount: usageMetadata?.totalTokenCount,
                };

                // Validate candidates array
                if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
                    throw new Error('Gemini response is missing candidates');
                }

                // Validate first candidate's content
                if (!candidates[0]?.content) {
                    throw new Error('Gemini response is missing content in first candidate');
                }

                const { content } = candidates[0];

                // Extract text from parts with proper null checking
                let text = '';
                if (content?.parts && Array.isArray(content.parts) && content.parts.length > 0) {
                    text = content.parts
                        .map(part => (part && typeof part.text === 'string' ? part.text : ''))
                        .join('');
                }

                return { text, usage };
            } catch (error) {
                // Convert to a ModelError with appropriate category
                throw handleModelError(error, 'Gemini', maxRetries);
            }
        },
        'Gemini',
        maxRetries,
        API_TIMEOUT_MS
    );
}

/**
 * Run a code review using the specified model
 * @param code - The code to review
 * @param modelName - The name of the model to use
 * @returns Promise with the review text and usage statistics
 */
export async function runModelReview(
    code: string,
    modelName: string
): Promise<{ text: string; usage: ModelUsage }> {
    // Validate inputs
    if (!code || typeof code !== 'string') {
        throw createModelError(
            'Invalid code: must be a non-empty string',
            ErrorCategory.INVALID_RESPONSE,
            modelName || 'Unknown',
            false,
            new Error('Invalid code parameter')
        );
    }

    if (!modelName || typeof modelName !== 'string') {
        throw createModelError(
            'Invalid model name: must be a non-empty string',
            ErrorCategory.INVALID_RESPONSE,
            'Unknown',
            false,
            new Error('Invalid modelName parameter')
        );
    }

    const prompt = `Please review the following codebase for bugs, design flaws, and potential improvements:\n\n${code}`;

    try {
        // Run the appropriate model
        if (modelName === 'openai') {
            return await runOpenAIModel(prompt);
        }

        if (modelName === 'claude') {
            return await runClaudeModel(prompt);
        }

        if (modelName === 'gemini') {
            return await runGeminiModel(prompt);
        }

        // Handle unsupported model
        throw createModelError(
            `Unsupported model: ${modelName}`,
            ErrorCategory.INVALID_RESPONSE,
            modelName,
            false,
            new Error(`Unsupported model: ${modelName}`)
        );
    } catch (error) {
        // If error is already a ModelError, rethrow it
        if (error && typeof error === 'object' && 'category' in error) {
            throw error;
        }
        // Otherwise, convert to a ModelError
        throw handleModelError(error, modelName, MAX_API_RETRIES);
    }
}

/**
 * Export the structured Claude model function for use in report generation
 */
export { runClaudeModelStructured };
