import fs from 'fs';

import pc from 'picocolors';

import type { ApiCallLog } from './api-logger.js';
import { MAX_API_RETRIES } from './constants';
import { enhancedLogger } from './enhanced-logger.js';
import { safeReportGenerationAsync, safeDataProcessing } from './error-handling-extensions';
import { ClaudeProvider } from './llm-providers';
import { Spinner } from '../cli/utils/spinner';
import type { FindingItem, ModelResult } from '../types/model-responses';
import {
    type ReviewCategory,
    type ModelMetrics,
    type ReviewFinding,
    type ModelInsight,
    type CategoryAgreementAnalysis,
    type AgreementStatistics,
    type CodeReviewReport,
    Priority,
    type ModelInfo,
} from '../types/report';

// Add back the FindingsResponse interface
interface FindingsResponse {
    findings: FindingItem[]; // Use the imported FindingItem type
}

interface InsightsResponse {
    modelInsights: Array<{
        modelId: string;
        insight: string;
        details: string;
    }>;
}

interface PrioritizedResponse {
    highPriority: string[];
    mediumPriority: string[];
    lowPriority: string[];
}

// Define the expected response type
export interface CategoryResponse {
    categories: ReviewCategory[];
}

/**
 * Extract categories from model reviews using structured output from any available LLM provider
 */
export async function extractCategories(reviews: string[]): Promise<ReviewCategory[]> {
    const provider = new ClaudeProvider();
    try {
        // Create a prompt for category extraction
        const prompt = createCategoryExtractionPrompt(reviews);

        // Define the schema for structured output
        const schema = createCategorySchema();

        // Call the best available LLM provider with structured output
        const categoriesResponse = await provider.runStructured<CategoryResponse>(
            prompt,
            schema,
            MAX_API_RETRIES,
            'category_extraction',
            'Extract categories from model reviews',
            8192 // Increased token limit to handle larger reviews
        );
        const apilog: ApiCallLog = {
            timestamp: new Date().toISOString(),
            model: provider.model,
            operation: 'categories',
            inputTokens: categoriesResponse.usage.input_tokens,
            outputTokens: categoriesResponse.usage.output_tokens,
            totalTokens: categoriesResponse.usage.total_tokens,
            success: true,
            cost: categoriesResponse.cost,
        };
        enhancedLogger.logApiCall(apilog);

        // Validate response
        if (!isValidCategoryResponse(categoriesResponse)) {
            throw new Error('LLM did not return expected category structure');
        }

        // Map the categories to the required format
        return categoriesResponse.data.categories;
    } catch {
        // Use the new error handling utilities for consistent error handling
        const apilog: ApiCallLog = {
            timestamp: new Date().toISOString(),
            model: provider.model,
            operation: 'structured',
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            success: false,
            cost: 0,
        };
        enhancedLogger.logApiCall(apilog);
        return safeReportGenerationAsync(
            async () => {
                return [];
            },
            'categories',
            'extraction',
            [], // Default empty array as fallback if even the fallback method fails
            true // Log error stack trace
        );
    }
}

/**
 * Creates the prompt for category extraction
 */
function createCategoryExtractionPrompt(reviews: string[]): string {
    return `
I need you to analyze these code review outputs from different models and extract the main categories discussed.
Please identify 5-8 distinct categories that cover the major topics across all reviews.

For each category, provide:
1. A concise name (e.g., "Code Quality", "Security", "Performance")
2. A short 1-2 sentence description of what this category encompasses

${reviews.map((review, index) => `MODEL ${index + 1} REVIEW:\n${review}`).join('\n\n')}
`;
}

/**
 * Creates the schema for category extraction
 */
function createCategorySchema(): Record<string, unknown> {
    return {
        type: 'object',
        properties: {
            categories: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        name: {
                            type: 'string',
                            description:
                                "Concise name for the review category (e.g., 'Code Quality', 'Error Handling')",
                        },
                        description: {
                            type: 'string',
                            description:
                                'Short 1-2 sentence description of what this category covers',
                        },
                    },
                    required: ['name', 'description'],
                },
                description:
                    'List of distinct review categories identified across all model reviews',
            },
        },
        required: ['categories'],
    };
}

/**
 * Validates if the Claude response has the expected structure and content
 * Performs both structural validation and content validation to ensure data integrity
 */
function isValidCategoryResponse(response: unknown): boolean {
    if (!response) {
        return false;
    }

    // Type guard to check if response has the expected structure
    const hasValidStructure =
        response !== null &&
        typeof response === 'object' &&
        'data' in response &&
        response.data !== null &&
        typeof response.data === 'object' &&
        'categories' in response.data &&
        Array.isArray(response.data.categories);

    // If structure is invalid, return false immediately
    if (!hasValidStructure) {
        return false;
    }
    // Content validation - ensure categories have required properties and valid values
    const { categories } = (response as Record<string, unknown>)['data'] as Record<string, unknown>;

    // Check if there are any categories at all
    if (!Array.isArray(categories) || categories.length === 0) {
        console.warn('Category response contains an empty categories array');
        return false;
    }

    // Validate each category has required fields with valid content
    return categories.every((category: unknown) => {
        // Check if category is an object with required properties
        if (!category || typeof category !== 'object') {
            console.warn('Invalid category: not an object');
            return false;
        }

        const cat = category as Record<string, unknown>;

        // Check for required properties
        if (!('name' in cat) || !('description' in cat)) {
            console.warn('Invalid category: missing required properties');
            return false;
        }

        // Validate property types
        if (typeof cat['name'] !== 'string' || typeof cat['description'] !== 'string') {
            console.warn('Invalid category: properties have incorrect types');
            return false;
        }

        // Validate property values (non-empty strings)
        if (cat['name'].trim() === '' || cat['description'].trim() === '') {
            console.warn('Invalid category: empty name or description');
            return false;
        }

        return true;
    });
}

/**
 * Create a standardized structure for the model metrics
 */
export function createModelMetrics(modelResults: ModelResult[]): ModelMetrics[] {
    return modelResults.map(result => {
        const modelInfo: ModelInfo = {
            name: result.model,
            id: result.model,
        };

        const tokenTotal = result.metrics.tokenTotal || 0;
        const costValue = parseFloat(result.metrics.cost || '0');

        return {
            model: modelInfo,
            status: result.metrics.error ? '❌ Failed' : '✅ Completed',
            latencyMs: result.metrics.latency || 0,
            cost: costValue,
            totalTokens: tokenTotal,
            costPer1kTokens: tokenTotal ? (costValue * 1000) / tokenTotal : 0,
        };
    });
}

/**
 * Analyze agreement between models on various findings
 */
export function analyzeModelAgreement(
    reviews: string[],
    modelIds: string[]
): CategoryAgreementAnalysis[] {
    // Define common categories and their keywords
    const categories = getModelAgreementCategories();
    const categoryKeywords = getModelAgreementCategoryKeywords();

    // Initialize model findings structure
    const modelFindings = initializeModelFindings(modelIds, categories);

    // Extract and categorize findings from reviews
    extractFindingsFromReviews(reviews, modelIds, modelFindings, categories, categoryKeywords);

    // Analyze agreement across models for each category
    return analyzeAgreementByCategory(categories, modelIds, modelFindings);
}

/**
 * Get standard categories for model agreement analysis
 */
function getModelAgreementCategories(): string[] {
    return ['Code Quality', 'Potential Bugs', 'Architecture', 'Performance', 'Security'];
}

/**
 * Get keywords for each category to help with classification
 */
