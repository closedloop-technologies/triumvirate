import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

interface ApiKeyRequirements {
    model: string;
    envVar: string;
    // Add format validation regex and minimum length for basic validation
    format?: RegExp;
    minLength?: number;
}
export const MODEL_API_KEYS: ApiKeyRequirements[] = [
    {
        model: 'openai',
        envVar: 'OPENAI_API_KEY',
        format: /^sk-[A-Za-z0-9_-]{36,}$/,
        minLength: 39,
    },
    {
        model: 'claude',
        envVar: 'ANTHROPIC_API_KEY',
        format: /^sk-ant-[A-Za-z0-9_-]{32,}$/,
        minLength: 39,
    },
    {
        model: 'gemini',
        envVar: 'GOOGLE_API_KEY',
        format: /^[A-Za-z0-9_-]{33,}$/,
        minLength: 33,
    },
];

/**
 * Validation result interface for API key validation
 */
export interface ApiKeyValidationResult {
    valid: boolean;
    missingKeys: string[];
    invalidKeys: string[];
    message: string;
}

/**
 * Validates if the required API keys are set and properly formatted for the requested models
 * @param requestedModels - Array of model names to validate
 * @returns An object with validation results
 */
export function validateApiKeys(requestedModels: string[]): ApiKeyValidationResult {
    // Default result
    const result: ApiKeyValidationResult = {
        valid: true,
        missingKeys: [],
        invalidKeys: [],
        message: 'All required API keys are set and appear valid.',
    };

    try {
        // Validate input
        if (!Array.isArray(requestedModels)) {
            throw new Error('requestedModels must be an array');
        }

        console.log('Checking API keys for models:', requestedModels.join(', '));

        // Check each requested model
        for (const modelName of requestedModels) {
            const requirement = MODEL_API_KEYS.find(req => req.model === modelName);

            if (!requirement) {
                console.warn(`Unknown model: ${modelName}, skipping API key validation`);
                continue;
            }

            const apiKey = process.env[requirement.envVar];

            // Check if key exists
            if (!apiKey) {
                result.valid = false;
                result.missingKeys.push(requirement.envVar);
                continue;
            }

            // Check key format if format validation is provided
            let isValidFormat = true;

            // Check minimum length
            if (requirement.minLength && apiKey.length < requirement.minLength) {
                isValidFormat = false;
            }

            // Check regex pattern
            if (isValidFormat && requirement.format && !requirement.format.test(apiKey)) {
                isValidFormat = false;
            }

            if (!isValidFormat) {
                result.valid = false;
                result.invalidKeys.push(requirement.envVar);
            }
        }

        // Set message based on validation results
        if (result.missingKeys.length > 0 && result.invalidKeys.length > 0) {
            result.message =
                `Missing API keys: ${result.missingKeys.join(', ')}. ` +
                `Invalid format for keys: ${result.invalidKeys.join(', ')}. ` +
                `Please check the API key setup instructions.`;
        } else if (result.missingKeys.length > 0) {
            result.message =
                `Missing required API keys: ${result.missingKeys.join(', ')}. ` +
                `Please set them in your environment or .env file.`;
        } else if (result.invalidKeys.length > 0) {
            result.message =
                `Invalid format for API keys: ${result.invalidKeys.join(', ')}. ` +
                `Please check that they match the expected format.`;
        }

        return result;
    } catch (error) {
        // Handle unexpected errors
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error validating API keys: ${errorMessage}`);

        return {
            valid: false,
            missingKeys: [],
            invalidKeys: [],
            message: `Error validating API keys: ${errorMessage}`,
        };
    }
}

/**
 * Get instructions for setting up API keys
 */
export function getApiKeySetupInstructions(): string {
    return `
To set up API keys:

1. Create a .env file in the project root (or copy from .env.example):
   cp .env.example .env

2. Add your API keys to the .env file:
   OPENAI_API_KEY=your-openai-key (starts with 'sk-')
   ANTHROPIC_API_KEY=your-anthropic-key (starts with 'sk-ant-')
   GOOGLE_API_KEY=your-google-key

3. Alternatively, set them as environment variables:
   export OPENAI_API_KEY=your-openai-key
   export ANTHROPIC_API_KEY=your-anthropic-key
   export GOOGLE_API_KEY=your-google-key

You only need to set the API keys for the models you plan to use.

Format requirements:
- OpenAI API keys start with 'sk-' followed by a string of characters
- Anthropic API keys start with 'sk-ant-' followed by a string of characters
- Google API keys are typically 39 characters long
`;
}
