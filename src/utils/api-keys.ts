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
        model: 'anthropic',
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
            const provider = modelName.split('/')[0];
            const requirement = MODEL_API_KEYS.find(req => req.model === provider);

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

/**
 * Process API key validation and handle user interaction for available models
 *
 * @param modelList - List of models to validate API keys for
 * @param failOnError - Whether to exit the process on validation failure
 * @param logger - Logger object to use (defaults to console)
 * @returns The filtered list of models with valid API keys
 */
export async function processApiKeyValidation(
    modelList: string[],
    failOnError: boolean = false,
    logger: { error: (message: string) => void; info: (message: string) => void } = console
): Promise<string[]> {
    try {
        const keyValidation = validateApiKeys(modelList);

        if (!keyValidation.valid) {
            // Display detailed error message based on validation results
            logger.error(`\n⚠️ ${keyValidation.message}\n`);

            // If there are invalid keys, provide more specific guidance
            if (keyValidation.invalidKeys.length > 0) {
                logger.error(
                    `⚠️ The following API keys have invalid formats: ${keyValidation.invalidKeys.join(', ')}\n`
                );
            }

            logger.info(getApiKeySetupInstructions());

            // If failOnError is true, exit immediately
            if (failOnError) {
                process.exit(1);
            }

            // Filter out models with missing or invalid keys
            const availableModels = modelList.filter(model => {
                const requirement = MODEL_API_KEYS.find(req => req.model === model);
                if (!requirement) {
                    return true; // Unknown model, assume it's available
                }

                const { envVar } = requirement;
                return (
                    !keyValidation.missingKeys.includes(envVar) &&
                    !keyValidation.invalidKeys.includes(envVar)
                );
            });

            if (availableModels.length === 0) {
                logger.error('\n❌ No models available with valid API keys.\n');
                process.exit(1);
            }

            // Ask for confirmation before proceeding with available models
            const readline = await import('readline');
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
            });

            const confirm = await new Promise<boolean>(resolve => {
                rl.question(
                    `Continue with available models (${availableModels.join(', ')})? (y/N): `,
                    (answer: string) => {
                        rl.close();
                        resolve(answer.toLowerCase() === 'y');
                    }
                );
            });

            if (!confirm) {
                logger.info('Exiting...');
                process.exit(0);
            }

            logger.info(`Continuing with available models: ${availableModels.join(', ')}...`);

            // Return the filtered model list
            return availableModels;
        } else {
            logger.info('✅ API key validation passed.');
            return modelList;
        }
    } catch (error) {
        // Handle unexpected errors in the validation process
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`\n❌ Error during API key validation: ${errorMessage}\n`);

        if (failOnError) {
            process.exit(1);
        }

        logger.info('Continuing despite API key validation error...');
        return modelList;
    }
}