function getModelAgreementCategoryKeywords(): Record<string, string[]> {
    return {
        'Code Quality': [
            'readability',
            'maintainability',
            'naming',
            'formatting',
            'style',
            'conventions',
            'comments',
            'documentation',
            'typescript',
            'typing',
            'modularity',
            'organization',
        ],
        'Potential Bugs': [
            'bug',
            'error',
            'exception',
            'crash',
            'undefined',
            'null',
            'race condition',
            'edge case',
            'validation',
            'input',
            'type error',
            'runtime error',
        ],
        Architecture: [
            'architecture',
            'design',
            'pattern',
            'structure',
            'coupling',
            'cohesion',
            'dependency',
            'interface',
            'abstraction',
            'separation of concerns',
            'modular',
        ],
        Performance: [
            'performance',
            'optimization',
            'speed',
            'memory',
            'latency',
            'throughput',
            'bottleneck',
            'efficient',
            'caching',
            'lazy loading',
            'resource',
        ],
        Security: [
            'security',
            'vulnerability',
            'injection',
            'authentication',
            'authorization',
            'encryption',
            'sanitization',
            'validation',
            'sensitive data',
            'exposure',
        ],
    };
}

/**
 * Initialize model findings structure
 */
function initializeModelFindings(
    modelIds: string[],
    categories: string[]
): Record<string, Record<string, string[]>> {
    const modelFindings: Record<string, Record<string, string[]>> = {};

    modelIds.forEach(modelId => {
        categories.forEach(category => {
            if (!modelFindings[modelId]) {
                modelFindings[modelId] = {};
            }
            modelFindings[modelId][category] = [];
        });
    });

    return modelFindings;
}

/**
 * Extract findings from reviews and categorize them
 */
function extractFindingsFromReviews(
    reviews: string[],
    modelIds: string[],
    modelFindings: Record<string, Record<string, string[]>>,
    categories: string[],
    categoryKeywords: Record<string, string[]>
): void {
    reviews.forEach((review, index) => {
        const modelId = modelIds[index];
        if (!review || !modelId) {
            return;
        }

        // Split review into paragraphs for analysis
        const paragraphs = review.split(/\n\n+/);

        paragraphs.forEach(paragraph => {
            // Skip very short paragraphs
            if (paragraph.length < 20) {
                return;
            }

            // Determine which category this paragraph belongs to
            const { category, score } = categorizeParagraph(
                paragraph,
                categories,
                categoryKeywords
            );

            // Only add if we have a reasonable match
            if (score > 0 && category) {
                // Extract a concise finding from the paragraph
                const finding = extractFinding(paragraph);
                if (finding) {
                    if (!modelFindings[modelId]) {
                        modelFindings[modelId] = {};
                    }
                    const categoryFindings = modelFindings[modelId][category] || [];
                    categoryFindings.push(finding);
                    modelFindings[modelId][category] = categoryFindings;
                }
            }
        });
    });
}

/**
 * Categorize a paragraph based on its content
 */
function categorizeParagraph(
    paragraph: string,
    categories: string[],
    categoryKeywords: Record<string, string[]>
): { category: string; score: number } {
    let bestCategory = '';
    let highestScore = 0;

    categories.forEach(category => {
        const keywords = categoryKeywords[category] || [];
        let score = 0;

        // Count keyword matches
        keywords.forEach(keyword => {
            const regex = new RegExp(`\\b${keyword}\\b`, 'i');
            if (regex.test(paragraph)) {
                score++;
            }
        });

        // Check for category name in paragraph
        if (paragraph.toLowerCase().includes(category.toLowerCase())) {
            score += 2; // Give extra weight to explicit category mentions
        }

        if (score > highestScore) {
            highestScore = score;
            bestCategory = category;
        }
    });

    return { category: bestCategory, score: highestScore };
}

/**
 * Analyze agreement across models for each category
 */
function analyzeAgreementByCategory(
    categories: string[],
    modelIds: string[],
    modelFindings: Record<string, Record<string, string[]>>
): CategoryAgreementAnalysis[] {
    return categories.map(category => {
        const allFindings = new Map<string, string[]>();

        // Collect all findings for this category across models
        modelIds.forEach(modelId => {
            if (!modelFindings[modelId]) {
                return;
            }
            const findings = modelFindings[modelId][category] || [];
            findings.forEach(finding => {
                // Use the finding as key and collect which models mentioned it
                if (!allFindings.has(finding)) {
                    allFindings.set(finding, []);
                }
                const modelList = allFindings.get(finding);
                if (modelList) {
                    modelList.push(modelId);
                }
            });
        });

        // Process findings and group by agreement level
        const result = processAgreementFindings(allFindings, modelIds);

        return {
            area: category,
            highAgreement: result.highAgreement,
            partialAgreement: result.partialAgreement,
            disagreement: result.disagreement,
        };
    });
}

/**
 * Process findings and group them by agreement level
 */
function processAgreementFindings(
    allFindings: Map<string, string[]>,
    modelIds: string[]
): { highAgreement: string[]; partialAgreement: string[]; disagreement: string[] } {
    const highAgreement: string[] = [];
    const partialAgreement: string[] = [];
    const disagreement: string[] = [];

    // Track findings that have been processed
    const processedFindings = new Set<string>();

    // First, find high agreement items (all models agree)
    allFindings.forEach((modelsThatMentioned, finding) => {
        if (processedFindings.has(finding)) {
            return;
        }

        if (modelsThatMentioned.length === modelIds.length) {
            highAgreement.push(finding);
            processedFindings.add(finding);

            // Find and mark similar findings to avoid duplication
            markSimilarFindings(allFindings, finding, processedFindings);
        }
    });

    // Then, find partial agreement items (more than one model agrees)
    allFindings.forEach((modelsThatMentioned, finding) => {
        if (processedFindings.has(finding)) {
            return;
        }

        if (modelsThatMentioned.length > 1) {
            partialAgreement.push(finding);
            processedFindings.add(finding);

            // Find and mark similar findings to avoid duplication
            markSimilarFindings(allFindings, finding, processedFindings);
        }
    });

    // Finally, add disagreement items (only one model mentions)
    allFindings.forEach((modelsThatMentioned, finding) => {
        if (processedFindings.has(finding)) {
            return;
        }

        disagreement.push(finding);
        processedFindings.add(finding);
    });

    // Format and limit the findings for each category
    return {
        highAgreement: formatAndLimitFindings(highAgreement, 3),
        partialAgreement: formatAndLimitFindings(partialAgreement, 3),
        disagreement: formatAndLimitFindings(disagreement, 3),
    };
}

/**
 * Mark similar findings to avoid duplication
 */
function markSimilarFindings(
    allFindings: Map<string, string[]>,
    finding: string,
    processedFindings: Set<string>
): void {
    allFindings.forEach((_, otherFinding) => {
        if (
            finding !== otherFinding &&
            !processedFindings.has(otherFinding) &&
            calculateSimilarity(finding, otherFinding) > 0.7
        ) {
            processedFindings.add(otherFinding);
        }
    });
}

/**
 * Format and limit findings to a specified count
 */
