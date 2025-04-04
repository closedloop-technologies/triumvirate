import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { normalizeUsage } from './types/usage';
import type { ModelUsage, OpenAIUsage, ClaudeUsage, GeminiUsage } from './types/usage';
import {
    handleModelError,
    exponentialBackoff,
    withErrorHandlingAndRetry,
} from './utils/model-utils';
import { API_TIMEOUT_MS, MAX_API_RETRIES } from './utils/constants';

dotenv.config();

async function runOpenAIModel(
    prompt: string,
    retryCount = 0,
    maxRetries = MAX_API_RETRIES
): Promise<{ text: string; usage: OpenAIUsage }> {
    if (!process.env['OPENAI_API_KEY']) {
        throw new Error('OPENAI_API_KEY is not set');
    }

    const openai = new OpenAI({ apiKey: process.env['OPENAI_API_KEY'] });

    return withErrorHandlingAndRetry(
        async (signal: AbortSignal) => {
            const response = await openai.responses.create(
                {
                    model: 'gpt-4o',
                    input: prompt,
                    temperature: 0.2,
                    store: false,
                },
                { signal }
            );

            const { output_text, usage } = response;
            if (!usage) {
                throw new Error('OpenAI response is missing usage');
            }
            return { text: output_text || '', usage: usage as OpenAIUsage };
        },
        'OpenAI',
        maxRetries,
        API_TIMEOUT_MS
    );
}

async function runClaudeModel(
    prompt: string,
    retryCount = 0,
    maxRetries = MAX_API_RETRIES
): Promise<{ text: string; usage: ClaudeUsage }> {
    if (!process.env['ANTHROPIC_API_KEY']) {
        throw new Error('ANTHROPIC_API_KEY is not set');
    }

    // Create Anthropic client with OpenAI compatibility layer
    const openai = new OpenAI({
        apiKey: process.env['ANTHROPIC_API_KEY'],
        baseURL: 'https://api.anthropic.com/v1/',
    });

    return withErrorHandlingAndRetry(
        async (signal: AbortSignal) => {
            const msg = await openai.chat.completions.create(
                {
                    model: 'claude-3-7-sonnet-20250219',
                    max_tokens: 1024,
                    messages: [{ role: 'user', content: prompt }],
                },
                { signal }
            );

            const { choices } = msg;
            const usage: ClaudeUsage = {
                input_tokens: msg.usage?.prompt_tokens || 0,
                output_tokens: msg.usage?.completion_tokens || 0,
                total_tokens: msg.usage?.total_tokens || 0,
            };

            return { text: choices[0]?.message?.content || '', usage };
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

async function runGeminiModel(
    prompt: string,
    retryCount = 0,
    maxRetries = MAX_API_RETRIES
): Promise<{ text: string; usage: GeminiUsage }> {
    if (!process.env['GOOGLE_API_KEY']) {
        throw new Error('GOOGLE_API_KEY is not set');
    }

    const ai = new GoogleGenAI({ apiKey: process.env['GOOGLE_API_KEY'] });

    return withErrorHandlingAndRetry(
        async (signal: AbortSignal) => {
            // Note: Gemini API might not directly support AbortSignal
            // We're using the signal in our HOF, but the actual API call might not use it
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-pro-exp-03-25',
                contents: prompt,
            });

            const { usageMetadata, candidates } = response;
            const usage: GeminiUsage = {
                input_tokens: usageMetadata?.promptTokenCount || 0,
                output_tokens: usageMetadata?.candidatesTokenCount || 0,
                total_tokens: usageMetadata?.totalTokenCount || 0,
                promptTokenCount: usageMetadata?.promptTokenCount,
                candidatesTokenCount: usageMetadata?.candidatesTokenCount,
                totalTokenCount: usageMetadata?.totalTokenCount,
            };
            if (!candidates?.[0]?.content) {
                throw new Error('Gemini response is missing content');
            }
            const { content } = candidates[0];
            const text = content?.parts?.length
                ? content.parts.map(part => part.text || '').join('')
                : '';
            return { text, usage };
        },
        'Gemini',
        maxRetries,
        API_TIMEOUT_MS
    );
}

export async function runModelReview(
    code: string,
    modelName: string
): Promise<{ text: string; usage: ModelUsage }> {
    const prompt = `Please review the following codebase for bugs, design flaws, and potential improvements:\n\n${code}`;

    if (modelName === 'openai') {
        return await runOpenAIModel(prompt);
    }

    if (modelName === 'claude') {
        return await runClaudeModel(prompt);
    }

    if (modelName === 'gemini') {
        return await runGeminiModel(prompt);
    }

    throw new Error(`Unsupported model: ${modelName}`);
}

/**
 * Export the structured Claude model function for use in report generation
 */
export { runClaudeModelStructured };
