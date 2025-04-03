import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

export async function runModelReview(code: string, modelName: string) {
    const prompt = `Please review the following codebase for bugs, design flaws, and potential improvements:\n\n${code}`;

    if (modelName === 'openai') {
        if (!process.env['OPENAI_API_KEY']) {
            throw new Error('OPENAI_API_KEY is not set');
        }
        const openai = new OpenAI({ apiKey: process.env['OPENAI_API_KEY'] });
        const completion = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [{ role: 'user', content: prompt }],
        });
        console.log('openai', completion);
        return completion.choices[0].message.content;
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