function formatAndLimitFindings(findings: string[], limit: number): string[] {
    if (findings.length === 0) {
        return [];
    }

    // Clean up findings and create a list of key points
    const cleanedFindings = findings.map(finding => {
        // Remove any markdown headers, bullet points, or numbering
        let cleaned = finding
            .replace(/^#+\s+/g, '')
            .replace(/^[\d*\-•]+\.?\s*/g, '')
            .trim();

        // Get common prefixes to remove
        const prefixesToRemove = getCommonPrefixesToRemove();

        // Remove common prefixes that make findings verbose
        for (const prefix of prefixesToRemove) {
            if (cleaned.toLowerCase().startsWith(prefix)) {
                cleaned = cleaned.substring(prefix.length).trim();
                // Remove leading punctuation after removing prefix
                cleaned = cleaned.replace(/^[,:;\s]+/, '');
                break;
            }
        }

        // Capitalize first letter
        if (cleaned.length > 0) {
            cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
        }

        // Truncate if still too long
        if (cleaned.length > 800) {
            cleaned = cleaned.substring(0, 797) + '...';
        }

        return cleaned;
    });

    // Filter out empty or very short findings
    const validFindings = cleanedFindings.filter(f => f && f.length > 5);

    // Sort by length (shorter findings first) for more concise presentation
    const sorted = [...validFindings].sort((a, b) => a.length - b.length);

    // Return the top findings, up to the limit
    return sorted.slice(0, limit);
}

/**
 * Extract a concise finding from a paragraph
 */
function extractFinding(paragraph: string): string {
    // Clean up the paragraph - remove markdown headers and extra whitespace
    const cleanParagraph = paragraph.replace(/^#+\s+/gm, '').trim();

    // Look for bullet points or numbered lists
    const bulletMatch = cleanParagraph.match(/[•\-*]\s*([^\n.]+)/i);
    if (bulletMatch && bulletMatch[1]) {
        const bulletPoint = bulletMatch[1].trim();
        return formatFinding(bulletPoint);
    }

    // Get key phrases that might indicate findings
    const keyPhrases = getKeyPhrases();

    // Split into sentences
    const sentences = cleanParagraph.split(/\.\s+/);

    // Look for sentences with key indicator phrases
    for (const sentence of sentences) {
        if (sentence && keyPhrases.some(phrase => sentence.toLowerCase().includes(phrase))) {
            return formatFinding(sentence);
        }
    }

    // Fall back to first sentence if it's not too long
    if (sentences[0] && sentences[0].length < 100) {
        return formatFinding(sentences[0]);
    }

    // If paragraph is short enough, use the whole thing
    if (cleanParagraph.length < 100) {
        return formatFinding(cleanParagraph);
    }

    // Last resort: take first part of the paragraph
    return formatFinding(cleanParagraph.substring(0, 80));
}

/**
 * Get key phrases that might indicate findings
 */
function getKeyPhrases(): string[] {
    return [
        'should',
        'could',
        'would benefit',
        'recommend',
        'suggestion',
        'improvement',
        'issue',
        'problem',
        'concern',
        'strength',
        'positive',
        'well done',
        'good practice',
        'code quality',
        'readability',
        'maintainability',
        'architecture',
        'design',
        'performance',
        'security',
        'bug',
        'error',
        'vulnerability',
    ];
}

/**
 * Format a finding to be concise and readable
 */
function formatFinding(text: string): string {
    if (!text) {
        return '';
    }

    // Remove any markdown formatting
    let formatted = text.replace(/\*\*/g, '').replace(/\*/g, '').trim();

    // Get common prefixes to remove
    const prefixesToRemove = getCommonPrefixesToRemove();

    // Remove common prefixes that make findings verbose
    for (const prefix of prefixesToRemove) {
        if (formatted.toLowerCase().startsWith(prefix)) {
            formatted = formatted.substring(prefix.length).trim();
            // Remove leading punctuation after removing prefix
            formatted = formatted.replace(/^[,:;\s]+/, '');
            break;
        }
    }

    // Capitalize first letter
    if (formatted.length > 0) {
        formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
    }

    // Truncate if still too long
    if (formatted.length > 800) {
        formatted = formatted.substring(0, 797) + '...';
    }

    return formatted;
}

/**
 * Get common prefixes to remove from findings
 */
function getCommonPrefixesToRemove(): string[] {
    return [
        'the code',
        'there is',
        'there are',
        'it is',
        'this is',
        'i found',
        'i noticed',
        'i see',
        'i observed',
        'the project',
        'the codebase',
        'the implementation',
        'one issue is',
        'a concern is',
        'an improvement would be',
    ];
}

/**
 * Calculate similarity between two strings (simple implementation)
 */
function calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();

    // Convert strings to word sets
    const words1 = new Set(s1.split(/\W+/).filter(w => w.length > 3));
    const words2 = new Set(s2.split(/\W+/).filter(w => w.length > 3));

    // Count common words
    let commonWords = 0;
    // Convert Set to Array before iteration to avoid TypeScript errors
    Array.from(words1).forEach(word => {
        if (words2.has(word)) {
            commonWords++;
        }
    });

    // Calculate Jaccard similarity
    // Use Array.from instead of spread operator to avoid TypeScript iteration errors
    const totalUniqueWords = new Set(Array.from(words1).concat(Array.from(words2))).size;
    return totalUniqueWords > 0 ? commonWords / totalUniqueWords : 0;
}

/**
 * Calculate agreement statistics
 * FIXED VERSION - Handles model agreement structure correctly
 */
export function calculateAgreementStats(
    findings: Record<string, ReviewFinding[]>,
    categories: ReviewCategory[]
): AgreementStatistics[] {
    return categories.map(category => {
        // Count findings with different levels of agreement
        let allThree = 0;
        let twoModels = 0;
        let oneModel = 0;

        const categoryFindings = findings[category.name] || [];

        for (const finding of categoryFindings) {
            if (finding.modelAgreements) {
                const agreementCount = Object.values(finding.modelAgreements).filter(
                    Boolean
                ).length;

                if (agreementCount >= 3) {
                    allThree++;
                } else if (agreementCount === 2) {
                    twoModels++;
                } else if (agreementCount === 1) {
                    oneModel++;
                }
            }
        }

        return {
            category: category.name,
            allThreeModels: allThree,
            twoModels: twoModels,
            oneModel: oneModel,
        };
    });
}

/**
 * Generate a comprehensive code review report with structured Claude analysis
 */
export async function generateCodeReviewReport(
    modelResults: ModelResult[],
    spinner?: Spinner
): Promise<CodeReviewReport> {
    // Track any resources that need cleanup
    const resources: { cleanup: () => void }[] = [];

    if (!spinner) {
        spinner = new Spinner('Generating summary report...');
        spinner.start();
    }

    try {
        // Extract review texts
        const reviews = extractReviewTexts(modelResults);

        // Create model info objects
        const models = modelResults.map(result => ({
            id: result.model.toLowerCase(),
            name: result.model,
        }));

        // Create simple model metrics
        const modelMetrics = createModelMetrics(modelResults);

        // If we don't have any reviews, throw an error
        if (!reviews.length || reviews.every(r => !r)) {
            throw new Error('No valid reviews found in model results');
        }

        let categories;
        spinner.update('Finding common categories...');
        try {
            categories = await extractCategories(reviews);
        } catch (categoryError) {
            console.error('Error extracting categories:', categoryError);
            throw new Error('Failed to extract categories');
        }

        if (!categories.length) {
            throw new Error('Failed to extract categories');
        }

        // Log categories with hacker/arcade style
        console.log(pc.cyan('┌─────────────────────────────────────────────────────┐'));
        console.log(
            pc.cyan('│') +
                pc.yellow('         █▓▒░ REVIEW CATEGORIES DETECTED ░▒▓█        ') +
                pc.cyan('│')
        );
        console.log(pc.cyan('└─────────────────────────────────────────────────────┘'));

        categories.forEach((category, index) => {
            console.log(
                pc.gray(`[${(index + 1).toString().padStart(2, '0')}]`) +
                    ` ${pc.cyan('⟨')}${pc.magenta(category.name)}${pc.cyan('⟩')}`
            );
        });

        // Add separator line at the end
        console.log(pc.gray('─'.repeat(50)));

        // Extract findings using Claude - ensure proper promise handling
        spinner.update('Extracting specific findings from reviews...');
        let findings;
        try {
            findings = await extractFindings(reviews, categories, models);
        } catch (findingsError) {
            console.error('Error extracting findings:', findingsError);
            throw new Error('Failed to extract findings');
        }

        if (!findings.length) {
            throw new Error('Failed to extract findings');
        }

        // Save findings to json file
        const findingsJson = JSON.stringify(findings, null, 2);
        fs.writeFileSync('tri-review-findings.json', findingsJson);

        // Display findings with hacker/arcade style
        console.log(pc.cyan('┌─────────────────────────────────────────────────────┐'));
        console.log(
            pc.cyan('│') +
                pc.yellow(
                    `          █▓▒░ ${findings.length.toString().padStart(3, ' ')} FINDINGS EXTRACTED ░▒▓█           `
                ) +
                pc.cyan('│')
        );
        console.log(pc.cyan('└─────────────────────────────────────────────────────┘'));

        // Display findings breakdown by strengths vs. areas for improvement
        const strengths = findings.filter(f => f.isStrength);
        const improvements = findings.filter(f => !f.isStrength);

        // Count findings by category
        const categoryCounts = new Map<string, number>();
        findings.forEach(finding => {
            const categoryName = finding.category.name;
            categoryCounts.set(categoryName, (categoryCounts.get(categoryName) || 0) + 1);
        });
        // Calculate agreement statistics
        const findingsByCategory = organizeFindingsByCategory(findings, categories);
        const agreementStatistics = calculateAgreementStats(findingsByCategory, categories);

        logFindingCounts(strengths, improvements);

        // Identify key strengths and areas for improvement
        const { keyStrengths, keyAreasForImprovement } = identifyKeyFindingsImportance(findings);

        // Create model agreement analysis - ensure proper promise handling
        let agreementAnalysis: CategoryAgreementAnalysis[];
        try {
            agreementAnalysis = analyzeModelAgreement(
                reviews,
                models.map(m => m.id)
            );
        } catch (agreementError) {
            console.error('Error analyzing model agreement:', agreementError);
            agreementAnalysis = [];
        }

        logFindingsDistribution(findingsByCategory, categories);

        // Extract model insights - ensure proper promise handling
        spinner.update('Extracting model insights...');

        let modelInsights;
        try {
            modelInsights = await extractModelInsights(reviews, models);
        } catch (insightsError) {
            console.error('Error extracting model insights:', insightsError);
            modelInsights = models.map(model => ({
                model,
                insight: `Review from ${model.name}`,
                details: `Check the full review for detailed insights`,
            }));
        }

        // Create the complete report
        spinner.succeed('Triumvirate report generation complete');

        return {
            projectName: 'Triumvirate',
            reviewDate: new Date().toISOString(),
            categories,
            models,
            modelMetrics,
            keyStrengths,
            keyAreasForImprovement,
            findingsByCategory,
            modelInsights,
            agreementAnalysis,
            agreementStatistics,
        };
    } catch (error) {
        spinner.fail(`Error generating code review report: ${error}`);
        throw error;
    } finally {
        // Clean up any resources
        resources.forEach(resource => {
            try {
                resource.cleanup();
            } catch (cleanupError) {
                console.error('Error during resource cleanup:', cleanupError);
            }
        });
    }
}

function logFindingCounts(strengths: ReviewFinding[], improvements: ReviewFinding[]) {
    console.log(
        pc.green(`Key Findings:          `) +
            pc.green(`${strengths.length.toString().padStart(2, '0')} ✅`) +
            pc.gray(' | ') +
            pc.red(`${improvements.length.toString().padStart(2, '0')} ❌`)
    );

    // Count improvements with different agreement levels
    const improvementsWithHighAgreement = improvements.filter(
        s => !s.isStrength && Object.values(s.modelAgreements).filter(Boolean).length >= 3
    );
    const improvementsWithPartialAgreement = improvements.filter(
        s => !s.isStrength && Object.values(s.modelAgreements).filter(Boolean).length === 2
    );
    const improvementsWithLowAgreement = improvements.filter(
        s => !s.isStrength && Object.values(s.modelAgreements).filter(Boolean).length === 1
    );

    // Log the agreement statistics
    console.log(
        pc.yellow(`Improvement Agreement: `) +
            pc.red(`${improvementsWithHighAgreement.length.toString().padStart(2, '0')} 🚨`) +
            pc.gray(' | ') +
            pc.yellow(`${improvementsWithPartialAgreement.length.toString().padStart(2, '0')} ❗`) +
            pc.gray(' | ') +
            pc.green(`${improvementsWithLowAgreement.length.toString().padStart(2, '0')} ⚠️`)
    );

    // Print each of the improvements with their agreement level
    if (improvementsWithHighAgreement.length > 0) {
        console.log(
            pc.red(
                `🚨 ${improvementsWithHighAgreement.length} findings have high agreement across models`
            )
        );

        improvementsWithHighAgreement.forEach((improvement, index) => {
            console.log(pc.red(`${index + 1}. ${improvement.title}`));
        });
    }
    if (improvementsWithPartialAgreement.length > 0) {
        console.log(
            pc.yellow(
                `❗ ${improvementsWithPartialAgreement.length} findings have partial agreement across models`
            )
        );

        improvementsWithPartialAgreement.forEach((improvement, index) => {
            console.log(pc.yellow(`${index + 1}. ${improvement.title}`));
        });
    }
    // Add separator line
    console.log(pc.gray('─'.repeat(50)));
}

/**
 * Log model results with hacker/arcade style formatting
 */
export function logModelResults(modelResults: ModelResult[]): void {
    // Import picocolors dynamically to avoid dependency issues

    console.log(pc.cyan('┌─────────────────────────────────────────────────────┐'));
    console.log(
        pc.cyan('│') +
            pc.yellow('         █▓▒░ MODEL RESULTS DIAGNOSTIC ░▒▓█          ') +
            pc.cyan('│')
    );
    console.log(pc.cyan('└─────────────────────────────────────────────────────┘'));

    modelResults.forEach(result => {
        const modelName = result.model.toUpperCase();
        const reviewLength =
            typeof result.review === 'string' ? result.review.length : 'non-string';
        const tokenTotal = result.metrics?.tokenTotal || 0;
        const cost = result.metrics?.cost || '0.00';

        // Create visual model identifier with different colors per model
        const modelColor =
            result.model === 'openai'
                ? pc.green
                : result.model === 'claude'
                  ? pc.magenta
                  : result.model === 'gemini'
                    ? pc.blue
                    : pc.yellow;

        console.log(
            modelColor(`[${modelName}]`) +
                ` ${pc.gray('⟨')}${pc.yellow(reviewLength.toString().padStart(6, ' '))}${pc.gray('⟩')} chars | ` +
                `${pc.gray('⟨')}${pc.cyan(tokenTotal.toString().padStart(6, ' '))}${pc.gray('⟩')} tokens | ` +
                `${pc.gray('$')}${pc.yellow(cost.padStart(8, ' '))}`
        );
    });

    // Add separator line at the end
    console.log(pc.gray('─'.repeat(50)));
}

/**
 * Extract review texts from model results
 */
function extractReviewTexts(modelResults: ModelResult[]): string[] {
    return modelResults.map(result => {
        if (typeof result.review === 'string') {
            return result.review;
        } else if (result.review && result.review.text) {
            return result.review.text;
        } else {
            return JSON.stringify(result.review);
        }
    });
}

/**
 * Organize findings by category
 */
function organizeFindingsByCategory(
    findings: ReviewFinding[],
    categories: ReviewCategory[]
): Record<string, ReviewFinding[]> {
    const findingsByCategory: Record<string, ReviewFinding[]> = {};

    categories.forEach(category => {
        findingsByCategory[category.name] = findings.filter(
            f => f.category && f.category.name === category.name
        );
    });

    return findingsByCategory;
}

/**
 * Log distribution of findings by category
 */
function logFindingsDistribution(
    findingsByCategory: Record<string, ReviewFinding[]>,
    categories: ReviewCategory[]
): void {
    // Create a visual table for findings distribution
    console.log(pc.cyan('┌─────────────────────────────────────────────────────┐'));
    console.log(
        pc.cyan('│') +
            pc.yellow('     █▓▒░ FINDINGS DISTRIBUTION BY CATEGORY ░▒▓█     ') +
            pc.cyan('│')
    );
    console.log(pc.cyan('└─────────────────────────────────────────────────────┘'));

    Object.entries(findingsByCategory).forEach(([categoryName, catFindings]) => {
        const category = categories.find(c => c.name === categoryName);
        const findingCount = catFindings.length;
        const countColor = findingCount > 3 ? pc.red : findingCount > 1 ? pc.yellow : pc.cyan;
        const displayName = category?.name || categoryName;

        console.log(
            ` ${countColor(`[${findingCount.toString().padStart(2, '0')}]`)}` +
                ` ${pc.cyan('⟨')}${pc.magenta(displayName)}${pc.cyan('⟩')}`
        );
    });
    console.log('');
}

/**
 * Identify key strengths and areas for improvement
 */
function identifyKeyFindingsImportance(findings: ReviewFinding[]): {
    keyStrengths: ReviewFinding[];
    keyAreasForImprovement: ReviewFinding[];
} {
    // Identify key strengths
    const keyStrengths = findings
        .filter(f => f.isStrength && f.modelAgreements)
        .sort((a, b) => {
            // Sort by model agreement count (highest first)
            const agreementCountA = Object.values(a.modelAgreements).filter(Boolean).length;
            const agreementCountB = Object.values(b.modelAgreements).filter(Boolean).length;
            return agreementCountB - agreementCountA;
        })
        .slice(0, 5); // Take top 5 strengths

    // Identify key areas for improvement
    const keyAreasForImprovement = findings
        .filter(f => !f.isStrength && f.modelAgreements)
        .sort((a, b) => {
            // Sort by model agreement count (highest first)
            const agreementCountA = Object.values(a.modelAgreements).filter(Boolean).length;
            const agreementCountB = Object.values(b.modelAgreements).filter(Boolean).length;
            return agreementCountB - agreementCountA;
        })
        .slice(0, 5); // Take top 5 areas for improvement

    return { keyStrengths, keyAreasForImprovement };
}

/**
 * Extracts code review findings using structured output from any available LLM provider
 * This function handles the analysis of review texts to identify specific findings
 * and categorize them properly
 *
 * @param reviews - Array of review texts from different models
 * @param categories - Array of review categories
 * @param models - Array of model information objects
 * @returns Promise with array of review findings
 */

export async function extractFindings(
    reviews: string[],
    categories: ReviewCategory[],
    models: ModelInfo[]
): Promise<ReviewFinding[]> {
    const provider = new ClaudeProvider();
    try {
        // Create the prompt for findings extraction
        const prompt = createFindingsExtractionPrompt(reviews, categories, models);

        // Define the schema for the structured output
        const schema = createFindingsSchema(models, categories); // Pass categories

        // Call the best available LLM provider with structured output
        // Use a higher max token limit (8192) for findings extraction as it can be token-intensive
        const findingsResponse = await provider.runStructured<FindingsResponse>(
            prompt,
            schema,
            MAX_API_RETRIES,
            'findings',
            'Extract a list of findings from model reviews',
            8192 // Increased token limit to handle larger reviews
        );

        const apilog: ApiCallLog = {
            timestamp: new Date().toISOString(),
            model: provider.model,
            operation: 'findings',
            inputTokens: findingsResponse.usage.input_tokens,
            outputTokens: findingsResponse.usage.output_tokens,
            totalTokens: findingsResponse.usage.total_tokens,
            success: true,
            cost: findingsResponse.cost,
        };
        enhancedLogger.logApiCall(apilog);

        // Validate the response structure
        if (!findingsResponse || !findingsResponse.data || !findingsResponse.data.findings) {
            throw new Error('LLM did not return expected findings structure');
        }

        // Map the findings to the required format
        return mapExtractedFindingsToRequiredFormat(
            findingsResponse.data.findings,
            categories,
            models
        );
    } catch (error) {
        // Use the new error handling utilities for consistent error handling

        const apilog: ApiCallLog = {
            timestamp: new Date().toISOString(),
            model: provider.model,
            operation: 'findings',
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            success: false,
            cost: 0,
        };
        enhancedLogger.logApiCall(apilog);
        return safeReportGenerationAsync(
            async () => {
                throw error; // Re-throw the error to be handled by safeReportGenerationAsync
            },
            'findings',
            'extraction',
            [], // Default empty array as fallback
            true // Log error stack trace
        );
    }
}

/**
 * Creates the prompt for findings extraction
 */
function createFindingsExtractionPrompt(
    reviews: string[],
    categories: ReviewCategory[],
    models: ModelInfo[]
): string {
    return `
I need you to analyze these code review outputs and extract specific findings.

${reviews.map((review, index) => `MODEL ${index + 1} (${models[index]?.name || 'Unknown Model Name'}) REVIEW:\n${review}`).join('\n\n')}

Categories to consider:
${categories.map(cat => `- ${cat.name}: ${cat.description}`).join('\n')}

For each finding, determine:
1. A concise title
2. A detailed description
3. Which category it belongs to
4. Whether it's a strength or area for improvement
5. Which models mentioned it (model agreement)
6. Any code examples that illustrate the finding
7. Specific recommendations for addressing it (if it's an area for improvement)

Please be thorough in extracting distinct findings from all reviews.
`;
}
/**
 * Creates the schema for findings extraction
 */
function createFindingsSchema(
    models: ModelInfo[],
    categories: ReviewCategory[]
): Record<string, unknown> {
    return {
        type: 'object',
        properties: {
            findings: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        title: {
                            type: 'string',
                            description: 'Concise title for the finding',
                        },
                        description: {
                            type: 'string',
                            description: 'Detailed description of the finding',
                        },
                        category: {
                            type: 'string',
                            description: 'Category name from the provided list',
                            enum: categories.map(cat => cat.name), // Use categories for enum
                        },
                        isStrength: {
                            type: 'boolean',
                            description:
                                'Whether this is a strength (true) or area for improvement (false)',
                        },
                        modelAgreement: {
                            type: 'object',
                            properties: models.reduce(
                                (acc, model) => ({
                                    ...acc,
                                    [model?.id || model?.name || 'unknown']: {
                                        type: 'boolean',
                                        description: `Whether ${model?.name || 'unknown'} mentioned this finding`,
                                    },
                                }),
                                {}
                            ),
                            description: 'Which models mentioned this finding',
                        },
                        codeExample: {
                            type: 'object',
                            properties: {
                                code: {
                                    type: 'string',
                                    description: 'Code snippet illustrating the finding',
                                },
                                language: {
                                    type: 'string',
                                    description: 'Programming language of the code',
                                },
                            },
                            required: ['code', 'language'],
                        },
                        recommendation: {
                            type: 'string',
                            description: 'Specific recommendation for addressing the finding',
                        },
                    },
                    required: ['title', 'description', 'category', 'isStrength', 'modelAgreement'],
                },
            },
        },
        required: ['findings'],
    };
}
/**
 * Map the findings extracted by the LLM (FindingItem) to the required report format (ReviewFinding).
 */
