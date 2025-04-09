import * as dotenv from 'dotenv';

import { ClaudeProvider, GeminiProvider, OpenAIProvider } from '../src/utils/llm-providers';

// Load environment variables
dotenv.config();

// Debug helper function
function debugObject(obj: unknown) {
    return JSON.stringify(
        obj,
        (key, value) => {
            if (value instanceof Error) {
                // Create a new object with Error properties
                // Spread first to avoid overwriting built-in properties
                const errorObj: Error = {
                    ...value,
                    // Then explicitly add the important properties to ensure they're included
                    message: value.message,
                    stack: value.stack,
                };
                return errorObj;
            }
            return value;
        },
        2
    );
}

async function testProviders() {
    console.log('Testing LLM Provider Factory...');
    console.log('Environment check:');
    console.log('- OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);
    console.log('- ANTHROPIC_API_KEY exists:', !!process.env.ANTHROPIC_API_KEY);
    console.log('- GOOGLE_API_KEY exists:', !!process.env.GOOGLE_API_KEY);

    // Test individual providers
    // Test OpenAI provider
    try {
        console.log('\nTesting OpenAI provider:');
        const openaiProvider = new OpenAIProvider();
        console.log('OpenAI provider available:', openaiProvider.isAvailable());

        if (openaiProvider.isAvailable()) {
            try {
                const openaiResponse = await openaiProvider.runCompletion('Say hello world', 1); // Only try once
                console.log('OpenAI response:', openaiResponse);
            } catch (error) {
                console.error('OpenAI provider execution failed:', error.message);
                console.error('Detailed error:', debugObject(error));
            }
        }
    } catch (error) {
        console.error('OpenAI provider initialization failed:', error.message);
        console.error('Detailed error:', debugObject(error));
    }

    // Test Claude provider if available
    try {
        console.log('\nTesting Claude provider:');
        const claudeProvider = new ClaudeProvider();
        console.log('Claude provider available:', claudeProvider.isAvailable());

        if (claudeProvider.isAvailable()) {
            try {
                const claudeResponse = await claudeProvider.runCompletion('Say hello world', 1); // Only try once
                console.log('Claude response:', claudeResponse);
            } catch (error) {
                console.error('Claude provider execution failed:', error.message);
                console.error('Detailed error:', debugObject(error));
            }
        }
    } catch (error) {
        console.error('Claude provider initialization failed:', error.message);
        console.error('Detailed error:', debugObject(error));
    }

    // Test Gemini provider if available
    try {
        console.log('\nTesting Gemini provider:');
        const geminiProvider = new GeminiProvider();
        console.log('Gemini provider available:', geminiProvider.isAvailable());

        if (geminiProvider.isAvailable()) {
            try {
                const geminiResponse = await geminiProvider.runCompletion('Say hello world', 1); // Only try once
                console.log('Gemini response:', geminiResponse);
            } catch (error) {
                console.error('Gemini provider execution failed:', error.message);
                console.error('Detailed error:', debugObject(error));
            }
        }
    } catch (error) {
        console.error('Gemini provider initialization failed:', error.message);
        console.error('Detailed error:', debugObject(error));
    }
}

testProviders().catch(error => {
    console.error('Unhandled error in test:', error);
    console.error('Detailed error:', debugObject(error));
});
