import * as fsPromises from 'fs/promises'; // Use promises API for async file operations
import * as path from 'path'; // Import path module

import pc from 'picocolors';

import { Spinner } from './cli/utils/spinner';
import { runModelReview } from './models';
import { runRepomix } from './repomix';
import type { RepomixResult } from './repomix'; // Import RepomixResult type
import type { CliOptions, CodeReviewReport, ModelReviewResult } from './types/report';
import { normalizeUsage } from './types/usage';
import { DEFAULT_REVIEW_OPTIONS } from './utils/constants';
import { TriumvirateError, ErrorCategory } from './utils/error-handling'; // Use consolidated error handling
import type { LLMProvider } from './utils/llm-providers'; // Import provider type
import { estimateCost } from './utils/llm-providers'; // Import cost estimator
import { ClaudeProvider, OpenAIProvider, GeminiProvider } from './utils/llm-providers'; // Import provider classes
import { generateCodeReviewReport, formatReportAsMarkdown } from './utils/report-utils';

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
    agentModel?: string; // DoD: Add agent model
    passThreshold?: 'strict' | 'lenient' | 'none'; // DoD: Add pass threshold
    enhancedReport?: boolean;
    options?: CliOptions; // Keep original options for spinner control etc.
}

// --- Helper Function: Prepare Codebase ---
async function prepareCodebase(
    options: TriumvirateReviewOptions
): Promise<{ repomixResult: RepomixResult; codebase: string }> {
    console.log('Packaging codebase with repomix...');
    const mergedRepomixOptions = {
        exclude: options.exclude,
        diffOnly: options.diffOnly,
        tokenLimit: options.tokenLimit,
        ...options.repomixOptions,
    };

    const repomixResult = await runRepomix(mergedRepomixOptions);
    console.log(`Codebase packaged with ${repomixResult.tokenCount} tokens`);
    // DoD: Use async file read
    const codebase = await fsPromises.readFile(repomixResult.filePath, 'utf8');
    return { repomixResult, codebase };
}

// --- Helper Function: Generate Prompt ---
function generateReviewPrompt(
    reviewType: string,
    repomixResult: RepomixResult,
    codebase: string
): string {
    // Base template with structure info
    const baseTemplate = `You are an expert code reviewer. I'm going to share a codebase with you for review.

Directory Structure:
${repomixResult.directoryStructure}

Summary:
${repomixResult.summary}

Please review the following codebase and provide feedback:

{{CODEBASE}}`;

    // Specific templates for different review types
    const templates: Record<string, string> = {
        general: `${baseTemplate}\n\nProvide a general review focusing on:\n1. Code quality and readability\n2. Potential bugs or issues\n3. Architecture and design\n4. Performance concerns\n5. Security considerations\n\nFormat your response with these sections and provide specific examples where possible.`,
        security: `${baseTemplate}\n\nConduct a thorough security review focusing on:\n1. Authentication and authorization vulnerabilities\n2. Input validation and sanitization\n3. Injection vulnerabilities (SQL, XSS, etc.)\n4. Sensitive data exposure\n5. Security misconfiguration\n6. Hard-coded secrets or credentials\n7. Insecure cryptographic storage\n8. Insufficient logging and monitoring\n\nCategorize issues by severity (Critical, High, Medium, Low) and provide specific recommendations for each.`,
        performance: `${baseTemplate}\n\nConduct a detailed performance review focusing on:\n1. Computational complexity analysis\n2. Memory usage and potential leaks\n3. Asynchronous operations and concurrency\n4. Database queries and data access patterns\n5. Network requests and API usage\n6. Resource-intensive operations\n7. Caching opportunities\n8. Bundle size considerations\n\nFor each issue, estimate the performance impact and provide specific recommendations for improvement.`,
        architecture: `${baseTemplate}\n\nProvide an in-depth architecture review focusing on:\n1. Overall system design and component organization\n2. Separation of concerns and modularity\n3. Design patterns used (and opportunities for better patterns)\n4. Dependency management and coupling\n5. API design and consistency\n6. Error handling strategy\n7. Testability of the codebase\n8. Scalability considerations\n\nIdentify architectural strengths and weaknesses, with specific recommendations for improvement.`,
        docs: `${baseTemplate}\n\nReview the codebase documentation focusing on:\n1. Code comments quality and coverage\n2. API documentation completeness\n3. README files and usage instructions\n4. Inline documentation of complex logic\n5. Type definitions and interfaces\n6. Examples and usage patterns\n7. Missing documentation areas\n\nSuggest specific documentation improvements with examples.`,
    };

    const specificTemplate = templates[reviewType] || templates['general'] || '';
    return specificTemplate.replace('{{CODEBASE}}', codebase);
}