function mapExtractedFindingsToRequiredFormat(
    findings: FindingItem[],
    categories: ReviewCategory[],
    models: ModelInfo[]
): ReviewFinding[] {
    // Ensure we have the 'Unknown Category' definition readily available
    let unknownCategory = categories.find(cat => cat.name === 'Unknown Category');

    // If unknown category doesn't exist, create it
    if (!unknownCategory) {
        unknownCategory = {
            name: 'Unknown Category',
            description: 'Findings that could not be mapped to a specific category',
        };
        // Add it to the categories array for future use
        categories.push(unknownCategory);
    }

    return findings.map(finding => {
        let targetCategory: ReviewCategory | null = null;

        // Handle missing, empty, or invalid category string from LLM
        if (typeof finding.category !== 'string' || !finding.category.trim()) {
            console.warn(
                `Finding has missing or invalid category string. Assigning to "Unknown Category". Finding: ${JSON.stringify(
                    {
                        title: finding.title,
                        description: finding.description,
                        category: finding.category, // Log the invalid value
                        isStrength: finding.isStrength,
                    },
                    null,
                    2
                )}`
            );
            targetCategory = unknownCategory; // Assign directly
        } else {
            // Attempt to find a matching category object based on the string name
            // First try exact match
            let matchedCategory = categories.find(cat => cat.name === finding.category);

            // If no exact match, try case-insensitive match
            if (!matchedCategory) {
                matchedCategory = categories.find(
                    cat => cat.name.toLowerCase() === finding.category.toLowerCase()
                );
            }

            // If still no match, try partial match (finding category contains category name or vice versa)
            if (!matchedCategory) {
                matchedCategory = categories.find(
                    cat =>
                        cat.name.toLowerCase().includes(finding.category.toLowerCase()) ||
                        finding.category.toLowerCase().includes(cat.name.toLowerCase())
                );
            }

            // If all matching attempts fail, use unknown category
            if (!matchedCategory) {
                console.warn(
                    `Could not find matching category for '${finding.category}', using Unknown Category`
                );
                matchedCategory = unknownCategory;
            }

            // Assign the final matched category
            targetCategory = matchedCategory;
        }

        // Map CodeExample if it exists
        const codeExample = finding.codeExample
            ? {
                  code: finding.codeExample.code,
                  language: finding.codeExample.language,
              }
            : undefined;

        // Create an empty record for model agreements - we'll fill it below
        const modelAgreements: Record<string, boolean> = {};

        // Map model agreements from the finding
        if (finding.modelAgreement) {
            // Extract the model agreements
            models.forEach(model => {
                // First try with model.id
                if (finding.modelAgreement[model.id] !== undefined) {
                    modelAgreements[model.name] = !!finding.modelAgreement[model.id];
                }
                // If not found by id, try with model.name
                else if (finding.modelAgreement[model.name] !== undefined) {
                    modelAgreements[model.name] = !!finding.modelAgreement[model.name];
                }
                // Default to false if not specified
                else {
                    modelAgreements[model.name] = false;
                }
            });
        } else {
            // If no model agreement data, default all to false
            models.forEach(model => {
                modelAgreements[model.name] = false;
            });
        }

        // Construct the valid ReviewFinding object
        const reviewFinding: ReviewFinding = {
            title: finding.title || 'Untitled Finding', // Use finding title or a default
            description: finding.description || 'No description provided.',
            category: targetCategory as ReviewCategory, // We ensure it's assigned above
            modelAgreements: modelAgreements,
            isStrength: finding.isStrength ?? false, // Use isStrength flag, default to false
            recommendation: finding.recommendation, // Optional field
            codeExample, // Optional field
        };

        return reviewFinding;
    });
}

