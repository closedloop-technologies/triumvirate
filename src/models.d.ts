/**
 * Runs a code review using the specified model
 * @param code The code to review
 * @param modelName The name of the model to use ('openai', 'claude', or 'gemini')
 * @returns A promise that resolves to the review text
 */
export function runModelReview(code: string, modelName: string): Promise<string>;
