import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

interface ApiKeyRequirements {
  model: string;
  envVar: string;
}

const MODEL_API_KEYS: ApiKeyRequirements[] = [
  { model: 'openai', envVar: 'OPENAI_API_KEY' },
  { model: 'claude', envVar: 'ANTHROPIC_API_KEY' },
  { model: 'gemini', envVar: 'GOOGLE_API_KEY' },
];

/**
 * Validates if the required API keys are set for the requested models
 * @param requestedModels - Array of model names to validate
 * @returns An object with validation results
 */
export function validateApiKeys(requestedModels: string[]): {
  valid: boolean;
  missingKeys: string[];
  message: string;
} {
  // Default result
  const result = {
    valid: true,
    missingKeys: [] as string[],
    message: 'All required API keys are set.',
  };

  console.log('Checking API keys...');
  console.log(MODEL_API_KEYS, requestedModels);
  // Check each requested model
  for (const modelName of requestedModels) {
    const requirement = MODEL_API_KEYS.find(req => req.model === modelName);

    if (requirement) {
      const apiKey = process.env[requirement.envVar];

      if (!apiKey) {
        result.valid = false;
        result.missingKeys.push(requirement.envVar);
      }
      console.log(apiKey);
    }
    console.log(requirement, result);
  }

  // Set message if keys are missing
  if (!result.valid) {
    result.message = `Missing required API keys: ${result.missingKeys.join(', ')}. Please set them in your environment or .env file.`;
  }

  return result;
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
   OPENAI_API_KEY=your-openai-key
   ANTHROPIC_API_KEY=your-anthropic-key
   GOOGLE_API_KEY=your-google-key

3. Alternatively, set them as environment variables:
   export OPENAI_API_KEY=your-openai-key
   export ANTHROPIC_API_KEY=your-anthropic-key
   export GOOGLE_API_KEY=your-google-key

You only need to set the API keys for the models you plan to use.
`;
}