/**
 * Extract model-specific insights using structured output from any available LLM provider
 */
async function extractModelInsights(
    reviews: string[],
    models: ModelInfo[]
): Promise<ModelInsight[]> {
    const provider = new ClaudeProvider();
    try {
        // Create prompt for extracting model-specific insights
        const prompt = `
I need you to identify unique insights or perspectives that each model contributes to the code reviews.

${reviews.map((review, index) => `MODEL ${index + 1} (${models[index]?.name || 'Unknown Model Name'}) REVIEW:\n${review.slice(0, 3000)}...`).join('\n\n')}

For each model, identify 1-2 unique insights or perspectives that are not emphasized as strongly by the other models.
`;

        // Define schema for model insights
        const schema = {
            type: 'object',
            properties: {
                modelInsights: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            modelId: {
                                type: 'string',
                                description: 'ID of the model (e.g., openai, claude, gemini)',
                            },
                            insight: {
                                type: 'string',
                                description: 'Brief title of the unique insight',
                            },
                            details: {
                                type: 'string',
                                description: 'Detailed explanation of the insight',
                            },
                        },
                        required: ['modelId', 'insight', 'details'],
                    },
                },
            },
            required: ['modelInsights'],
        };

        // Call the best available LLM provider with structured output
        const insightsResponse = await provider.runStructured<InsightsResponse>(
            prompt,
            schema,
            MAX_API_RETRIES,
            'insights',
            'Extract model insights from model reviews',
            8192 // Increased token limit to handle larger reviews
        );

        const apilog: ApiCallLog = {
            timestamp: new Date().toISOString(),
            model: provider.model,
            operation: 'insights',
            inputTokens: insightsResponse.usage.input_tokens,
            outputTokens: insightsResponse.usage.output_tokens,
            totalTokens: insightsResponse.usage.total_tokens,
            success: true,
            cost: insightsResponse.cost,
        };
        enhancedLogger.logApiCall(apilog);

        if (!insightsResponse || !insightsResponse.data || !insightsResponse.data.modelInsights) {
            throw new Error('LLM did not return expected model insights structure');
        }

        // Map the insights to the required format
        return mapModelInsightsToRequiredFormat(insightsResponse.data.modelInsights, models);
    } catch (error) {
        // Use the new error handling utilities for consistent error handling

        const apilog: ApiCallLog = {
            timestamp: new Date().toISOString(),
            model: provider.model,
            operation: 'insights',
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            success: false,
            cost: 0,
        };
        enhancedLogger.logApiCall(apilog);
        return safeReportGenerationAsync(
            async () => {
                throw error; // Re-throw the error to be handled by safeReportGenerationAsync
            },
            'model insights',
            'extraction',
            [], // Default empty array as fallback
            true // Log error stack trace
        );
    }
}
/**
 * Map model insights to required format
 * FIXED VERSION - Properly handles model identifiers
 */
