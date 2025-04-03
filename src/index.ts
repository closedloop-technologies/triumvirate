import fs from 'fs';

import { runModelReview } from './models';
import { runRepomix } from './repomix';
import { normalizeUsage } from './types/usage';
import { COST_RATES } from './utils/constants';

/**
 * Run a triumvirate review across multiple LLMs
 */
export interface TriumvirateReviewOptions {
    models?: string[];
    exclude?: string[];
    diffOnly?: boolean;
    outputPath?: string;
    failOnError?: boolean;
    summaryOnly?: boolean;
    tokenLimit?: number;
    reviewType?: string;
    repomixOptions?: Record<string, any>;
}

export async function runTriumvirateReview({
    models = ['openai', 'claude', 'gemini'],
    exclude = [],
    diffOnly = false,
    outputPath = '.',
    failOnError = false,
    summaryOnly = false,
    tokenLimit = 100000,
    reviewType = 'general',
    repomixOptions = {},
}: TriumvirateReviewOptions = {}) {
    // Initialize results array
    const results = [];

    console.log('Packaging codebase with repomix...');

    // Merge options for repomix
    const mergedRepomixOptions = {
        exclude,
        diffOnly,
        tokenLimit,
        ...repomixOptions,
    };

    // Step 2: Call repomix to package the codebase
    let repomixResult;
    try {
        repomixResult = await runRepomix(mergedRepomixOptions);
        console.log(`Codebase packaged with ${repomixResult.tokenCount} tokens`);
    } catch (error) {
        console.error('Error running repomix:', error);
        return models.map(model => ({
            model,
            review: `ERROR: Failed to package codebase: ${(error as Error).message}`,
            metrics: {
                latency: '0ms',
                cost: '$0.00',
                error: (error as Error).message,
            },
        }));
    }

    // Read the packaged codebase
    const codebase = fs.readFileSync(repomixResult.filePath, 'utf8');

    // Step 3: Generate prompt template based on review type
    const promptTemplate = generatePromptTemplate(reviewType, repomixResult);

    // Step 4: Generate prompt and send to LLMs
    const prompt = promptTemplate.replace('{{CODEBASE}}', codebase);

    console.log('Sending prompt to models...');
    console.log(`Using review type: ${reviewType}`);

    // Step 5: Send to all models in parallel and collect responses
    const startTime = Date.now();

    // Create an async function to process each model
    const processModel = async (model: string) => {
        try {
            console.log(`Running review with model: ${model}`);
            const modelStartTime = Date.now();

            const { text: review, usage } = await runModelReview(prompt, model);
            const normalizedUsage = normalizeUsage(usage);
            const modelEndTime = Date.now();

            // Calculate latency
            const latency = modelEndTime - modelStartTime;
            const latencyStr = `${latency}ms`;
            console.log(`${model} review completed in ${latencyStr}`);

            // Estimate cost based on model and token count
            const cost = estimateCost(
                model,
                normalizedUsage.input_tokens,
                normalizedUsage.output_tokens
            );

            return {
                model,
                summary: summarizeReview(typeof review === 'string' ? review : String(review)),
                review: review,
                metrics: {
                    latency: latency,
                    tokenInput: normalizedUsage.input_tokens,
                    tokenOutput: normalizedUsage.output_tokens,
                    tokenTotal: normalizedUsage.total_tokens,
                    cost: `${cost.toFixed(8)}`,
                },
                error: false,
            };
        } catch (error) {
            console.error(`Error with model ${model}:`, error);
            return {
                model,
                review: `ERROR: ${(error as Error).message}`,
                metrics: {
                    error: (error as Error).message,
                },
                error: true,
            };
        }
    };

    // Process all models in parallel
    const modelPromises = models.map(model => processModel(model));
    const modelResults = await Promise.all(modelPromises);

    // Check if any model failed and we should fail on error
    const hasError = modelResults.some(result => result.error);
    if (hasError && failOnError) {
        // Filter out successful results if we're failing on error
        for (const result of modelResults.filter(result => result.error)) {
            const { error, ...rest } = result;
            results.push(rest);
        }
    } else {
        // Add all results (removing the temporary error flag)
        for (const result of modelResults) {
            const { error, ...rest } = result;
            results.push(rest);
        }
    }

    const totalTime = Date.now() - startTime;
    console.log(`Review completed in ${totalTime}ms`);

    // Step 6: Write results to output file if specified
    if (outputPath) {
        try {
            // Check if outputPath is a directory
            const fs_stat = fs.statSync(outputPath);
            let actualOutputPath = outputPath;
            let actualOutputPathMd = outputPath;

            if (fs_stat.isDirectory()) {
                // If it's a directory, create a file with a default name
                actualOutputPath = `${outputPath}/tri-review-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
                console.log(`Output path is a directory. Writing to ${actualOutputPath}`);
            }

            fs.writeFileSync(actualOutputPath, JSON.stringify(results, null, 2));

            if (fs_stat.isDirectory()) {
                // If it's a directory, create a file with a default name
                actualOutputPathMd = `${outputPath}/tri-review-${new Date().toISOString().replace(/[:.]/g, '-')}.md`;
                console.log(`Output path is a directory. Writing to ${actualOutputPathMd}`);
            }

            let mdResults = '# Triumvirate Code Review\n\n';
            mdResults += '## Overview\n\n';
            mdResults += '| Model | Status | Latency | Cost | Total Tokens |\n';
            mdResults += '|-------|--------|---------|------|-------------|\n';

            results.forEach(result => {
                const status = result.metrics.error ? '❌ Failed' : '✅ Passed';
                const latency = result.metrics.latency ? `${result.metrics.latency}ms` : 'N/A';
                const cost = result.metrics.cost || 'N/A';
                const tokens = result.metrics.tokenTotal || 'N/A';

                mdResults += `| ${result.model} | ${status} | ${latency} | $${cost} | ${tokens} |\n`;
            });

            mdResults += '\n';

            mdResults += '## Summaries\n\n';
            mdResults += results
                .map(result => {
                    return `### ${result.model}\n\n${result.summary}`;
                })
                .join('\n\n');
            mdResults += '## Results\n\n';

            mdResults += results
                .map(result => {
                    return `### ${result.model}\n\n${result.review}`;
                })
                .join('\n\n');

            fs.writeFileSync(actualOutputPathMd, mdResults);
            console.log(`Results written to ${actualOutputPath}`);
        } catch (error) {
            console.error(`Failed to write results to file: ${(error as Error).message}`);
            console.error('Please ensure the output path is valid and you have write permissions.');
        }
    }

    // Clean up temporary file
    try {
        await fs.promises.unlink(repomixResult.filePath);
    } catch (error) {
        console.warn('Could not delete temporary file:', error);
    }

    return results;
}

