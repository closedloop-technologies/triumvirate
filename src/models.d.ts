/**
 * Runs a code review using the specified model
 * @param prompt The prompt to send to the model
 * @param modelName The name of the model to use ('openai', 'claude', or 'gemini')
 * @returns A promise that resolves to the model's response
 */
export function runModelReview(prompt: string, modelName: string): Promise<string>;
