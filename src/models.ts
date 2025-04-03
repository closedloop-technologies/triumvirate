import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { normalizeUsage } from './types/usage';
import type { ModelUsage, OpenAIUsage, ClaudeUsage, GeminiUsage } from './types/usage';
import { handleModelError, exponentialBackoff } from './utils/model-utils';

dotenv.config();

async function runOpenAIModel(
    prompt: string,
    retryCount = 0,
    maxRetries = 3
): Promise<{ text: string; usage: OpenAIUsage }> {
    if (!process.env['OPENAI_API_KEY']) {
        throw new Error('OPENAI_API_KEY is not set');
    }

    try {
        const openai = new OpenAI({ apiKey: process.env['OPENAI_API_KEY'] });

        // Set a timeout for the API call
        const timeoutMs = 30000; // 30 seconds timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const response = await openai.responses.create(
            {
                model: 'gpt-4o',
                input: prompt,
                temperature: 0.2,
                store: false,
            },
            { signal: controller.signal }
        );

        clearTimeout(timeoutId);
        console.log('openai', response);
        const { output_text, usage } = response;
        // usage is:
        //   usage: {
        //     input_tokens: 7824,
        //     input_tokens_details: { cached_tokens: 7808 },
        //     output_tokens: 727,
        //     output_tokens_details: { reasoning_tokens: 0 },
        //     total_tokens: 8551
        //   },
        if (!usage) {
            throw new Error('OpenAI response is missing usage');
        }
        return { text: output_text || '', usage: usage as OpenAIUsage };
    } catch (error: any) {
        // Clear any pending timeout if there was an error

        // Handle timeout errors with retry logic
        if (
            (error.name === 'AbortError' ||
            error.code === 'ETIMEDOUT' ||
            error.message?.includes('timeout')) &&
            retryCount < maxRetries
        ) {
            console.log(
                `OpenAI API call timed out. Retrying (${retryCount + 1}/${maxRetries})...`
            );
            // Use exponential backoff utility
            await exponentialBackoff(retryCount);
            return runOpenAIModel(prompt, retryCount + 1, maxRetries);
        }
        
        // Use the shared error handler for all other errors
        throw handleModelError(error, 'OpenAI', maxRetries);
    }
}

async function runClaudeModel(
    prompt: string,
    retryCount = 0,
    maxRetries = 3
): Promise<{ text: string; usage: ClaudeUsage }> {
    if (!process.env['ANTHROPIC_API_KEY']) {
        throw new Error('ANTHROPIC_API_KEY is not set');
    }

    // Set up timeout variables outside try block for access in catch block
    const timeoutMs = 30000; // 30 seconds timeout
    const controller = new AbortController();
    let timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        // Create Anthropic client with type assertion to handle potential type issues
        // const anthropic = new Anthropic() // defaults to process.env["ANTHROPIC_API_KEY"]

        const openai = new OpenAI({
            apiKey: process.env['ANTHROPIC_API_KEY'], // Your Anthropic API key
            baseURL: 'https://api.anthropic.com/v1/', // Anthropic API endpoint
        });

        const msg = await openai.chat.completions.create(
            {
                model: 'claude-3-7-sonnet-20250219',
                max_tokens: 1024,
                messages: [{ role: 'user', content: prompt }],
            },
            { signal: controller.signal }
        );

        clearTimeout(timeoutId);
        console.log('claude', msg);
        const { choices } = msg;
        const usage: ClaudeUsage = {
            input_tokens: msg.usage?.prompt_tokens || 0,
            output_tokens: msg.usage?.completion_tokens || 0,
            total_tokens: msg.usage?.total_tokens || 0,
            prompt_tokens: msg.usage?.prompt_tokens,
            completion_tokens: msg.usage?.completion_tokens,
        };

        return { text: choices[0]?.message?.content || '', usage };
    } catch (error: any) {
        // Clear any pending timeout if there was an error
        clearTimeout(timeoutId);

        // Handle timeout errors with retry logic
        if (
            (error.name === 'AbortError' ||
            error.code === 'ETIMEDOUT' ||
            error.message?.includes('timeout')) &&
            retryCount < maxRetries
        ) {
            console.log(
                `Claude API call timed out. Retrying (${retryCount + 1}/${maxRetries})...`
            );
            // Use exponential backoff utility
            await exponentialBackoff(retryCount);
            return runClaudeModel(prompt, retryCount + 1, maxRetries);
        }
        
        // Use the shared error handler for all other errors
        throw handleModelError(error, 'Claude', maxRetries);
    }
}

async function runGeminiModel(
    prompt: string,
    retryCount = 0,
    maxRetries = 3
): Promise<{ text: string; usage: GeminiUsage }> {
    if (!process.env['GOOGLE_API_KEY']) {
        throw new Error('GOOGLE_API_KEY is not set');
    }

    // Set up timeout variables outside try block for access in catch block
    const timeoutMs = 30000; // 30 seconds timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const ai = new GoogleGenAI({ apiKey: process.env['GOOGLE_API_KEY'] });

        // Call the Gemini API with the AbortController signal
        // Note: The exact way to pass the signal may vary depending on the API implementation
        // This is based on common patterns, but may need adjustment
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro-exp-03-25',
            contents: prompt,
        });

        // Clear the timeout since we got a response
        clearTimeout(timeoutId);
        console.log('gemini', response);

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
        console.log('gemini content', text);
        return { text, usage };
    } catch (error: any) {
        // Clear any pending timeout if there was an error
        clearTimeout(timeoutId);

        // Handle timeout errors with retry logic
        if (
            error.name === 'AbortError' ||
            error.code === 'ETIMEDOUT' ||
            error.message?.includes('timeout')
        ) {
            if (retryCount < maxRetries) {
                console.log(
                    `Gemini API call timed out. Retrying (${retryCount + 1}/${maxRetries})...`
                );
                // Exponential backoff: wait longer between each retry
                const backoffMs = 1000 * Math.pow(2, retryCount);
                await new Promise(resolve => setTimeout(resolve, backoffMs));
                return runGeminiModel(prompt, retryCount + 1, maxRetries);
            } else {
                throw new Error(
                    `Gemini API call failed after ${maxRetries} retries due to timeouts`
                );
            }
        }

        // Handle authentication errors (bad API key)
        if (
            error.status === 401 ||
            error.message?.includes('authentication') ||
            error.message?.includes('API key')
        ) {
            throw new Error('Invalid Google API key. Please check your API key and try again.');
        }

        // Handle input too large errors
        if (
            error.status === 400 &&
            (error.message?.includes('too large') ||
                error.message?.includes('maximum context length'))
        ) {
            throw new Error(
                'Input is too large for the model. Please reduce the size of your input.'
            );
        }

        // Handle other errors
        throw new Error(`Gemini API error: ${error.message || 'Unknown error'}`);
    }
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