// --- Helper Function: Execute Reviews ---
async function executeReviews(
    prompt: string,
    models: string[],
    spinner: Spinner
): Promise<ModelReviewResult[]> {
    const startTime = Date.now();
    console.log(`Running a review gauntlet across ${models.length} models:`);

    // Track model status for spinner updates
    const modelStatus: Record<string, string> = {};
    models.forEach(model => {
        modelStatus[model] = 'pending';
    });

    const updateSpinner = () => {
        spinner.update(
            ` [${models
                .map(model => {
                    const status = modelStatus[model];
                    if (status === 'fulfilled') return pc.green(model);
                    if (status === 'failed') return pc.red(model);
                    return pc.blue(model); // pending
                })
                .join(', ')}]`
        );
    };
    updateSpinner(); // Initial update

    // Process each model and update spinner when it completes
    const results = await Promise.all(
        models.map(async model => {
            let result: ModelReviewResult;
            try {
                const modelStartTime = Date.now();
                const { text: review, usage } = await runModelReview(prompt, model); // Assuming runModelReview handles its own errors and logging
                const normalizedUsage = normalizeUsage(usage);
                const modelEndTime = Date.now();
                const latency = modelEndTime - modelStartTime;
                const cost = estimateCost(
                    model,
                    normalizedUsage.input_tokens,
                    normalizedUsage.output_tokens
                );

                result = {
                    model,
                    summary: summarizeReview(typeof review === 'string' ? review : String(review)),
                    review: review,
                    metrics: {
                        latency: latency,
                        tokenInput: normalizedUsage.input_tokens,
                        tokenOutput: normalizedUsage.output_tokens,
                        tokenTotal: normalizedUsage.total_tokens,
                        cost: `${cost.toFixed(8)}`,
                        error: undefined, // Explicitly set error to undefined on success
                    },
                    error: false,
                };
                modelStatus[model] = 'fulfilled';
            } catch (error) {
                const triumvirateError =
                    error instanceof TriumvirateError
                        ? error
                        : new TriumvirateError(
                              error instanceof Error ? error.message : String(error),
                              ErrorCategory.UNKNOWN,
                              model, // Use model name as component
                              false,
                              error
                          );
                // Error is already logged by withErrorHandlingAndRetry or handleModelError
                // console.error(`Error with model ${model}:`, triumvirateError); // Already logged
                result = {
                    model,
                    summary: `ERROR: ${triumvirateError.message}`,
                    review: `ERROR: ${triumvirateError.message}`,
                    metrics: {
                        latency: 0,
                        tokenInput: 0,
                        tokenOutput: 0,
                        tokenTotal: 0,
                        cost: '$0.00',
                        error: triumvirateError.message, // Store the error message
                    },
                    error: true,
                };
                modelStatus[model] = 'failed';
            }
            updateSpinner(); // Update spinner after each model finishes
            return result;
        })
    );

    const totalTime = Date.now() - startTime;
    const hasError = results.some(result => result.error);

    if (hasError) {
        spinner.fail(
            `Failed to complete review across all models (${totalTime}ms): [${models.map(m => (modelStatus[m] === 'fulfilled' ? pc.green(m) : pc.red(m))).join(', ')}]`
        );
    } else {
        spinner.succeed(
            `Completed review across models (${totalTime}ms): [${models.map(m => pc.green(m)).join(', ')}]`
        );
    }

    return results;
}