function mapModelInsightsToRequiredFormat(
    insightsData: Array<{
        modelId: string;
        insight: string;
        details: string;
    }>,
    models: ModelInfo[]
): ModelInsight[] {
    return insightsData.map(insightData => {
        // First try to find the model by id
        let model = models.find(m => m.id === insightData.modelId);

        // If not found by id, try to find by name
        if (!model) {
            model = models.find(m => m.name.toLowerCase() === insightData.modelId.toLowerCase());
        }

        // If we still don't have a valid model, create a default one
        if (!model) {
            console.warn(
                `Could not find matching model for ID ${insightData.modelId}. Creating default model.`
            );

            // Create a default model
            model = {
                id: insightData.modelId || 'unknown',
                name: `Model ${insightData.modelId || 'Unknown'}`,
                description: 'Automatically created model',
            };
        }

        return {
            model,
            insight: insightData.insight,
            details: insightData.details,
        };
    });
}

/**
 * Generate prioritized recommendations using structured output from any available LLM provider
 */
export async function generatePrioritizedRecommendations(
    findings: ReviewFinding[]
): Promise<Record<Priority, string[]>> {
    const provider = new ClaudeProvider();
    try {
        // Extract all recommendations from findings
        const recommendations = findings
            .filter(f => !f.isStrength && f.recommendation)
            .map(f => f.recommendation as string);

        if (recommendations.length === 0) {
            return Promise.resolve({
                [Priority.HIGH]: [],
                [Priority.MEDIUM]: [],
                [Priority.LOW]: [],
            });
        }

        // Create prompt for prioritizing recommendations
        const prompt = `
I need you to prioritize these recommendations from a code review:

${recommendations.map((rec, i) => `${i + 1}. ${rec}`).join('\n')}

Group them into High, Medium, and Low priority categories based on:
- Impact: How much would fixing this improve the codebase quality (high/medium/low)
- Urgency: Does this need immediate attention (critical/important/nice-to-have)
- Effort: How much work would it take to implement (small/medium/large)

High priority: High impact items, especially those with small effort
Medium priority: Medium impact items and high impact with large effort
Low priority: Low impact items and nice-to-have improvements

Please be thorough in prioritizing these recommendations.
`;

        // Define schema for prioritized recommendations
        const schema = {
            type: 'object',
            properties: {
                highPriority: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'High priority recommendations that should be addressed first',
                },
                mediumPriority: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Medium priority recommendations',
                },
                lowPriority: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Low priority recommendations that can be addressed later',
                },
            },
            required: ['highPriority', 'mediumPriority', 'lowPriority'],
        };

        // Call the best available LLM provider with structured output
        const response = await provider.runStructured<PrioritizedResponse>(
            prompt,
            schema,
            MAX_API_RETRIES,
            'priorities',
            'Extract priorities from model reviews',
            8192 // Increased token limit to handle larger reviews
        );

        const apilog: ApiCallLog = {
            timestamp: new Date().toISOString(),
            model: provider.model,
            operation: 'priorities',
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
            totalTokens: response.usage.total_tokens,
            success: true,
            cost: response.cost,
        };
        enhancedLogger.logApiCall(apilog);

        if (!response || !response.data) {
            throw new Error('LLM did not return expected prioritized recommendations structure');
        }

        // Map priorities to required format
        return {
            [Priority.HIGH]: response.data.highPriority || [],
            [Priority.MEDIUM]: response.data.mediumPriority || [],
            [Priority.LOW]: response.data.lowPriority || [],
        };
    } catch {
        // Use the new error handling utilities for consistent error handling

        const apilog: ApiCallLog = {
            timestamp: new Date().toISOString(),
            model: provider.model,
            operation: 'priorities',
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            success: false,
            cost: 0,
        };
        enhancedLogger.logApiCall(apilog);
        return safeReportGenerationAsync(
            async () => {
                // Log the error but don't throw, instead return an empty priority object
                console.warn(
                    'Error generating prioritized recommendations, returning empty priorities'
                );
                return {
                    [Priority.HIGH]: [],
                    [Priority.MEDIUM]: [],
                    [Priority.LOW]: [],
                };
            },
            'prioritized recommendations',
            'generation',
            {
                [Priority.HIGH]: [],
                [Priority.MEDIUM]: [],
                [Priority.LOW]: [],
            }, // Default empty priorities as fallback
            true // Log error stack trace
        );
    }
}

