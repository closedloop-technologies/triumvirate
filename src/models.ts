import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

async function runOpenAIModel(prompt: string, retryCount = 0, maxRetries = 3): Promise<{ text: string; usage: any }> {
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
        return { text: output_text || '', usage };
    } catch (error: any) {
        // Clear any pending timeout if there was an error

        // Handle timeout errors with retry logic
        if (error.name === 'AbortError' || error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
            if (retryCount < maxRetries) {
                console.log(`OpenAI API call timed out. Retrying (${retryCount + 1}/${maxRetries})...`);
                // Exponential backoff: wait longer between each retry
                const backoffMs = 1000 * Math.pow(2, retryCount);
                await new Promise(resolve => setTimeout(resolve, backoffMs));
                return runOpenAIModel(prompt, retryCount + 1, maxRetries);
            } else {
                throw new Error(`OpenAI API call failed after ${maxRetries} retries due to timeouts`);
            }
        }

        // Handle authentication errors (bad API key)
        if (error.status === 401 || error.message?.includes('authentication')) {
            throw new Error('Invalid OpenAI API key. Please check your API key and try again.');
        }

        // Handle input too large errors
        if (error.status === 400 && (error.message?.includes('too large') || error.message?.includes('maximum context length'))) {
            throw new Error('Input is too large for the model. Please reduce the size of your input.');
        }

        // Handle other errors
        throw new Error(`OpenAI API error: ${error.message || 'Unknown error'}`);
    }
}

export async function runModelReview(code: string, modelName: string): Promise<{ text: string; usage: any }> {
    const prompt = `Please review the following codebase for bugs, design flaws, and potential improvements:\n\n${code}`;

    if (modelName === 'openai') {
        return await runOpenAIModel(prompt);
    }

    if (modelName === 'claude') {
        if (!process.env['ANTHROPIC_API_KEY']) {
            throw new Error('ANTHROPIC_API_KEY is not set');
        }
        const anthropic = new Anthropic({ apiKey: process.env['ANTHROPIC_API_KEY'] });
        const msg = await anthropic.messages.create({
            model: 'claude-3-opus-20240229',
            max_tokens: 1024,
            messages: [{ role: 'user', content: prompt }],
        });
        return msg.content[0].text;
    }

    if (modelName === 'gemini') {
        if (!process.env['GOOGLE_API_KEY']) {
            throw new Error('GOOGLE_API_KEY is not set');
        }
        const genAI = new GoogleGenerativeAI(process.env['GOOGLE_API_KEY']);
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    }

    throw new Error(`Unsupported model: ${modelName}`);
}