// --- Helper Function: Summarize Review ---
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
            return paragraph.trim().substring(0, 3000) + (paragraph.length > 3000 ? '...' : '');
        }
    }

    // Fall back to first few sentences if no better option found
    const sentences = review.split(/\.\s+/);
    return sentences.slice(0, 3).join('. ') + '.';
}

// --- Helper Function: Generate Report ---
async function generateReport(
    results: ModelReviewResult[],
    agentModelName: string, // DoD: Pass agent model name
    isEnhanced: boolean,
    spinner: Spinner
): Promise<{ jsonReport: CodeReviewReport | ModelReviewResult[]; mdReport: string }> {
    if (isEnhanced) {
        spinner.update('Generating enhanced report...');

        // DoD: Instantiate the correct agent provider
        let agentProvider: LLMProvider;
        switch (agentModelName.toLowerCase()) {
            case 'openai':
                agentProvider = new OpenAIProvider();
                break;
            case 'gemini':
                agentProvider = new GeminiProvider();
                break;
            case 'claude':
            default:
                agentProvider = new ClaudeProvider();
                break;
        }
        const report = await generateCodeReviewReport(results, agentProvider, spinner); // Pass provider and spinner
        const markdown = formatReportAsMarkdown(report);
        spinner.succeed(`Enhanced report generated using ${agentModelName}.`);
        return { jsonReport: report, mdReport: markdown };
    } else {
        spinner.update('Generating simple report...');
        let mdResults = '# Triumvirate Code Review\n\n';
        mdResults += '## Overview\n\n';
        mdResults += '| Model | Status | Latency | Cost | Total Tokens |\n';
        mdResults += '|-------|--------|---------|------|-------------|\n';

        results.forEach(result => {
            const status = result.metrics.error ? '❌ Failed' : '✅ Completed'; // Updated status
            const latency = result.metrics.latency ? `${result.metrics.latency}ms` : 'N/A';
            const cost = result.metrics.cost || 'N/A';
            const tokens = result.metrics.tokenTotal || 'N/A';
            mdResults += `| ${result.model} | ${status} | ${latency} | ${cost} | ${tokens} |\n`; // Adjusted cost format
        });
        mdResults += '\n';
        mdResults += '## Summaries\n\n';
        mdResults += results.map(r => `### ${r.model}\n\n${r.summary}`).join('\n\n');
        mdResults += '\n\n## Results\n\n';
        mdResults += results.map(r => `### ${r.model}\n\n${r.review}`).join('\n\n');
        spinner.succeed('Simple report generated.');
        return { jsonReport: results, mdReport: mdResults }; // Return raw results as JSON for simple report
    }
}

// --- Helper Function: Write Output ---
async function writeOutput(
    outputPath: string,
    jsonReport: CodeReviewReport | ModelReviewResult[],
    mdReport: string,
    isEnhanced: boolean
): Promise<void> {
    // Make async
    try {
        // Resolve the output path
        const resolvedPath = path.resolve(outputPath);
        // We no longer restrict to the project directory to allow arbitrary output paths

        let isDirectory = false;
        try {
            isDirectory = (await fsPromises.stat(resolvedPath)).isDirectory();
        } catch {
            isDirectory = false;
        }

        let baseOutputPath = outputPath;
        if (isDirectory) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            baseOutputPath = path.join(outputPath, `tri-review-${timestamp}`); // Use path.join
            // DoD: Ensure output directory exists
            await fsPromises.mkdir(outputPath, { recursive: true });
            console.log(
                `Output path is a directory. Writing reports with base name: ${baseOutputPath}`
            );
        } else {
            // Remove .json or .md extension if present to create base path
            baseOutputPath = baseOutputPath.replace(/\.(json|md)$/i, '');
        }

        const jsonFilePath = isEnhanced
            ? `${baseOutputPath}-enhanced.json`
            : `${baseOutputPath}.json`;
        const mdFilePath = `${baseOutputPath}.md`;

        console.log(`Writing JSON report to: ${jsonFilePath}`);
        await fsPromises.writeFile(jsonFilePath, JSON.stringify(jsonReport, null, 2)); // Use async write

        console.log(`Writing Markdown report to: ${mdFilePath}`);
        await fsPromises.writeFile(mdFilePath, mdReport); // Use async write
    } catch (error) {
        // Throw a categorized error
        throw new TriumvirateError(
            `Failed to write results to file: ${error instanceof Error ? error.message : String(error)}`,
            ErrorCategory.FILE_SYSTEM,
            'OutputWriter',
            false,
            error
        );
    }
}

