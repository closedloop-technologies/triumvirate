// src/utils/report-utils.ts - Consolidated report formatting utilities
import {
    type ReviewCategory,
    type ModelInfo,
    type ModelMetrics,
    type ReviewFinding,
    type ModelInsight,
    type CategoryAgreementAnalysis,
    type AgreementStatistics,
    Priority,
    type CodeReviewReport,
    type CodeExample,
} from '../types/report';
import { runClaudeModelStructured } from '../models';
import type { ModelResult, StructuredReview } from '../types/model-responses';
import { safeReportGenerationAsync, safeDataProcessing } from './error-handling-extensions';

/**
 * Extract categories from model reviews using Claude's structured tools API
 */
export async function extractCategoriesWithClaude(reviews: string[]): Promise<ReviewCategory[]> {
    try {
        // Create a prompt for category extraction
        const prompt = createCategoryExtractionPrompt(reviews);

        // Define the schema for structured output
        const schema = createCategorySchema();

        // Define the expected response type
        interface ClaudeResponse {
            categories: Array<{
                name: string;
                description: string;
            }>;
        }

        // Call Claude with structured output using tools API
        const response = await runClaudeModelStructured<ClaudeResponse>(prompt, schema);

        // Validate response
        if (!isValidCategoryResponse(response)) {
            console.warn(
                'Claude did not return expected category structure, falling back to regex extraction'
            );
            return extractCategoriesWithRegex(reviews.join('\n\n'));
        }

        // Map the categories to the required format
        return mapCategoriesToRequiredFormat(response.data.categories);
    } catch (error) {
        // Use the new error handling utilities for consistent error handling
        return safeReportGenerationAsync(
            async () => {
                console.warn('Falling back to regex extraction method due to error');
                return extractCategoriesWithRegex(reviews.join('\n\n'));
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
 * Validates if the Claude response has the expected structure
 */
/**
 * Validates if the Claude response has the expected structure
 */
function isValidCategoryResponse(response: unknown): boolean {
    if (!response) {
        return false;
    }

    // Type guard to check if response has the expected structure
    return (
        response !== null &&
        typeof response === 'object' &&
        'data' in response &&
        response.data !== null &&
        typeof response.data === 'object' &&
        'categories' in response.data &&
        Array.isArray(response.data.categories)
    );
}

/**
 * Maps the Claude response categories to the required format
 */
function mapCategoriesToRequiredFormat(
    categories: Array<{ name: string; description: string }>
): ReviewCategory[] {
    return categories.map((cat, index) => {
        // Ensure we have valid data
        const name = cat.name?.trim() || `Category ${index + 1}`;
        const shortDescription = cat.description?.trim() || `Analysis of ${name}`;

        // Generate a stable ID based on the category name
        const id = `category_${index}_${name.toLowerCase().replace(/\s+/g, '_')}`;

        return {
            id,
            name,
            shortDescription,
        };
    });
}

/**
 * Extract categories from a review text using regex (fallback method)
 */
export function extractCategoriesWithRegex(reviewText: string): ReviewCategory[] {
    // Look for section headers
    const headerMatches = findSectionHeaders(reviewText);

    // Filter out common non-category headers
    const potentialCategories = filterNonCategoryHeaders(headerMatches);

    // If we can't find headers, fall back to common code review categories
    const categories =
        potentialCategories.length > 0 ? potentialCategories : getDefaultCategories();

    // Create category objects
    return createCategoryObjects(categories, reviewText);
}

/**
 * Find section headers in review text
 */
function findSectionHeaders(reviewText: string): string[] {
    const headerPattern = /##\s+(.*?)\n/g;
    const headerMatches = [...reviewText.matchAll(headerPattern)];
    return headerMatches.map(match => match[1] || '').filter(Boolean);
}

/**
 * Filter out common non-category headers
 */
function filterNonCategoryHeaders(headers: string[]): string[] {
    const excludeHeaders = [
        'Overview',
        'Summaries',
        'Results',
        'Executive Summary',
        'Conclusion',
        'Recommendations',
        'Model-Specific Highlights',
    ];

    return headers.filter(
        header => header && !excludeHeaders.includes(header) && header.length < 60
    );
}

/**
 * Get default categories when none are found
 */
function getDefaultCategories(): string[] {
    return [
        'Code Quality and Readability',
        'Potential Bugs or Issues',
        'Architecture and Design',
        'Performance Concerns',
        'Security Considerations',
    ];
}

/**
 * Create category objects from category names
 */
function createCategoryObjects(categories: string[], reviewText: string): ReviewCategory[] {
    return categories.map((name, index) => {
        // Ensure name is a string
        const categoryName = name || `Category ${index + 1}`;

        // Generate a stable ID based on the category name
        const id = `category_${index}_${categoryName.toLowerCase().replace(/\s+/g, '_')}`;

        // Try to extract a short description from the text
        const shortDescription = extractCategoryDescription(categoryName, reviewText);

        return {
            id,
            name: categoryName,
            shortDescription: shortDescription || `Analysis of ${categoryName}`,
        };
    });
}

/**
 * Extract a short description for a category from the review text
 */
function extractCategoryDescription(categoryName: string, reviewText: string): string | undefined {
    const descriptionPattern = new RegExp(`${categoryName}.*?\\n(.*?)(?=\\n##|\\Z)`, 's');
    const descriptionMatch = reviewText.match(descriptionPattern);

    if (descriptionMatch && descriptionMatch[1]) {
        // Try to get first sentence
        const sentences = descriptionMatch[1].trim().split(/\.\s+/);
        if (sentences.length > 0 && sentences[0]) {
            return sentences[0].trim();
        }
    }

    return undefined;
}

// For backward compatibility
export const extractCategories = extractCategoriesWithRegex;

/**
 * Create a standardized structure for the model metrics
 */
export function createModelMetrics(modelResults: ModelResult[]): ModelMetrics[] {
    return modelResults.map(result => {
        const modelInfo: ModelInfo = {
            id: result.model.toLowerCase(),
            name: result.model,
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

        // Extract just the key point - look for the first sentence or phrase
        const firstSentence = cleaned.split(/[.!?]\s+/)[0];
        if (firstSentence && firstSentence.length < 80) {
            return firstSentence;
        }

        // If the finding is too long, truncate it
        if (cleaned.length > 60) {
            return cleaned.substring(0, 57) + '...';
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
    let cleanParagraph = paragraph.replace(/^#+\s+/gm, '').trim();

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
    if (formatted.length > 80) {
        formatted = formatted.substring(0, 77) + '...';
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
    for (const word of words1) {
        if (words2.has(word)) {
            commonWords++;
        }
    }

    // Calculate Jaccard similarity
    const totalUniqueWords = new Set([...words1, ...words2]).size;
    return totalUniqueWords > 0 ? commonWords / totalUniqueWords : 0;
}

/**
 * Calculate agreement statistics
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

        const categoryFindings = findings[category.id] || [];

        for (const finding of categoryFindings) {
            if (finding.modelAgreement && finding.modelAgreement.modelAgreements) {
                const agreementCount = Object.values(finding.modelAgreement.modelAgreements).filter(
                    Boolean
                ).length;
                if (agreementCount === 3) {
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
    modelResults: ModelResult[]
): Promise<CodeReviewReport> {
    // Track any resources that need cleanup
    const resources: { cleanup: () => void }[] = [];

    try {
        console.log(`Generating enhanced report from ${modelResults.length} model results`);

        // Log input data structure for debugging
        logModelResults(modelResults);

        // Extract review texts
        const reviews = extractReviewTexts(modelResults);
        console.log(
            `Extracted ${reviews.length} reviews with lengths:`,
            reviews.map(r => r.length)
        );

        // Create model info objects
        const models = modelResults.map(result => ({
            id: result.model.toLowerCase(),
            name: result.model,
        }));

        // Create simple model metrics
        const modelMetrics = createModelMetrics(modelResults);

        // If we don't have any reviews, create a basic report
        if (!reviews.length || reviews.every(r => !r)) {
            console.warn('No valid reviews found in model results, creating basic report');
            return createBasicReport(modelResults, models, modelMetrics);
        }

        // Extract categories using Claude - ensure proper promise handling
        console.log('Extracting categories from reviews...');
        let categories;
        try {
            categories = await extractCategoriesWithClaude(reviews);
        } catch (categoryError) {
            console.error('Error extracting categories:', categoryError);
            return createBasicReport(modelResults, models, modelMetrics);
        }

        if (!categories.length) {
            console.warn('Failed to extract categories, creating basic report');
            return createBasicReport(modelResults, models, modelMetrics);
        }

        console.log(
            `Extracted ${categories.length} categories:`,
            categories.map(c => c.name)
        );

        // Extract findings using Claude - ensure proper promise handling
        console.log('Extracting findings from reviews...');
        let findings;
        try {
            findings = await extractFindingsWithClaude(reviews, categories, models);
        } catch (findingsError) {
            console.error('Error extracting findings:', findingsError);
            return {
                ...createBasicReport(modelResults, models, modelMetrics),
                categories,
            };
        }

        if (!findings.length) {
            console.warn('Failed to extract findings, creating basic report with categories');
            return {
                ...createBasicReport(modelResults, models, modelMetrics),
                categories,
            };
        }

        console.log(`Extracted ${findings.length} findings`);

        // Log distribution of findings by category
        const findingsByCategory = organizeFindingsByCategory(findings, categories);
        logFindingsDistribution(findingsByCategory, categories);

        // Identify key strengths and areas for improvement
        const { keyStrengths, keyAreasForImprovement } = identifyKeyFindingsImportance(findings);

        // Create model agreement analysis - ensure proper promise handling
        console.log('Analyzing model agreement...');
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

        // Calculate agreement statistics
        const agreementStatistics = calculateAgreementStats(findingsByCategory, categories);

        // Extract model insights - ensure proper promise handling
        console.log('Extracting model insights...');
        let modelInsights;
        try {
            modelInsights = await extractModelInsightsWithClaude(reviews, models);
        } catch (insightsError) {
            console.error('Error extracting model insights:', insightsError);
            modelInsights = models.map(model => ({
                model,
                insight: `Review from ${model.name}`,
                details: `Check the full review for detailed insights`,
            }));
        }

        // Generate prioritized recommendations - ensure proper promise handling
        console.log('Generating prioritized recommendations...');
        let prioritizedRecommendations;
        try {
            prioritizedRecommendations = await generatePrioritizedRecommendations(findings);
        } catch (recommendationsError) {
            console.error('Error generating prioritized recommendations:', recommendationsError);
            prioritizedRecommendations = {
                [Priority.HIGH]: [],
                [Priority.MEDIUM]: [],
                [Priority.LOW]: [],
            };
        }

        // Create the complete report
        console.log('Enhanced report generation complete');
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
            prioritizedRecommendations,
        };
    } catch (error) {
        // Use the new error handling utilities for consistent error handling
        return safeReportGenerationAsync(
            async () => {
                console.warn('Error in main report generation, falling back to basic report');
                return createBasicReport(modelResults);
            },
            'code review',
            'generation',
            createBasicReport(modelResults), // Default basic report as fallback
            true // Log error stack trace
        );
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

/**
 * Log model results for debugging
 */
function logModelResults(modelResults: ModelResult[]): void {
    console.log(
        'Model results structure:',
        JSON.stringify(
            modelResults.map(r => ({
                model: r.model,
                reviewLength: typeof r.review === 'string' ? r.review.length : 'non-string',
                metrics: r.metrics,
            })),
            null,
            2
        )
    );
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
        findingsByCategory[category.id] = findings.filter(
            f => f.category && f.category.id === category.id
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
    console.log('Findings distribution by category:');
    for (const [categoryId, catFindings] of Object.entries(findingsByCategory)) {
        const category = categories.find(c => c.id === categoryId);
        console.log(`- ${category?.name || categoryId}: ${catFindings.length} findings`);
    }
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
        .filter(f => f.isStrength && f.modelAgreement && f.modelAgreement.modelAgreements)
        .sort((a, b) => {
            // Sort by model agreement count (highest first)
            const agreementCountA = Object.values(a.modelAgreement.modelAgreements).filter(
                Boolean
            ).length;
            const agreementCountB = Object.values(b.modelAgreement.modelAgreements).filter(
                Boolean
            ).length;
            return agreementCountB - agreementCountA;
        })
        .slice(0, 5); // Take top 5 strengths

    // Identify key areas for improvement
    const keyAreasForImprovement = findings
        .filter(f => !f.isStrength && f.modelAgreement && f.modelAgreement.modelAgreements)
        .sort((a, b) => {
            // Sort by model agreement count (highest first)
            const agreementCountA = Object.values(a.modelAgreement.modelAgreements).filter(
                Boolean
            ).length;
            const agreementCountB = Object.values(b.modelAgreement.modelAgreements).filter(
                Boolean
            ).length;
            return agreementCountB - agreementCountA;
        })
        .slice(0, 5); // Take top 5 areas for improvement

    return { keyStrengths, keyAreasForImprovement };
}
/**
 * Extracts code review findings using structured Claude output
 * This function handles the analysis of review texts to identify specific findings
 * and categorize them properly
 *
 * @param reviews - Array of review texts from different models
 * @param categories - Array of review categories
 * @param models - Array of model information objects
 * @returns Promise with array of review findings
 */
async function extractFindingsWithClaude(
    reviews: string[],
    categories: ReviewCategory[],
    models: ModelInfo[]
): Promise<ReviewFinding[]> {
    try {
        // Log the inputs for debugging
        console.log(
            `Extracting findings with ${reviews.length} reviews, ${categories.length} categories, and ${models.length} models`
        );

        // Create the prompt for findings extraction
        const prompt = createFindingsExtractionPrompt(reviews, categories, models);

        // Define the schema for the structured output
        const schema = createFindingsSchema(models);

        // Define the response type
        interface FindingsResponse {
            findings: Array<{
                title: string;
                description: string;
                categoryName: string;
                isStrength: boolean;
                modelAgreement: Record<string, boolean>;
                codeExample?: {
                    code: string;
                    language: string;
                };
                recommendation?: string;
            }>;
        }

        // Call Claude with structured output
        console.log('Calling Claude for structured findings extraction...');
        const response = await runClaudeModelStructured<FindingsResponse>(prompt, schema);
        console.log('Claude findings extraction complete');

        // Validate the response structure
        if (!isValidFindingsResponse(response)) {
            throw new Error('Claude did not return expected findings structure');
        }

        console.log(`Extracted ${response.data.findings.length} findings`);

        // Map the findings to the required format
        return mapExtractedFindingsToRequiredFormat(response.data.findings, categories);
    } catch (error) {
        // Use the new error handling utilities for consistent error handling
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
${categories.map(cat => `- ${cat.name}: ${cat.shortDescription}`).join('\n')}

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
function createFindingsSchema(models: ModelInfo[]): Record<string, unknown> {
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
                        categoryName: {
                            type: 'string',
                            description: 'Category name from the provided list',
                        },
                        isStrength: {
                            type: 'boolean',
                            description:
                                'Whether this is a strength (true) or area for improvement (false)',
                        },
                        modelAgreement: {
                            type: 'object',
                            description: 'Which models mentioned this finding',
                            properties: models.reduce(
                                (acc, model) => ({
                                    ...acc,
                                    [model.id]: {
                                        type: 'boolean',
                                        description: `Whether ${model.name} mentioned this finding`,
                                    },
                                }),
                                {}
                            ),
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
                    required: [
                        'title',
                        'description',
                        'categoryName',
                        'isStrength',
                        'modelAgreement',
                    ],
                },
            },
        },
        required: ['findings'],
    };
}

/**
 * Validates if the Claude response has the expected structure
 */
/**
 * Validates if the findings response has the expected structure
 */
function isValidFindingsResponse(response: unknown): boolean {
    if (!response) {
        return false;
    }

    // Type guard to check if response has the expected structure
    return (
        typeof response === 'object' &&
        response !== null &&
        'data' in response &&
        typeof response.data === 'object' &&
        response.data !== null &&
        'findings' in response.data &&
        Array.isArray(response.data.findings)
    );
}

/**
 * Maps the extracted findings to the required format
 */
function mapExtractedFindingsToRequiredFormat(
    findings: Array<{
        title: string;
        description: string;
        categoryName: string;
        isStrength: boolean;
        modelAgreement: Record<string, boolean>;
        codeExample?: {
            code: string;
            language: string;
        };
        recommendation?: string;
    }>,
    categories: ReviewCategory[]
): ReviewFinding[] {
    return findings.map(finding => {
        // Find the matching category
        const category = findMatchingCategory(finding.categoryName, categories);

        return {
            title: finding.title,
            description: finding.description,
            category,
            isStrength: finding.isStrength,
            modelAgreement: {
                modelAgreements: finding.modelAgreement,
            },
            codeExample: finding.codeExample,
            recommendation: finding.recommendation,
        };
    });
}

/**
 * Finds a matching category or creates a fallback one
 */
function findMatchingCategory(categoryName: string, categories: ReviewCategory[]): ReviewCategory {
    // Find the matching category
    const category = categories.find(cat => cat.name.toLowerCase() === categoryName.toLowerCase());

    // If we found a match, return it
    if (category) {
        return category;
    }

    // If we didn't find a match but have categories, use the first one
    if (categories.length > 0) {
        // We've already checked categories.length > 0, so this is safe
        const fallbackCategory = categories[0]!;
        console.warn(
            `Could not find exact match for category "${categoryName}". Using fallback category "${fallbackCategory.name}".`
        );
        return fallbackCategory;
    }

    // If we have no categories at all, create a default one
    console.warn(`No categories available. Creating default category for "${categoryName}".`);

    return {
        id: `default_${Date.now()}`,
        name: categoryName || 'General',
        shortDescription: 'Automatically created category',
    };
}

/**
 * Extract model-specific insights using structured Claude output
 */
async function extractModelInsightsWithClaude(
    reviews: string[],
    models: ModelInfo[]
): Promise<ModelInsight[]> {
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

        // Define response type
        interface InsightsResponse {
            modelInsights: Array<{
                modelId: string;
                insight: string;
                details: string;
            }>;
        }

        // Call Claude with structured output
        const response = await runClaudeModelStructured<InsightsResponse>(prompt, schema);

        if (!response || !response.data || !response.data.modelInsights) {
            throw new Error('Claude did not return expected model insights structure');
        }

        // Map the insights to the required format
        return mapModelInsightsToRequiredFormat(response.data.modelInsights, models);
    } catch (error) {
        // Use the new error handling utilities for consistent error handling
        return safeReportGenerationAsync(
            async () => {
                // Log the error but don't throw, instead return an empty array
                console.warn('Error extracting model insights, returning empty array');
                return [];
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
        // Find the matching model or create a default one
        let model = models.find(m => m.id === insightData.modelId) || models[0];

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
 * Generate prioritized recommendations using structured Claude
 */
async function generatePrioritizedRecommendations(
    findings: ReviewFinding[]
): Promise<Record<Priority, string[]>> {
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

Provide at least 1-2 recommendations for each priority level.
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

        // Define response type
        interface PrioritizedResponse {
            highPriority: string[];
            mediumPriority: string[];
            lowPriority: string[];
        }

        // Call Claude with structured output
        const response = await runClaudeModelStructured<PrioritizedResponse>(prompt, schema);

        if (!response || !response.data) {
            throw new Error('Claude did not return expected prioritized recommendations structure');
        }

        // Map priorities to required format
        return {
            [Priority.HIGH]: response.data.highPriority || [],
            [Priority.MEDIUM]: response.data.mediumPriority || [],
            [Priority.LOW]: response.data.lowPriority || [],
        };
    } catch (error) {
        // Use the new error handling utilities for consistent error handling
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
 * Create a basic report when structured analysis fails
 * This ensures we always have a valid report even if the enhanced analysis fails
 */
function createBasicReport(
    modelResults: ModelResult[],
    models?: ModelInfo[],
    modelMetrics?: ModelMetrics[]
): CodeReviewReport {
    // Create model info objects if not provided
    const safeModels =
        models ||
        modelResults.map(result => ({
            id: result.model.toLowerCase(),
            name: result.model,
        }));

    // Create model metrics if not provided
    const safeMetrics = modelMetrics || createModelMetrics(modelResults);

    // Create simple categories and findings using regex extraction
    const { simpleCategories, simpleFindings, simpleFindingsByCategory } =
        createSimpleCategoriesAndFindings(modelResults, safeModels);

    // Create simple model insights
    const simpleModelInsights = createSimpleModelInsights(safeModels);

    // Create simple agreement analysis
    const simpleAgreementAnalysis = createSimpleAgreementAnalysis(simpleCategories);

    // Create simple agreement statistics
    const simpleAgreementStatistics = createSimpleAgreementStatistics(simpleCategories);

    // Create simple prioritized recommendations
    const simplePrioritizedRecommendations = createSimplePrioritizedRecommendations(modelResults);

    return {
        projectName: 'Triumvirate',
        reviewDate: new Date().toISOString(),
        categories: simpleCategories,
        models: safeModels,
        modelMetrics: safeMetrics,
        keyStrengths: simpleFindings.filter(f => f.isStrength),
        keyAreasForImprovement: simpleFindings.filter(f => !f.isStrength),
        findingsByCategory: simpleFindingsByCategory,
        modelInsights: simpleModelInsights,
        agreementAnalysis: simpleAgreementAnalysis,
        agreementStatistics: simpleAgreementStatistics,
        prioritizedRecommendations: simplePrioritizedRecommendations,
    };
}

/**
 * Create simple categories and findings for a basic report
 */
function createSimpleCategoriesAndFindings(
    modelResults: ModelResult[],
    safeModels: ModelInfo[]
): {
    simpleCategories: ReviewCategory[];
    simpleFindings: ReviewFinding[];
    simpleFindingsByCategory: Record<string, ReviewFinding[]>;
} {
    const simpleCategories: ReviewCategory[] = [];
    const simpleFindings: ReviewFinding[] = [];

    try {
        // Try to extract some basic categories using regex
        const combinedReview = modelResults.map(r => r.review || '').join('\n\n');
        const extractedCategories = extractCategoriesWithRegex(combinedReview);

        if (extractedCategories.length) {
            simpleCategories.push(...extractedCategories);

            // Create a simple finding for each category
            extractedCategories.forEach(category => {
                // Create a simple finding for strengths
                simpleFindings.push({
                    title: `${category.name} Strengths`,
                    description: `Strengths related to ${category.name.toLowerCase()}`,
                    category: category,
                    isStrength: true,
                    modelAgreement: {
                        modelAgreements: safeModels.reduce(
                            (acc, model) => {
                                acc[model.id] = true;
                                return acc;
                            },
                            {} as Record<string, boolean>
                        ),
                    },
                });

                // Create a simple finding for areas of improvement
                simpleFindings.push({
                    title: `${category.name} Areas for Improvement`,
                    description: `Areas for improvement related to ${category.name.toLowerCase()}`,
                    category: category,
                    isStrength: false,
                    modelAgreement: {
                        modelAgreements: safeModels.reduce(
                            (acc, model) => {
                                acc[model.id] = true;
                                return acc;
                            },
                            {} as Record<string, boolean>
                        ),
                    },
                });
            });
        }
    } catch (e) {
        console.error('Error creating simple findings:', e);
    }

    // Create a simple findingsByCategory map
    const simpleFindingsByCategory: Record<string, ReviewFinding[]> = {};
    simpleCategories.forEach(category => {
        if (category && category.id) {
            simpleFindingsByCategory[category.id] = simpleFindings.filter(
                f => f.category && f.category.id === category.id
            );
        }
    });

    return { simpleCategories, simpleFindings, simpleFindingsByCategory };
}

/**
 * Create simple model insights for a basic report
 */
function createSimpleModelInsights(safeModels: ModelInfo[]): ModelInsight[] {
    return safeModels.map(model => ({
        model,
        insight: `Review from ${model.name}`,
        details: `Check the full review from ${model.name} for detailed insights`,
    }));
}

/**
 * Create simple agreement analysis for a basic report
 */
function createSimpleAgreementAnalysis(
    simpleCategories: ReviewCategory[]
): CategoryAgreementAnalysis[] {
    return simpleCategories.map(category => ({
        area: category.name,
        highAgreement: [`${category.name} is important`],
        partialAgreement: [],
        disagreement: [],
    }));
}

/**
 * Create simple agreement statistics for a basic report
 */
function createSimpleAgreementStatistics(
    simpleCategories: ReviewCategory[]
): AgreementStatistics[] {
    return simpleCategories.map(category => ({
        category: category.name,
        allThreeModels: 1,
        twoModels: 0,
        oneModel: 0,
    }));
}

/**
 * Create simple prioritized recommendations for a basic report
 */
function createSimplePrioritizedRecommendations(
    modelResults: ModelResult[]
): Record<Priority, string[]> {
    return {
        [Priority.HIGH]: modelResults.map(r => r.summary || '').filter(Boolean),
        [Priority.MEDIUM]: [],
        [Priority.LOW]: [],
    };
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
                } catch (metricError) {
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
                } catch (strengthError) {
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
        if (Array.isArray(report.keyAreasForImprovement) && report.keyAreasForImprovement.length > 0) {
            report.keyAreasForImprovement.forEach((area, index) => {
                try {
                    markdown += `${index + 1}. **${area.title || 'Area for Improvement'}**: ${area.description || 'No description provided'}\n`;
                    if (area.recommendation) {
                        markdown += `   - **Recommendation**: ${area.recommendation}\n`;
                    }
                } catch (areaError) {
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
            report.modelInsights.forEach((insight, index) => {
                try {
                    const modelName = insight.model && insight.model.name ? insight.model.name : 'Unknown';
                    markdown += `### ${modelName}\n\n`;
                    markdown += `${insight.insight || 'No insight provided'}\n\n`;
                    if (insight.details) {
                        markdown += `**Details**: ${insight.details}\n\n`;
                    }
                } catch (insightError) {
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
                    if (!category || !category.id) {
                        return;
                    }

                    markdown += `### ${category.name || 'Unknown Category'}\n\n`;
                    // Check if description exists on the category object
                    if ('description' in category && category.description) {
                        markdown += `${category.description}\n\n`;
                    }

                    const findings = report.findingsByCategory?.[category.id] || [];
                    if (findings.length > 0) {
                        // Group findings by strength vs. improvement
                        const strengths = findings.filter(f => f.isStrength);
                        const improvements = findings.filter(f => !f.isStrength);

                        if (strengths.length > 0) {
                            markdown += '#### Strengths\n\n';
                            strengths.forEach((finding, idx) => {
                                markdown += `${idx + 1}. **${finding.title || 'Finding'}**: ${finding.description || 'No description provided'}\n`;
                                // Add model agreement info if available
                                if (finding.modelAgreement && finding.modelAgreement.modelAgreements) {
                                    const agreementModels = Object.entries(finding.modelAgreement.modelAgreements)
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
                                    const description = 'description' in example ? example.description : 'Example';
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
                                if (finding.modelAgreement && finding.modelAgreement.modelAgreements) {
                                    const agreementModels = Object.entries(finding.modelAgreement.modelAgreements)
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
                                    const description = 'description' in example ? example.description : 'Example';
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
                } catch (categoryError) {
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
        if (Array.isArray(report.agreementAnalysis) && report.agreementAnalysis.length > 0) {
            report.agreementAnalysis.forEach(analysis => {
                try {
                    const highAgreement = Array.isArray(analysis.highAgreement) && analysis.highAgreement.length > 0
                        ? analysis.highAgreement.join('<br>')
                        : '-';
                    const partialAgreement = Array.isArray(analysis.partialAgreement) && analysis.partialAgreement.length > 0
                        ? analysis.partialAgreement.join('<br>')
                        : '-';
                    const disagreement = Array.isArray(analysis.disagreement) && analysis.disagreement.length > 0
                        ? analysis.disagreement.join('<br>')
                        : '-';

                    markdown += `| ${analysis.area || 'Unknown'} | ${highAgreement} | ${partialAgreement} | ${disagreement} |\n`;
                } catch (analysisError) {
                    console.error('Error processing agreement analysis:', analysisError);
                    markdown += `| Error processing analysis | - | - | - |\n`;
                }
            });
        } else {
            markdown += `| No agreement analysis available | - | - | - |\n`;
        }

        // Enhanced Recommendations Priority Matrix
        markdown += '\n## Recommendations Priority Matrix\n\n';
        markdown +=
            '> Recommendations are prioritized based on impact, urgency, and implementation effort.\n\n';

        // Safely handle prioritizedRecommendations
        const prioritizedRecommendations = report.prioritizedRecommendations || {};
        Object.entries(prioritizedRecommendations).forEach(([priority, recommendations]) => {
            try {
                markdown += `### ${priority}\n`;
                if (Array.isArray(recommendations) && recommendations.length > 0) {
                    recommendations.forEach((recommendation, index) => {
                        markdown += `${index + 1}. ${recommendation}\n`;
                    });
                } else if (
                    priority === 'High Priority' &&
                    Array.isArray(report.keyAreasForImprovement) &&
                    report.keyAreasForImprovement.length > 0
                ) {
                    // Add fallback recommendations based on findings if no recommendations are available
                    report.keyAreasForImprovement.slice(0, 2).forEach((area, index) => {
                        if (area.recommendation) {
                            markdown += `${index + 1}. ${area.recommendation}\n`;
                        }
                    });
                } else if (
                    priority === 'Medium Priority' &&
                    Array.isArray(report.keyAreasForImprovement) &&
                    report.keyAreasForImprovement.length > 2
                ) {
                    report.keyAreasForImprovement.slice(2, 4).forEach((area, index) => {
                        if (area.recommendation) {
                            markdown += `${index + 1}. ${area.recommendation}\n`;
                        }
                    });
                } else {
                    markdown += 'No recommendations available.\n';
                }
                markdown += '\n';
            } catch (priorityError) {
                // Use consistent error handling
                const errorSection = safeDataProcessing(
                    () => {
                        console.warn(
                            `Error processing ${priority} recommendations, using placeholder`
                        );
                        return `### Error processing ${priority} recommendations\n\n`;
                    },
                    'priority recommendations',
                    'processing',
                    `### Error processing ${priority} recommendations\n\n`,
                    'warn'
                );
                markdown += errorSection;
            }
        });

        return markdown;
    } catch (error) {
        // Use consistent error handling
        return safeDataProcessing(
            () => {
                console.warn(
                    'Error formatting report as markdown, returning basic format'
                );
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

/**
 * @deprecated Use formatReportAsMarkdown instead. This function will be removed in a future version.
 */
export function enhancedFormatReportAsMarkdown(report: CodeReviewReport): string {
    console.warn('enhancedFormatReportAsMarkdown is deprecated. Use formatReportAsMarkdown instead.');
    return formatReportAsMarkdown(report);
}
