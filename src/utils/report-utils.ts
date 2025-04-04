// src/utils/report-utils.ts - New file for report generation utilities
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
} from '../types/report';
import { runClaudeModelStructured } from '../models';
import { enhancedFormatReportAsMarkdown } from './enhanced-report-formatter';

/**
 * Extract categories from model reviews using Claude's structured tools API
 */
export async function extractCategoriesWithClaude(reviews: string[]): Promise<ReviewCategory[]> {
    try {
        // Create a more focused prompt with clearer instructions
        const prompt = `
I need you to analyze these code review outputs from different models and extract the main categories discussed.
Please identify 5-8 distinct categories that cover the major topics across all reviews.

For each category, provide:
1. A concise name (e.g., "Code Quality", "Security", "Performance")
2. A short 1-2 sentence description of what this category encompasses

${reviews.map((review, index) => `MODEL ${index + 1} REVIEW:\n${review}`).join('\n\n')}
`;

        // Define a more precise schema for the structured data
        const schema = {
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

        // Define the expected response type
        interface ClaudeResponse {
            categories: Array<{
                name: string;
                description: string;
            }>;
        }

        // Call Claude with structured output using tools API
        const response = await runClaudeModelStructured<ClaudeResponse>(prompt, schema);

        if (
            !response ||
            !response.data ||
            !response.data.categories ||
            !Array.isArray(response.data.categories)
        ) {
            console.warn(
                'Claude did not return expected category structure, falling back to regex extraction'
            );
            return extractCategoriesWithRegex(reviews.join('\n\n'));
        }

        // Map the categories to the required format
        return response.data.categories.map((cat, index) => {
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
    } catch (error) {
        console.error('Error extracting categories with Claude:', error);
        // Fall back to regex method
        return extractCategoriesWithRegex(reviews.join('\n\n'));
    }
}

/**
 * Extract categories from a review text using regex (fallback method)
 */
export function extractCategoriesWithRegex(reviewText: string): ReviewCategory[] {
    // Look for section headers
    const headerPattern = /##\s+(.*?)\n/g;
    const headerMatches = [...reviewText.matchAll(headerPattern)];

    // Filter out common non-category headers
    const excludeHeaders = [
        'Overview',
        'Summaries',
        'Results',
        'Executive Summary',
        'Conclusion',
        'Recommendations',
        'Model-Specific Highlights',
    ];

    const potentialCategories = headerMatches
        .map(match => match[1])
        .filter(header => header && !excludeHeaders.includes(header) && header.length < 60);

    // If we can't find headers, fall back to common code review categories
    const categories =
        potentialCategories.length > 0
            ? potentialCategories
            : [
                  'Code Quality and Readability',
                  'Potential Bugs or Issues',
                  'Architecture and Design',
                  'Performance Concerns',
                  'Security Considerations',
              ];

    // Create category objects
    return categories.map((name, index) => {
        // Ensure name is a string
        const categoryName = name || `Category ${index + 1}`;

        // Generate a stable ID based on the category name
        const id = `category_${index}_${categoryName.toLowerCase().replace(/\s+/g, '_')}`;

        // Try to extract a short description from the text
        const descriptionPattern = new RegExp(`${categoryName}.*?\\n(.*?)(?=\\n##|\\Z)`, 's');
        const descriptionMatch = reviewText.match(descriptionPattern);

        let shortDescription: string | undefined = undefined;
        if (descriptionMatch && descriptionMatch[1]) {
            // Try to get first sentence
            const sentences = descriptionMatch[1].trim().split(/\.\s+/);
            if (sentences.length > 0 && sentences[0]) {
                shortDescription = sentences[0].trim();
            }
        }

        return {
            id,
            name: categoryName,
            shortDescription: shortDescription || `Analysis of ${categoryName}`,
        };
    });
}

// For backward compatibility
export const extractCategories = extractCategoriesWithRegex;

/**
 * Create a standardized structure for the model metrics
 */
export function createModelMetrics(modelResults: any[]): ModelMetrics[] {
    return modelResults.map(result => {
        const modelInfo: ModelInfo = {
            id: result.model.toLowerCase(),
            name: result.model,
        };

        return {
            model: modelInfo,
            status: result.metrics.error ? '❌ Failed' : '✅ Completed',
            latencyMs: result.metrics.latency || 0,
            cost: parseFloat(result.metrics.cost || '0'),
            totalTokens: result.metrics.tokenTotal || 0,
            costPer1kTokens: result.metrics.tokenTotal
                ? (parseFloat(result.metrics.cost || '0') * 1000) / result.metrics.tokenTotal
                : 0,
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
    // Define common categories for code reviews
    const categories = [
        'Code Quality',
        'Potential Bugs',
        'Architecture',
        'Performance',
        'Security',
    ];

    // Define keywords for each category to help with classification
    const categoryKeywords: Record<string, string[]> = {
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

    // Extract findings from each review
    const modelFindings: Record<string, Record<string, string[]>> = {};

    // Initialize model findings structure
    modelIds.forEach(modelId => {
        categories.forEach(category => {
            if (!modelFindings[modelId]) {
                modelFindings[modelId] = {};
            }
            modelFindings[modelId][category] = [];
        });
    });

    // Extract findings from each review and categorize them
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

            // Only add if we have a reasonable match
            if (highestScore > 0 && bestCategory) {
                // Extract a concise finding from the paragraph
                let finding = extractFinding(paragraph);
                if (finding) {
                    if (!modelFindings[modelId]) {
                        modelFindings[modelId] = {};
                    }
                    const categoryFindings = modelFindings[modelId][bestCategory] || [];
                    categoryFindings.push(finding);
                    modelFindings[modelId][bestCategory] = categoryFindings;
                }
            }
        });
    });

    // Analyze agreement across models for each category
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

        // Categorize findings by agreement level
        const highAgreement: string[] = [];
        const partialAgreement: string[] = [];
        const disagreement: string[] = [];

        // Process findings and group similar ones together
        const processedFindings = new Set<string>();

        // First, find high agreement items (all models agree)
        allFindings.forEach((modelsThatMentioned, finding) => {
            if (processedFindings.has(finding)) return;

            if (modelsThatMentioned.length === modelIds.length) {
                highAgreement.push(finding);
                processedFindings.add(finding);

                // Find and mark similar findings to avoid duplication
                allFindings.forEach((_, otherFinding) => {
                    if (finding !== otherFinding && !processedFindings.has(otherFinding)) {
                        if (calculateSimilarity(finding, otherFinding) > 0.7) {
                            processedFindings.add(otherFinding);
                        }
                    }
                });
            }
        });

        // Then, find partial agreement items (more than one model agrees)
        allFindings.forEach((modelsThatMentioned, finding) => {
            if (processedFindings.has(finding)) return;

            if (modelsThatMentioned.length > 1) {
                partialAgreement.push(finding);
                processedFindings.add(finding);

                // Find and mark similar findings to avoid duplication
                allFindings.forEach((_, otherFinding) => {
                    if (finding !== otherFinding && !processedFindings.has(otherFinding)) {
                        if (calculateSimilarity(finding, otherFinding) > 0.7) {
                            processedFindings.add(otherFinding);
                        }
                    }
                });
            }
        });

        // Finally, add disagreement items (only one model mentions)
        allFindings.forEach((modelsThatMentioned, finding) => {
            if (processedFindings.has(finding)) return;

            disagreement.push(finding);
            processedFindings.add(finding);
        });

        // Format and limit the findings for each category
        const formatAndLimit = (findings: string[], limit: number): string[] => {
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
        };

        return {
            area: category,
            highAgreement: formatAndLimit(highAgreement, 3),
            partialAgreement: formatAndLimit(partialAgreement, 3),
            disagreement: formatAndLimit(disagreement, 3),
        };
    });
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

    // Look for key phrases that indicate findings
    const keyPhrases = [
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
 * Format a finding to be concise and readable
 */
function formatFinding(text: string): string {
    if (!text) return '';

    // Remove any markdown formatting
    let formatted = text.replace(/\*\*/g, '').replace(/\*/g, '').trim();

    // Remove common prefixes that make findings verbose
    const prefixesToRemove = [
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

// Improvements for generateCodeReviewReport function

/**
 * Generate a comprehensive code review report with structured Claude analysis
 * This enhanced version uses Claude's structured output to better organize findings
 * With improved debugging and error handling
 */
export async function generateCodeReviewReport(modelResults: any[]): Promise<CodeReviewReport> {
    try {
        console.log(`Generating enhanced report from ${modelResults.length} model results`);
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

        // Extract review texts
        const reviews = modelResults.map(result => {
            if (typeof result.review === 'string') {
                return result.review;
            } else if (result.review && result.review.text) {
                return result.review.text;
            } else {
                return JSON.stringify(result.review);
            }
        });

        console.log(
            `Extracted ${reviews.length} reviews with lengths:`,
            reviews.map(r => r.length)
        );

        // Create model info objects
        const models = modelResults.map(result => ({
            id: result.model.toLowerCase(),
            name: result.model,
        }));

        // Create simple model metrics first (this should always work)
        const modelMetrics = createModelMetrics(modelResults);

        // If we don't have any reviews, create a basic report
        if (!reviews.length || reviews.every(r => !r)) {
            console.warn('No valid reviews found in model results, creating basic report');
            return createBasicReport(modelResults, models, modelMetrics);
        }

        // Extract categories using Claude
        console.log('Extracting categories from reviews...');
        const categories = await extractCategoriesWithClaude(reviews);

        if (!categories.length) {
            console.warn('Failed to extract categories, creating basic report');
            return createBasicReport(modelResults, models, modelMetrics);
        }

        console.log(
            `Extracted ${categories.length} categories:`,
            categories.map(c => c.name)
        );

        // Use structured Claude output to extract findings from reviews
        console.log('Extracting findings from reviews...');
        const findings = await extractFindingsWithClaude(reviews, categories, models);

        if (!findings.length) {
            console.warn('Failed to extract findings, creating basic report with categories');
            return {
                ...createBasicReport(modelResults, models, modelMetrics),
                categories,
            };
        }

        console.log(`Extracted ${findings.length} findings`);

        // Log distribution of findings by category
        const findingsByCategory: Record<string, ReviewFinding[]> = {};
        for (const finding of findings) {
            const categoryId = String(finding.category?.id || 'unknown');
            if (!findingsByCategory[categoryId]) {
                findingsByCategory[categoryId] = [];
            }
            findingsByCategory[categoryId].push(finding);
        }

        console.log('Findings distribution by category:');
        for (const [categoryId, catFindings] of Object.entries(findingsByCategory)) {
            const category = categories.find(c => c.id === categoryId);
            console.log(`- ${category?.name || categoryId}: ${catFindings.length} findings`);
        }

        // Rest of the function remains the same...

        // Organize findings by category
        const findingsByCategoryMap: Record<string, ReviewFinding[]> = {};
        categories.forEach(category => {
            findingsByCategoryMap[category.id] = findings.filter(
                f => f.category && f.category.id === category.id
            );
        });

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

        // Create model agreement analysis
        console.log('Analyzing model agreement...');
        const agreementAnalysis = analyzeModelAgreement(
            reviews,
            models.map(m => m.id)
        );

        // Calculate agreement statistics
        const agreementStatistics = calculateAgreementStats(findingsByCategoryMap, categories);

        // Extract model insights using structured Claude
        console.log('Extracting model insights...');
        const modelInsights = await extractModelInsightsWithClaude(reviews, models);

        // Generate prioritized recommendations using structured Claude
        console.log('Generating prioritized recommendations...');
        const prioritizedRecommendations = await generatePrioritizedRecommendations(findings);

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
            findingsByCategory: findingsByCategoryMap,
            modelInsights,
            agreementAnalysis,
            agreementStatistics,
            prioritizedRecommendations,
        };
    } catch (error) {
        console.error('Error generating code review report:', error);
        console.error('Stack trace:', (error as Error).stack);
        // Return a minimal valid report to prevent crashes
        return createBasicReport(modelResults);
    }
}

/**
 * Create a basic report when structured analysis fails
 * This ensures we always have a valid report even if the enhanced analysis fails
 */
function createBasicReport(
    modelResults: any[],
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

    // Extract simple findings from reviews using regex
    const simpleFindings: ReviewFinding[] = [];
    const simpleCategories: ReviewCategory[] = [];

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
                    category: category, // Ensure this is not undefined
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
                    category: category, // Ensure this is not undefined
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

    // Create simple model insights
    const simpleModelInsights: ModelInsight[] = safeModels.map(model => ({
        model,
        insight: `Review from ${model.name}`,
        details: `Check the full review from ${model.name} for detailed insights`,
    }));

    // Create simple agreement analysis
    const simpleAgreementAnalysis: CategoryAgreementAnalysis[] = simpleCategories.map(category => ({
        area: category.name,
        highAgreement: [`${category.name} is important`],
        partialAgreement: [],
        disagreement: [],
    }));

    // Create simple agreement statistics
    const simpleAgreementStatistics: AgreementStatistics[] = simpleCategories.map(category => ({
        category: category.name,
        allThreeModels: 1,
        twoModels: 0,
        oneModel: 0,
    }));

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
        prioritizedRecommendations: {
            [Priority.HIGH]: modelResults.map(r => r.summary || '').filter(Boolean),
            [Priority.MEDIUM]: [],
            [Priority.LOW]: [],
        },
    };
}
// Improvements for report-utils.ts extractFindingsWithClaude function

/**
 * Extract code review findings using structured Claude output
 * With improved error handling and debugging
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
        console.log(`Categories: ${JSON.stringify(categories, null, 2)}`);

        // Create a focused prompt for extracting findings
        const prompt = `
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

        // Define the schema for the findings
        const schema = {
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

        if (!response || !response.data || !response.data.findings) {
            console.warn(
                'Claude did not return expected findings structure:',
                JSON.stringify(response, null, 2)
            );
            throw new Error('Claude did not return expected findings structure');
        }

        console.log(`Extracted ${response.data.findings.length} findings`);

        // Map the findings to the required format
        const mappedFindings = response.data.findings.map(finding => {
            // Find the matching category
            // Ensure we always have a valid category by using the first category as fallback
            const category = categories.find(
                cat => cat.name.toLowerCase() === finding.categoryName.toLowerCase()
            );

            // Make sure we have a valid category
            if (categories.length === 0) {
                throw new Error('No categories available for findings');
            }

            // Use the found category or the first one as fallback, or create a default category
            let validCategory = category || categories[0];

            // If we still don't have a valid category (which shouldn't happen due to the check above),
            // create a default category to satisfy the type system
            if (!validCategory) {
                console.warn(
                    `Could not find matching category for "${finding.categoryName}". Creating default category.`
                );
                // Create a default category
                validCategory = {
                    id: `default_${Date.now()}`,
                    name: finding.categoryName || 'General',
                    shortDescription: 'Automatically created category',
                };
            }

            return {
                title: finding.title,
                description: finding.description,
                category: validCategory,
                isStrength: finding.isStrength,
                modelAgreement: {
                    modelAgreements: finding.modelAgreement,
                },
                codeExample: finding.codeExample,
                recommendation: finding.recommendation,
            };
        });

        console.log(`Mapped ${mappedFindings.length} findings successfully`);
        return mappedFindings;
    } catch (error) {
        console.error('Error extracting findings with Claude:', error);
        console.error('Stack trace:', (error as Error).stack);
        throw new Error('Failed to extract findings');
    }
}

/**
 * Extract model-specific insights using structured Claude output
 */
async function extractModelInsightsWithClaude(
    reviews: string[],
    models: ModelInfo[]
): Promise<ModelInsight[]> {
    try {
        // Create a prompt for extracting model-specific insights
        const prompt = `
I need you to identify unique insights or perspectives that each model contributes to the code reviews.

${reviews.map((review, index) => `MODEL ${index + 1} (${models[index]?.name || 'Unknown Model Name'}) REVIEW:\n${review.slice(0, 3000)}...`).join('\n\n')}

For each model, identify 1-2 unique insights or perspectives that are not emphasized as strongly by the other models.
`;

        // Define the schema for model insights
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

        // Define the response type
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
        return response.data.modelInsights.map(insightData => {
            // Find the matching model
            let model = models.find(m => m.id === insightData.modelId) || models[0];

            // If we still don't have a valid model (which could happen if models array is empty),
            // create a default model to satisfy the type system
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
    } catch (error) {
        console.error('Error extracting model insights with Claude:', error);
        throw new Error('Failed to extract model insights');
    }
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

        // Create a more detailed prompt for prioritizing recommendations
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

        // Define the schema for prioritized recommendations
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

        // Define the response type
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

        // Map the priorities to the required format
        return {
            [Priority.HIGH]: response.data.highPriority || [],
            [Priority.MEDIUM]: response.data.mediumPriority || [],
            [Priority.LOW]: response.data.lowPriority || [],
        };
    } catch (error) {
        console.error('Error generating prioritized recommendations with Claude:', error);
        throw new Error('Failed to generate prioritized recommendations');
    }
}

/**
 * Format the report as Markdown
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
                    totalLatency = Math.max(totalLatency, latencyMs); // Wall time is the max latency
                    totalCost += cost;
                    totalTokens += totalTokensMetric;
                } catch (metricError) {
                    console.error('Error processing metric:', metricError);
                    markdown += `| Error processing metric | - | - | - | - |\n`;
                }
            });
        } else {
            markdown += `| No metrics available | - | - | - | - |\n`;
        }

        // Add total row
        markdown += `| **TOTAL** | - | **${totalLatency.toLocaleString()}ms** | **$${totalCost.toFixed(8)}** | **${totalTokens.toLocaleString()}** |\n`;

        // Executive Summary
        markdown += '\n## Executive Summary\n\n';
        markdown += `This report presents a comprehensive code review of the ${report.projectName || 'Triumvirate'} codebase conducted by ${Array.isArray(report.models) ? report.models.length : 0} leading language models.\n\n`;

        // Safely handle models
        const safeModels = Array.isArray(report.models) ? report.models : [];

        // Key Strengths
        markdown += '### Key Strengths\n\n';
        if (safeModels.length > 0) {
            markdown +=
                '| Strength | ' + safeModels.map(m => m.name || 'Unknown').join(' | ') + ' |\n';
            markdown += '|----------|' + safeModels.map(() => ':------:').join('|') + '|\n';

            // Safely handle keyStrengths
            if (Array.isArray(report.keyStrengths)) {
                report.keyStrengths.forEach(strength => {
                    try {
                        markdown += `| **${strength.title || 'Untitled'}**: ${strength.description || 'No description'} |`;
                        safeModels.forEach(model => {
                            const modelId = model.id || '';
                            const modelAgreements =
                                strength.modelAgreement && strength.modelAgreement.modelAgreements
                                    ? strength.modelAgreement.modelAgreements
                                    : {};
                            const agreed = modelAgreements[modelId] ? '✓' : '';
                            markdown += ` ${agreed} |`;
                        });
                        markdown += '\n';
                    } catch (strengthError) {
                        console.error('Error processing strength:', strengthError);
                        markdown += `| Error processing strength | ${safeModels.map(() => ' - |').join('')}\n`;
                    }
                });
            } else {
                markdown += `| No key strengths identified | ${safeModels.map(() => ' - |').join('')}\n`;
            }
        } else {
            markdown += 'No models available to analyze strengths.\n\n';
        }

        // Key Areas for Improvement
        markdown += '\n### Key Areas for Improvement\n\n';
        if (safeModels.length > 0) {
            markdown +=
                '| Area for Improvement | ' +
                safeModels.map(m => m.name || 'Unknown').join(' | ') +
                ' |\n';
            markdown +=
                '|----------------------|' + safeModels.map(() => ':------:').join('|') + '|\n';

            // Safely handle keyAreasForImprovement
            if (Array.isArray(report.keyAreasForImprovement)) {
                report.keyAreasForImprovement.forEach(area => {
                    try {
                        markdown += `| **${area.title || 'Untitled'}**: ${area.description || 'No description'} |`;
                        safeModels.forEach(model => {
                            const modelId = model.id || '';
                            const modelAgreements =
                                area.modelAgreement && area.modelAgreement.modelAgreements
                                    ? area.modelAgreement.modelAgreements
                                    : {};
                            const agreed = modelAgreements[modelId] ? '✓' : '';
                            markdown += ` ${agreed} |`;
                        });
                        markdown += '\n';
                    } catch (areaError) {
                        console.error('Error processing area for improvement:', areaError);
                        markdown += `| Error processing area | ${safeModels.map(() => ' - |').join('')}\n`;
                    }
                });
            } else {
                markdown += `| No areas for improvement identified | ${safeModels.map(() => ' - |').join('')}\n`;
            }
        } else {
            markdown += 'No models available to analyze areas for improvement.\n\n';
        }

        // Add separator
        markdown += '\n---\n\n';

        // Consolidated Review by Category
        markdown += '## Consolidated Review by Category\n\n';

        // Safely handle categories
        if (Array.isArray(report.categories)) {
            report.categories.forEach(category => {
                try {
                    markdown += `### ${category.name || 'Unnamed Category'}\n\n`;

                    // Safely handle findingsByCategory
                    const findingsByCategory = report.findingsByCategory || {};
                    const categoryId = category.id || '';
                    const categoryFindings = Array.isArray(findingsByCategory[categoryId])
                        ? findingsByCategory[categoryId]
                        : [];

                    // If there are strength findings for this category
                    const strengths = categoryFindings.filter(f => f && f.isStrength) || [];
                    if (strengths.length > 0) {
                        markdown += '#### Strengths\n\n';
                        if (safeModels.length > 0) {
                            markdown +=
                                '| Strength | ' +
                                safeModels.map(m => m.name || 'Unknown').join(' | ') +
                                ' |\n';
                            markdown +=
                                '|----------|' + safeModels.map(() => ':------:').join('|') + '|\n';

                            strengths.forEach(strength => {
                                try {
                                    markdown += `| **${strength.title || 'Untitled'}**: ${strength.description || 'No description'} |`;
                                    safeModels.forEach(model => {
                                        const modelId = model.id || '';
                                        const modelAgreements =
                                            strength.modelAgreement &&
                                            strength.modelAgreement.modelAgreements
                                                ? strength.modelAgreement.modelAgreements
                                                : {};
                                        const agreed = modelAgreements[modelId] ? '✓' : '';
                                        markdown += ` ${agreed} |`;
                                    });
                                    markdown += '\n';
                                } catch (strengthError) {
                                    console.error(
                                        'Error processing category strength:',
                                        strengthError
                                    );
                                    markdown += `| Error processing strength | ${safeModels.map(() => ' - |').join('')}\n`;
                                }
                            });
                        } else {
                            markdown += 'No models available to analyze strengths.\n\n';
                        }
                    }

                    // If there are issue findings for this category
                    const issues = categoryFindings.filter(f => f && !f.isStrength) || [];
                    if (issues.length > 0) {
                        markdown += '\n#### Areas for Improvement\n\n';

                        issues.forEach(issue => {
                            try {
                                if (safeModels.length > 0) {
                                    markdown += `| Issue | Description | ${safeModels.map(m => m.name || 'Unknown').join(' | ')} |\n`;
                                    markdown += `|-------|-------------|${safeModels.map(() => ':------:').join('|')}|\n`;
                                    markdown += `| **${issue.title || 'Untitled'}** | ${issue.description || 'No description'} |`;

                                    safeModels.forEach(model => {
                                        const modelId = model.id || '';
                                        const modelAgreements =
                                            issue.modelAgreement &&
                                            issue.modelAgreement.modelAgreements
                                                ? issue.modelAgreement.modelAgreements
                                                : {};
                                        const agreed = modelAgreements[modelId] ? '✓' : '';
                                        markdown += ` ${agreed} |`;
                                    });
                                    markdown += '\n\n';
                                } else {
                                    markdown += `**${issue.title || 'Untitled'}**: ${issue.description || 'No description'}\n\n`;
                                }

                                // Add code example if available
                                if (
                                    issue.codeExample &&
                                    issue.codeExample.language &&
                                    issue.codeExample.code
                                ) {
                                    markdown += '```' + issue.codeExample.language + '\n';
                                    markdown += issue.codeExample.code + '\n';
                                    markdown += '```\n';
                                }

                                // Add recommendation if available
                                if (issue.recommendation) {
                                    markdown += `**Recommendation**: ${issue.recommendation}\n\n`;
                                }
                            } catch (issueError) {
                                console.error('Error processing category issue:', issueError);
                                markdown += `Error processing issue\n\n`;
                            }
                        });
                    }
                } catch (categoryError) {
                    console.error('Error processing category:', categoryError);
                    markdown += `### Error processing category\n\n`;
                }
            });
        } else {
            markdown += 'No categories available.\n\n';
        }

        // Model-Specific Highlights
        markdown += '## Model-Specific Highlights\n\n';

        markdown += '### Unique Insights by Model\n\n';
        markdown += '| Model | Unique Insight | Details |\n';
        markdown += '|-------|----------------|--------|\n';

        // Safely handle modelInsights
        if (Array.isArray(report.modelInsights)) {
            report.modelInsights.forEach(insight => {
                try {
                    const modelName =
                        insight.model && insight.model.name ? insight.model.name : 'Unknown';
                    markdown += `| **${modelName}** | ${insight.insight || 'No insight'} | ${insight.details || 'No details'} |\n`;
                } catch (insightError) {
                    console.error('Error processing model insight:', insightError);
                    markdown += `| Error processing insight | - | - |\n`;
                }
            });
        } else {
            markdown += `| No model insights available | - | - |\n`;
        }

        markdown += '\n### Model Agreement Analysis\n\n';
        markdown += '| Area | High Agreement | Partial Agreement | Disagreement |\n';
        markdown += '|------|----------------|-------------------|-------------|\n';

        // Safely handle agreementAnalysis
        if (Array.isArray(report.agreementAnalysis)) {
            report.agreementAnalysis.forEach(analysis => {
                try {
                    const highAgreement = Array.isArray(analysis.highAgreement)
                        ? analysis.highAgreement
                              .map(
                                  item =>
                                      `- ${item.length > 50 ? item.substring(0, 47) + '...' : item}`
                              )
                              .join('\n')
                        : '';
                    const partialAgreement = Array.isArray(analysis.partialAgreement)
                        ? analysis.partialAgreement
                              .map(
                                  item =>
                                      `- ${item.length > 50 ? item.substring(0, 47) + '...' : item}`
                              )
                              .join('\n')
                        : '';
                    const disagreement = Array.isArray(analysis.disagreement)
                        ? analysis.disagreement
                              .map(
                                  item =>
                                      `- ${item.length > 50 ? item.substring(0, 47) + '...' : item}`
                              )
                              .join('\n')
                        : '';
                    markdown += `| **${analysis.area || 'Unknown'}** | ${highAgreement ? highAgreement : 'None identified'} | ${partialAgreement ? partialAgreement : 'None identified'} | ${disagreement ? disagreement : 'None identified'} |\n`;
                } catch (analysisError) {
                    console.error('Error processing agreement analysis:', analysisError);
                    markdown += `| Error processing analysis | - | - | - |\n`;
                }
            });
        } else {
            markdown += `| No agreement analysis available | - | - | - |\n`;
        }

        // Recommendations Priority Matrix
        markdown += '\n## Recommendations Priority Matrix\n\n';

        // Safely handle prioritizedRecommendations
        const prioritizedRecommendations = report.prioritizedRecommendations || {};
        Object.entries(prioritizedRecommendations).forEach(([priority, recommendations]) => {
            try {
                markdown += `### ${priority}\n`;
                if (Array.isArray(recommendations)) {
                    recommendations.forEach((recommendation, index) => {
                        markdown += `${index + 1}. ${recommendation}\n`;
                    });
                } else {
                    markdown += 'No recommendations available.\n';
                }
                markdown += '\n';
            } catch (priorityError) {
                console.error('Error processing priority recommendations:', priorityError);
                markdown += `### Error processing ${priority} recommendations\n\n`;
            }
        });

        return markdown;
    } catch (error) {
        console.error('Error formatting report as markdown:', error);
        // Return a simple markdown report with error information
        return `# Triumvirate Code Review Report

## Error Generating Report

An error occurred while generating the enhanced markdown report: ${error}

### Basic Review Information

Please check the JSON output file for the raw review data.
`;
    }
}
