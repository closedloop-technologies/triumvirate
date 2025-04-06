// Modify src/index.ts

import fs from 'fs';

import { runModelReview } from './models';
import { runRepomix } from './repomix';
import { normalizeUsage } from './types/usage';
import { COST_RATES, DEFAULT_REVIEW_OPTIONS, ReviewType } from './utils/constants';
// Import the report utilities
import { generateCodeReviewReport, formatReportAsMarkdown } from './utils/report-utils';
import { enhancedFormatReportAsMarkdown } from './utils/enhanced-report-formatter';
import type { CodeReviewReport } from './types/report';

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
    repomixOptions?: Record<string, unknown>;
    enhancedReport?: boolean;
}

/**
 * Run a triumvirate review across multiple LLMs
 * @param options - Options for the review
 * @returns Array of review results from each model
 */
export async function runTriumvirateReview({
    models = DEFAULT_REVIEW_OPTIONS.MODELS,
    exclude = DEFAULT_REVIEW_OPTIONS.EXCLUDE,
    diffOnly = DEFAULT_REVIEW_OPTIONS.DIFF_ONLY,
    outputPath = DEFAULT_REVIEW_OPTIONS.OUTPUT_PATH,
    failOnError = DEFAULT_REVIEW_OPTIONS.FAIL_ON_ERROR,
    summaryOnly = DEFAULT_REVIEW_OPTIONS.SUMMARY_ONLY,
    tokenLimit = DEFAULT_REVIEW_OPTIONS.TOKEN_LIMIT,
    reviewType = DEFAULT_REVIEW_OPTIONS.REVIEW_TYPE,
    repomixOptions = {},
    enhancedReport = true, // Enable enhanced reporting by default
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
                summary: `ERROR: ${(error as Error).message}`,
                review: `ERROR: ${(error as Error).message}`,
                metrics: {
                    latency: 0,
                    tokenInput: 0,
                    tokenOutput: 0,
                    tokenTotal: 0,
                    cost: '$0.00',
                    error: (error as Error).message,
                },
                error: true,
            };
        }
    };

    // Process all models in parallel with improved error handling
    const modelPromises = models.map(model => processModel(model));

    // Use try-catch with Promise.all to handle potential errors
    let modelResults;
    try {
        modelResults = await Promise.all(modelPromises);
    } catch (error) {
        console.error('Unexpected error during parallel model processing:', error);
        // Create a fallback result for all models if Promise.all fails completely
        modelResults = models.map(model => ({
            model,
            summary: `ERROR: Unexpected error during parallel processing`,
            review: `ERROR: Unexpected error during parallel processing: ${error instanceof Error ? error.message : String(error)}`,
            metrics: {
                latency: 0,
                tokenInput: 0,
                tokenOutput: 0,
                tokenTotal: 0,
                cost: '$0.00',
                error: error instanceof Error ? error.message : String(error),
            },
            error: true,
        }));
    }

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
            let isDirectory = false;
            try {
                const fs_stat = fs.statSync(outputPath);
                isDirectory = fs_stat.isDirectory();
            } catch (e) {
                // Path doesn't exist yet - not a directory
                isDirectory = false;
            }

            let jsonOutputPath = outputPath;
            let mdOutputPath = outputPath.replace(/\.json$/, '.md');

            if (isDirectory) {
                // If it's a directory, create files with default names
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                jsonOutputPath = `${outputPath}/tri-review-${timestamp}.json`;
                mdOutputPath = `${outputPath}/tri-review-${timestamp}.md`;
                console.log(
                    `Output path is a directory. Writing to ${jsonOutputPath} and ${mdOutputPath}`
                );
            }

            // Generate regular JSON output (backward compatible)
            fs.writeFileSync(jsonOutputPath, JSON.stringify(results, null, 2));

            // Generate enhanced report if enabled
            if (enhancedReport) {
                // Generate structured report
                const report: CodeReviewReport = await generateCodeReviewReport(results);

                // Save as JSON
                fs.writeFileSync(
                    jsonOutputPath.replace(/\.json$/, '-enhanced.json'),
                    JSON.stringify(report, null, 2)
                );

                // Format as Markdown and save
                const markdown = enhancedFormatReportAsMarkdown(report);
                fs.writeFileSync(mdOutputPath, markdown);
                console.log(`Enhanced report written to ${mdOutputPath}`);
            } else {
                // Generate simple Markdown (backward compatible)
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

                fs.writeFileSync(mdOutputPath, mdResults);
            }

            console.log(`Results written to ${jsonOutputPath}`);
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

// Rest of the file remains unchanged
// ...

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
 * Extract a meaningful summary from a longer review
 * This implementation looks for section headings and key points rather than just the first few sentences
 */
function summarizeReview(review: string): string {
    // Remove ERROR prefix if present
    if (review.startsWith('ERROR:')) {
        return review;
    }

    // Look for markdown headings which often indicate important sections
    const headingMatches = review.match(/#{1,3}\s+([^\n]+)/g);
    if (headingMatches && headingMatches.length >= 2) {
        // If we have headings, use them to structure the summary
        const mainHeadings = headingMatches.slice(0, 5).map(h => h.trim());
        return `The review covers the following key areas: ${mainHeadings.join(', ').replace(/#/g, '')}.`;
    }

    // Look for sections with 'Summary', 'Overview', 'Conclusion', etc.
    const summaryMatch = review.match(
        /(?:Summary|Overview|Conclusion|Key Points)[:\s]([^\n]+(?:\n[^\n#]+)*)/i
    );
    if (summaryMatch && summaryMatch[1]) {
        return summaryMatch[1].trim().replace(/\n/g, ' ');
    }

    // If no structured sections found, extract first paragraph that's reasonably long
    const paragraphs = review.split(/\n\s*\n/);
    for (const paragraph of paragraphs) {
        if (paragraph.length > 100 && !paragraph.startsWith('#')) {
            return paragraph.trim().substring(0, 300) + (paragraph.length > 300 ? '...' : '');
        }
    }

    // Fall back to first few sentences if no better option found
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
    const inputCost = inputTokens * inputRate;
    const outputCost = outputTokens * outputRate;

    return inputCost + outputCost;
}
