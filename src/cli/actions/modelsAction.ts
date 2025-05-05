/**
 * Models Action Module
 *
 * This module provides functionality to list all available LLM models with their cost information.
 */

import pc from 'picocolors';
import { COST_RATES, PROVIDERS } from '../../utils/constants';
import type { ModelCosts } from '../../utils/constants';

// Define model information structure
interface ModelInfo {
    provider: string;
    model: string;
    inputCost: number;
    outputCost: number;
    blendedCost: number;
    available: boolean;
    max_input_tokens?: number;
    max_output_tokens?: number;
}

/**
 * Get information about all available models
 */
export function getAvailableModels(): ModelInfo[] {
    const models: ModelInfo[] = [];

    // Check if COST_RATES is an array (from JSON file)
    if (Array.isArray(COST_RATES)) {
        // Process array format from JSON file
        for (const modelData of COST_RATES) {
            // Determine if the model is available based on API keys
            let isAvailable = false;
            if (modelData.provider === 'anthropic') {
                isAvailable = !!process.env['ANTHROPIC_API_KEY'];
            } else if (modelData.provider === 'openai') {
                isAvailable = !!process.env['OPENAI_API_KEY'];
            } else if (modelData.provider === 'google') {
                isAvailable = !!process.env['GOOGLE_API_KEY'];
            }

            // Calculate blended cost (0.9 × input + 0.1 × output)
            const blendedCost = modelData.input * 0.9 + modelData.output * 0.1;

            models.push({
                provider: modelData.provider,
                model: modelData.model,
                inputCost: modelData.input,
                outputCost: modelData.output,
                blendedCost: blendedCost,
                available: isAvailable
            });
        }
    } else {
        // Convert the COST_RATES object to an array of ModelInfo objects
        for (const key in COST_RATES) {
            if (Object.prototype.hasOwnProperty.call(COST_RATES, key)) {
                const modelData = COST_RATES[key] as ModelCosts;
                const [provider, _] = key.split('/');

                // Determine if the model is available based on API keys
                let isAvailable = false;
                if (provider) {
                    const providerKey = provider?.toUpperCase() + '_API_KEY';
                    isAvailable = !!process.env[providerKey];
                }
                models.push({
                    provider: modelData.provider,
                    model: modelData.model,
                    inputCost: modelData.input,
                    outputCost: modelData.output,
                    blendedCost: modelData.blended_per_million_tokens,
                    available: isAvailable,
                    max_input_tokens: modelData.max_input_tokens,
                    max_output_tokens: modelData.max_output_tokens
                });
            }
        }
    }

    if (models.length === 0) {
        // Fallback models in case the JSON file couldn't be loaded
        models.push(
            // Claude models
            {
                provider: 'anthropic',
                model: 'claude-3-7-sonnet-20250219',
                inputCost: 0.000003,
                outputCost: 0.000015,
                blendedCost: 0.000003 * 0.9 + 0.000015 * 0.1,
                available: !!process.env['ANTHROPIC_API_KEY']
            },
            // OpenAI models
            {
                provider: 'openai',
                model: 'gpt-4.1',
                inputCost: 0.000002,
                outputCost: 0.000008,
                blendedCost: 0.000002 * 0.9 + 0.000008 * 0.1,
                available: !!process.env['OPENAI_API_KEY']
            },
            // Gemini models
            {
                provider: 'google',
                model: 'gemini-2.5-pro-exp-03-25',
                inputCost: 0.0,
                outputCost: 0.0,
                blendedCost: 0.0,
                available: !!process.env['GOOGLE_API_KEY']
            }
        );
    }

    return models;
}

/**
 * Interface for models command options
 */
interface ModelsOptions {
    provider?: string;
    all?: boolean;
    sort?: 'cost' | 'name';
}

/**
 * Run the models action to list all available models
 */
export const runModelsAction = async (options: ModelsOptions = {}): Promise<void> => {
    const allModels = getAvailableModels();

    // Group models by provider for easier filtering and display
    const modelsByProvider: Record<string, ModelInfo[]> = {};
    const providers = new Set<string>();

    // Group models by provider
    for (const model of allModels) {
        const { provider } = model;
        providers.add(provider);

        // Initialize the array if it doesn't exist yet
        if (!modelsByProvider[provider]) {
            modelsByProvider[provider] = [];
        }

        // Now we can safely push to the array
        modelsByProvider[provider].push(model);
    }

    // Filter models by provider if specified
    let filteredProviders: string[];
    if (options.provider) {
        // Check if the specified provider exists in our data
        filteredProviders = modelsByProvider[options.provider] ? [options.provider] : [];
        if (filteredProviders.length === 0) {
            console.log(`Provider '${options.provider}' not found or has no models. Available providers: ${Array.from(providers).join(', ')}`);
            return;
        }
    } else {
        filteredProviders = Array.from(providers);
    }

    // Sort providers alphabetically
    filteredProviders.sort();
    console.log('\nAvailable LLM Models:\n');
    console.log('| Provider                   | Cost*    | Context   | Status   | Model                                          |');
    console.log('|----------------------------|----------|-----------|----------|------------------------------------------------|');

    // Display models grouped by provider, with limits unless --all is specified
    let totalDisplayed = 0;
    const maxDisplayPerProvider = options.all ? Number.MAX_SAFE_INTEGER : 100000;
    const maxTotalDisplay = options.all ? Number.MAX_SAFE_INTEGER : 100000;

    for (const provider of filteredProviders) {
        if (!modelsByProvider[provider]) {
            continue;
        }

        // Sort models based on the specified sort option
        let sortedModels = [...modelsByProvider[provider]];
        if (options.sort === 'name') {
            sortedModels.sort((a, b) => a.model.localeCompare(b.model));
        } else {
            // Default to sorting by cost (lowest first)
            sortedModels.sort((a, b) => a.blendedCost - b.blendedCost);
        }

        // Display up to maxDisplayPerProvider models per provider
        const displayModels = sortedModels.slice(0, maxDisplayPerProvider);

        for (const model of displayModels) {
            if (totalDisplayed >= maxTotalDisplay && filteredProviders.length > 1) {
                break;
            }

            const providerName = pc.cyan(model.provider.padEnd(26));
            const modelName = model.model.padEnd(46);
            const blendedCost = `$${model.blendedCost.toFixed(3)}`.padStart(8);
            const inputContext = model.max_input_tokens ? `${model.max_input_tokens.toLocaleString()}`.padStart(12) : 'Unknown'.padStart(12);
            const status = model.available ? pc.green('✓ Ready ') : pc.red('✗ No Key');

            console.log(`| ${providerName} | ${blendedCost} | ${inputContext} | ${status} | ${modelName}`);
            totalDisplayed++;
        }

        // Show count of additional models if there are more
        const remaining = sortedModels.length - displayModels.length;
        if (remaining > 0) {
            console.log(`| ${pc.cyan(provider.padEnd(9))} | ${pc.dim(`... and ${remaining} more models`).padEnd(26)} | ${' '.padEnd(26)} | ${' '.padEnd(20)} | ${' '.padEnd(8)} |`);
        }
    }

    // Show total model count
    console.log(`\nShowing ${totalDisplayed} of ${allModels.length} total models`);

    console.log('\n*Blended cost is calculated as: 0.9 × input cost + 0.1 × output cost per 1M tokens');

    console.log('\nTo use specific models, set the appropriate environment variables in format <provider>_API_KEY');

};