/**
 * Generate prompt template based on review type
 */
function generatePromptTemplate(reviewType: string, repomixResult: any): string {
    // Base template with structure info
    const baseTemplate = `You are an expert code reviewer. I'm going to share a codebase with you for review.

Directory Structure:
${repomixResult.directoryStructure}

Summary:
${repomixResult.summary}

Please review the following codebase and provide feedback:

{{CODEBASE}}`;

    // Specific templates for different review types
    const templates = {
        general: `${baseTemplate}

Provide a general review focusing on:
1. Code quality and readability
2. Potential bugs or issues
3. Architecture and design
4. Performance concerns
5. Security considerations

Format your response with these sections and provide specific examples where possible.`,

        security: `${baseTemplate}

Conduct a thorough security review focusing on:
1. Authentication and authorization vulnerabilities
2. Input validation and sanitization
3. Injection vulnerabilities (SQL, XSS, etc.)
4. Sensitive data exposure
5. Security misconfiguration
6. Hard-coded secrets or credentials
7. Insecure cryptographic storage
8. Insufficient logging and monitoring

Categorize issues by severity (Critical, High, Medium, Low) and provide specific recommendations for each.`,

        performance: `${baseTemplate}

Conduct a detailed performance review focusing on:
1. Computational complexity analysis
2. Memory usage and potential leaks
3. Asynchronous operations and concurrency
4. Database queries and data access patterns
5. Network requests and API usage
6. Resource-intensive operations
7. Caching opportunities
8. Bundle size considerations

For each issue, estimate the performance impact and provide specific recommendations for improvement.`,

        architecture: `${baseTemplate}

Provide an in-depth architecture review focusing on:
1. Overall system design and component organization
2. Separation of concerns and modularity
3. Design patterns used (and opportunities for better patterns)
4. Dependency management and coupling
5. API design and consistency
6. Error handling strategy
7. Testability of the codebase
8. Scalability considerations

Identify architectural strengths and weaknesses, with specific recommendations for improvement.`,

        docs: `${baseTemplate}

Review the codebase documentation focusing on:
1. Code comments quality and coverage
2. API documentation completeness
3. README files and usage instructions
4. Inline documentation of complex logic
5. Type definitions and interfaces
6. Examples and usage patterns
7. Missing documentation areas

Suggest specific documentation improvements with examples.`,
    };

    // Use type assertion to handle the string index access
    return (templates as Record<string, string>)[reviewType] || templates.general;
}

/**
 * Extract a short summary from a longer review
 */
function summarizeReview(review: string): string {
    // Remove ERROR prefix if present
    if (review.startsWith('ERROR:')) {
        return review;
    }

    // Extract first few sentences for a summary
    const sentences = review.split(/\.\s+/);
    return sentences.slice(0, 3).join('. ') + '.';
}

/**
 * Estimate the cost of a model run based on input and output tokens
 */
function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
    // Use the provided output tokens directly

    // Set rates based on model
    let inputRate = 0.0;
    let outputRate = 0.0;

    // Use rates from constants
    if (model in COST_RATES) {
        inputRate = COST_RATES[model as keyof typeof COST_RATES].input;
        outputRate = COST_RATES[model as keyof typeof COST_RATES].output;
    } else {
        // Default to OpenAI rates if model not found
        inputRate = COST_RATES.openai.input;
        outputRate = COST_RATES.openai.output;
    }

    // Calculate cost
    const inputCost = (inputTokens / 1000) * inputRate;
    const outputCost = (outputTokens / 1000) * outputRate;

    return inputCost + outputCost;
}