/**
 * Main Orchestration Function: Run a triumvirate review across multiple LLMs
 * @param options - Options for the review
 * @returns Array of review results from each model (or processed report structure if enhanced)
 */
export async function runTriumvirateReview(
    options: TriumvirateReviewOptions = {}
): Promise<ModelReviewResult[] | CodeReviewReport> {
    // Return type depends on enhancedReport

    // Set defaults
    const {
        models = DEFAULT_REVIEW_OPTIONS.MODELS,
        outputPath = DEFAULT_REVIEW_OPTIONS.OUTPUT_PATH,
        // passThreshold is used in the runCliAction function, not here
        failOnError = DEFAULT_REVIEW_OPTIONS.FAIL_ON_ERROR,
        agentModel = 'claude', // DoD: Get agent model
        reviewType = DEFAULT_REVIEW_OPTIONS.REVIEW_TYPE,
        enhancedReport = true, // Keep default as true
        options: cliOpts = {}, // Use passed CLI options for spinner control
    } = options;

    const spinner = new Spinner('Starting Triumvirate review...', {
        quiet: cliOpts.quiet,
        verbose: cliOpts.verbose,
    });
    spinner.start();

    let repomixResult: RepomixResult | null = null;

    try {
        // 1. Prepare Codebase
        spinner.update('Preparing codebase with Repomix...');
        const { repomixResult: rmResult, codebase } = await prepareCodebase(options);
        repomixResult = rmResult; // Store for cleanup

        // 2. Generate Prompt
        spinner.update('Generating review prompt...');
        const prompt = generateReviewPrompt(reviewType, repomixResult, codebase);

        // 3. Execute Reviews
        spinner.update('Executing reviews across models...');
        const modelResults = await executeReviews(prompt, models, spinner); // Spinner passed here

        // Check for errors if failOnError is enabled
        const failedModels = modelResults.filter(r => r.error);
        if (failOnError && failedModels.length > 0) {
            const errorMessages = failedModels
                .map(r => `${r.model}: ${r.metrics.error}`)
                .join('; ');
            throw new TriumvirateError(
                `One or more models failed: ${errorMessages}`,
                ErrorCategory.UNKNOWN,
                'ReviewExecution'
            );
        }

        // 4. Generate Report
        // Spinner updates happen within generateReport
        const { jsonReport, mdReport } = await generateReport(
            modelResults,
            agentModel, // DoD: Pass agent model
            enhancedReport,
            spinner
        );

        // 5. Write Output
        if (outputPath) {
            spinner.update(`Writing output files to ${outputPath}...`);
            await writeOutput(outputPath, jsonReport, mdReport, enhancedReport);
            spinner.succeed('Output files written successfully.');
        }

        spinner.succeed('Triumvirate review completed successfully!');
        return jsonReport; // Return the generated report (raw results or CodeReviewReport)
    } catch (error) {
        const triumvirateError =
            error instanceof TriumvirateError
                ? error
                : new TriumvirateError(
                      error instanceof Error ? error.message : String(error),
                      ErrorCategory.UNKNOWN,
                      'runTriumvirateReview',
                      false,
                      error
                  );
        spinner.fail(`Triumvirate review failed: ${triumvirateError.message}`);
        triumvirateError.logError(); // Log the categorized error
        throw triumvirateError; // Re-throw the categorized error
    } finally {
        // 6. Cleanup
        if (repomixResult?.filePath) {
            try {
                await fsPromises.unlink(repomixResult.filePath); // Use promises API
                console.log('Cleaned up temporary repomix file.');
            } catch (cleanupError) {
                console.warn('Could not delete temporary file:', cleanupError);
            }
        }
    }
}
