/**
 * Smart Compression Module
 * 
 * Uses an LLM agent to intelligently select which files to include
 * when the codebase exceeds the token limit.
 */

import { recommendCompressionWithBAML } from './baml-providers.js';

export interface RepoOverview {
    directoryStructure: string;
    fileSummary: string;
    totalTokens: number;
    fileTokenCounts: Record<string, number>;
}

export interface CompressionRecommendation {
    includePatterns: string[];
    excludePatterns: string[];
    useCompression: boolean;
    removeComments: boolean;
    reasoning: string;
}

/**
 * Ask an LLM agent to recommend compression settings based on repo structure and task
 */
export async function getCompressionRecommendation(
    overview: RepoOverview,
    task: string,
    tokenLimit: number,
    _agentModel: string = 'claude' // Kept for API compatibility, BAML handles model selection
): Promise<CompressionRecommendation> {
    try {
        // Build file token counts string for BAML
        const fileList = Object.entries(overview.fileTokenCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 50)
            .map(([file, tokens]) => `  ${file}: ${tokens} tokens`)
            .join('\n');

        // Use BAML for structured compression recommendation
        const response = await recommendCompressionWithBAML(
            overview.directoryStructure,
            fileList,
            overview.totalTokens,
            tokenLimit,
            task || 'General code review'
        );

        const recommendation = response.data;
        
        // Validate and sanitize
        return {
            includePatterns: Array.isArray(recommendation.includePatterns) 
                ? recommendation.includePatterns 
                : [],
            excludePatterns: Array.isArray(recommendation.excludePatterns) 
                ? recommendation.excludePatterns 
                : [],
            useCompression: Boolean(recommendation.useCompression),
            removeComments: Boolean(recommendation.removeComments),
            reasoning: recommendation.reasoning || 'No reasoning provided',
        };
    } catch (error) {
        console.warn('Agent compression recommendation failed:', error);
        return getDefaultRecommendation(overview, tokenLimit);
    }
}

/**
 * Default recommendation when agent fails
 */
function getDefaultRecommendation(
    overview: RepoOverview,
    tokenLimit: number
): CompressionRecommendation {
    const excludePatterns: string[] = [];
    
    // Start with common large files to exclude
    const defaultExcludes = [
        'package-lock.json',
        'yarn.lock',
        'pnpm-lock.yaml',
        '*.min.js',
        '*.min.css',
        'dist/**',
        'build/**',
        '.git/**',
    ];

    // If we need significant reduction, exclude more
    const reductionNeeded = overview.totalTokens - tokenLimit;
    const reductionPercent = reductionNeeded / overview.totalTokens;

    if (reductionPercent > 0.3) {
        // Need >30% reduction - exclude tests and docs
        excludePatterns.push('test/**', 'tests/**', '__tests__/**', '*.test.*', '*.spec.*');
        excludePatterns.push('docs/**', '*.md');
    }

    if (reductionPercent > 0.5) {
        // Need >50% reduction - also exclude config files
        excludePatterns.push('*.json', '*.yaml', '*.yml', '*.toml');
    }

    return {
        includePatterns: [],
        excludePatterns: [...defaultExcludes, ...excludePatterns],
        useCompression: reductionPercent > 0.2,
        removeComments: reductionPercent > 0.4,
        reasoning: `Default compression: ${Math.round(reductionPercent * 100)}% reduction needed`,
    };
}