/**
 * Format the report as Markdown
 * Includes improvements to address issues with the report format:
 * 1. Fixes the Model Agreement Analysis section
 * 2. Adds missing Priority Recommendations
 * 3. Improves Category Extraction
 * 4. Enhances Executive Summary
 * 5. Adds Visual Elements (where possible in markdown)
 * 6. Improves Code Example Formatting
 */
export function formatReportAsMarkdown(report: CodeReviewReport): string {
    try {
        let markdown = `# ${report.projectName || 'Triumvirate'} Code Review Report\n\n`;

        // Performance Dashboard
        markdown += '## Performance Dashboard\n\n';
        markdown += '| Model | Status | Latency | Cost | Total Tokens |\n';
        markdown += '|-------|:------:|--------:|-----:|-------------:|\n';

        // Calculate totals
        let totalLatency = 0;
        let totalCost = 0;
        let totalTokens = 0;

        // Safely handle modelMetrics
        if (Array.isArray(report.modelMetrics)) {
            report.modelMetrics.forEach(metric => {
                try {
                    // Update status from "Passed" to "Completed"
                    const status = metric.status
                        ? metric.status.replace('✅ Passed', '✅ Completed')
                        : 'Unknown';
                    const modelName =
                        metric.model && metric.model.name ? metric.model.name : 'Unknown';
                    const latencyMs = metric.latencyMs || 0;
                    const cost = metric.cost || 0;
                    const totalTokensMetric = metric.totalTokens || 0;

                    markdown += `| ${modelName} | ${status} | ${latencyMs.toLocaleString()}ms | $${cost.toFixed(8)} | ${totalTokensMetric.toLocaleString()} |\n`;

                    // Add to totals
                    // Convert latencyMs to a number if it's a string (remove 'ms' suffix if present)
                    const latencyAsNumber =
                        typeof latencyMs === 'string'
                            ? parseFloat(latencyMs.replace(/ms$/, ''))
                            : latencyMs;
                    totalLatency = Math.max(totalLatency, latencyAsNumber); // Wall time is the max latency
                    totalCost += cost;
                    totalTokens += totalTokensMetric;
                } catch {
                    // Use consistent error handling
                    const errorRow = safeDataProcessing(
                        () => {
                            console.warn('Error processing metric, using placeholder');
                            return `| Error processing metric | - | - | - | - |\n`;
                        },
                        'metric',
                        'processing',
                        `| Error processing metric | - | - | - | - |\n`,
                        'warn'
                    );
                    markdown += errorRow;
                }
            });
        } else {
            markdown += `| No metrics available | - | - | - | - |\n`;
        }

        // Add total row
        markdown += `| **TOTAL** | - | **${totalLatency.toLocaleString()}ms** | **$${totalCost.toFixed(8)}** | **${totalTokens.toLocaleString()}** |\n`;

        // Enhanced Executive Summary
        markdown += '\n## Executive Summary\n\n';

        // Add a comprehensive summary paragraph
        const totalFindings = Object.values(report.findingsByCategory || {}).flat().length;
        const strengths = (report.keyStrengths || []).length;
        const improvements = (report.keyAreasForImprovement || []).length;

        markdown += `This code review identified **${totalFindings} findings** across **${Object.keys(report.findingsByCategory || {}).length} categories**, highlighting **${strengths} key strengths** and **${improvements} areas for improvement**.\n\n`;

        // Key Strengths Section
        markdown += '### Key Strengths\n\n';
        if (Array.isArray(report.keyStrengths) && report.keyStrengths.length > 0) {
            report.keyStrengths.forEach((strength, index) => {
                try {
                    markdown += `${index + 1}. **${strength.title || 'Strength'}**: ${strength.description || 'No description provided'}\n`;
                } catch {
                    // Use consistent error handling
                    const errorItem = safeDataProcessing(
                        () => {
                            console.warn('Error processing strength, using placeholder');
                            return `${index + 1}. **Error processing strength**\n`;
                        },
                        'strength',
                        'processing',
                        `${index + 1}. **Error processing strength**\n`,
                        'warn'
                    );
                    markdown += errorItem;
                }
            });
        } else {
            markdown += 'No key strengths identified.\n';
        }

        // Key Areas for Improvement
        markdown += '\n### Key Areas for Improvement\n\n';
        if (
            Array.isArray(report.keyAreasForImprovement) &&
            report.keyAreasForImprovement.length > 0
        ) {
            report.keyAreasForImprovement.forEach((area, index) => {
                try {
                    markdown += `${index + 1}. **${area.title || 'Area for Improvement'}**: ${area.description || 'No description provided'}\n`;
                    if (area.recommendation) {
                        markdown += `   - **Recommendation**: ${area.recommendation}\n`;
                    }
                } catch {
                    // Use consistent error handling
                    const errorItem = safeDataProcessing(
                        () => {
                            console.warn('Error processing improvement area, using placeholder');
                            return `${index + 1}. **Error processing improvement area**\n`;
                        },
                        'improvement area',
                        'processing',
                        `${index + 1}. **Error processing improvement area**\n`,
                        'warn'
                    );
                    markdown += errorItem;
                }
            });
        } else {
            markdown += 'No key areas for improvement identified.\n';
        }

        // Model Insights Section
        markdown += '\n## Model Insights\n\n';
        markdown += '> Insights from individual models that contributed to this review.\n\n';

        // Safely handle modelInsights
        if (Array.isArray(report.modelInsights) && report.modelInsights.length > 0) {
            report.modelInsights.forEach(insight => {
                try {
                    const modelName =
                        insight.model && insight.model.name ? insight.model.name : 'Unknown';
                    markdown += `### ${modelName}\n\n`;
                    markdown += `${insight.insight || 'No insight provided'}\n\n`;
                    if (insight.details) {
                        markdown += `**Details**: ${insight.details}\n\n`;
                    }
                } catch {
                    // Use consistent error handling
                    const errorSection = safeDataProcessing(
                        () => {
                            console.warn('Error processing model insight, using placeholder');
                            return `### Error processing model insight\n\n`;
                        },
                        'model insight',
                        'processing',
                        `### Error processing model insight\n\n`,
                        'warn'
                    );
                    markdown += errorSection;
                }
            });
        } else {
            markdown += 'No model insights available.\n\n';
        }

        // Findings by Category
        markdown += '\n## Findings by Category\n\n';

        // Safely handle categories and findings
        if (report.categories && Array.isArray(report.categories) && report.categories.length > 0) {
            report.categories.forEach(category => {
                try {
                    if (!category || !category.name) {
                        return;
                    }

                    markdown += `### ${category.name}\n\n`;
                    // Check if description exists on the category object
                    if ('description' in category && category.description) {
                        markdown += `${category.description}\n\n`;
                    }

                    const findings = report.findingsByCategory?.[category.name] || [];
                    if (findings.length > 0) {
                        // Group findings by strength vs. improvement
                        const strengths = findings.filter(f => f.isStrength);
                        const improvements = findings.filter(f => !f.isStrength);

                        if (strengths.length > 0) {
                            markdown += '#### Strengths\n\n';
                            strengths.forEach((finding, idx) => {
                                markdown += `${idx + 1}. **${finding.title || 'Finding'}**: ${finding.description || 'No description provided'}\n`;
                                // Add model agreement info if available
                                if (finding.modelAgreements) {
                                    const agreementModels = Object.entries(finding.modelAgreements)
                                        .filter(([_, agrees]) => agrees)
                                        .map(([modelId]) => modelId);
                                    if (agreementModels.length > 0) {
                                        markdown += `   - **Model Agreement**: ${agreementModels.join(', ')}\n`;
                                    }
                                }
                                // Add code examples if available
                                if ('codeExample' in finding && finding.codeExample) {
                                    markdown += '   - **Code Example**:\n';
                                    const example = finding.codeExample;
                                    // Safely access properties that might not exist on CodeExample
                                    const description =
                                        'description' in example ? example.description : 'Example';
                                    markdown += `     - ${description}:\n`;
                                    markdown += '```\n';
                                    markdown += `${example.code || 'No code provided'}\n`;
                                    markdown += '```\n';
                                }
                            });
                            markdown += '\n';
                        }

                        if (improvements.length > 0) {
                            markdown += '#### Areas for Improvement\n\n';
                            improvements.forEach((finding, idx) => {
                                markdown += `${idx + 1}. **${finding.title || 'Finding'}**: ${finding.description || 'No description provided'}\n`;
                                // Add model agreement info if available
                                if (finding.modelAgreements) {
                                    const agreementModels = Object.entries(finding.modelAgreements)
                                        .filter(([_, agrees]) => agrees)
                                        .map(([modelId]) => modelId);
                                    if (agreementModels.length > 0) {
                                        markdown += `   - **Model Agreement**: ${agreementModels.join(', ')}\n`;
                                    }
                                }
                                // Add code examples if available
                                if ('codeExample' in finding && finding.codeExample) {
                                    markdown += '   - **Code Example**:\n';
                                    const example = finding.codeExample;
                                    // Safely access properties that might not exist on CodeExample
                                    const description =
                                        'description' in example ? example.description : 'Example';
                                    markdown += `     - ${description}:\n`;
                                    markdown += '```\n';
                                    markdown += `${example.code || 'No code provided'}\n`;
                                    markdown += '```\n';
                                }
                            });
                            markdown += '\n';
                        }
                    } else {
                        markdown += 'No findings in this category.\n\n';
                    }
                } catch {
                    // Use consistent error handling
                    const errorSection = safeDataProcessing(
                        () => {
                            console.warn('Error processing category, using placeholder');
                            return `### Error processing category\n\nAn error occurred while processing this category.\n\n`;
                        },
                        'category',
                        'processing',
                        `### Error processing category\n\nAn error occurred while processing this category.\n\n`,
                        'warn'
                    );
                    markdown += errorSection;
                }
            });
        } else {
            markdown += 'No categories available.\n\n';
        }

        // Model Agreement Analysis
        markdown += '\n## Model Agreement Analysis\n\n';
        markdown += '> Areas where models agree or disagree in their assessment.\n\n';
        markdown += '| Area | High Agreement | Partial Agreement | Disagreement |\n';
        markdown += '|------|---------------|-------------------|-------------|\n';

        // Safely handle agreementAnalysis
        const agreementAnalysis = report.agreementAnalysis || [];
        if (Array.isArray(agreementAnalysis) && agreementAnalysis.length > 0) {
            agreementAnalysis.forEach(analysis => {
                try {
                    const highAgreement =
                        Array.isArray(analysis?.highAgreement) && analysis.highAgreement.length > 0
                            ? analysis.highAgreement.join('<br>')
                            : '-';
                    const partialAgreement =
                        Array.isArray(analysis?.partialAgreement) &&
                        analysis.partialAgreement.length > 0
                            ? analysis.partialAgreement.join('<br>')
                            : '-';
                    const disagreement =
                        Array.isArray(analysis?.disagreement) && analysis.disagreement.length > 0
                            ? analysis.disagreement.join('<br>')
                            : '-';

                    markdown += `| ${analysis?.area || 'Unknown'} | ${highAgreement} | ${partialAgreement} | ${disagreement} |\n`;
                } catch (analysisError) {
                    console.error('Error processing agreement analysis:', analysisError);
                    markdown += `| Error processing analysis | - | - | - |\n`;
                }
            });
        } else {
            markdown += `| No agreement analysis available | - | - | - |\n`;
        }
        return markdown;
    } catch {
        // Use consistent error handling
        return safeDataProcessing(
            () => {
                console.warn('Error formatting report as markdown, returning basic format');
                return `# Triumvirate Code Review Report

## Error Generating Report

An error occurred while generating the markdown report.

### Basic Review Information

Please check the JSON output file for the raw review data.
`;
            },
            'markdown report',
            'formatting',
            `# Triumvirate Code Review Report

## Error Generating Report

An error occurred while generating the markdown report.

### Basic Review Information

Please check the JSON output file for the raw review data.
`, // Default simple report as fallback
            'error' // Log at error level
        );
    }
}
