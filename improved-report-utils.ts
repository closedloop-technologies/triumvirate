// This file contains improved report generation utilities for Triumvirate
// It addresses the issues with the current report format:
// 1. Fixes the Model Agreement Analysis section
// 2. Adds missing Priority Recommendations
// 3. Improves Category Extraction
// 4. Enhances Executive Summary
// 5. Adds Visual Elements (where possible in markdown)
// 6. Improves Code Example Formatting

// Function to enhance the model agreement analysis section
export function enhanceModelAgreementSection(markdown, report) {
    markdown += '\n### Model Agreement Analysis\n\n';
    markdown += '> **High Agreement**: All models identified this issue  \n';
    markdown += '> **Partial Agreement**: Multiple models identified this issue  \n';
    markdown += '> **Disagreement**: Only one model identified this issue\n\n';

    markdown += '| Area | High Agreement | Partial Agreement | Disagreement |\n';
    markdown += '|------|----------------|-------------------|-------------|\n';

    // Safely handle agreementAnalysis
    if (Array.isArray(report.agreementAnalysis)) {
        report.agreementAnalysis.forEach(analysis => {
            try {
                const highAgreement = Array.isArray(analysis.highAgreement)
                    ? analysis.highAgreement
                          .map(
                              item => `- ${item.length > 50 ? item.substring(0, 47) + '...' : item}`
                          )
                          .join('\n')
                    : '';
                const partialAgreement = Array.isArray(analysis.partialAgreement)
                    ? analysis.partialAgreement
                          .map(
                              item => `- ${item.length > 50 ? item.substring(0, 47) + '...' : item}`
                          )
                          .join('\n')
                    : '';
                const disagreement = Array.isArray(analysis.disagreement)
                    ? analysis.disagreement
                          .map(
                              item => `- ${item.length > 50 ? item.substring(0, 47) + '...' : item}`
                          )
                          .join('\n')
                    : '';
                markdown += `| **${analysis.area || 'Unknown'}** | ${highAgreement || 'None identified'} | ${partialAgreement || 'None identified'} | ${disagreement || 'None identified'} |\n`;
            } catch (analysisError) {
                console.error('Error processing agreement analysis:', analysisError);
                markdown += `| Error processing analysis | - | - | - |\n`;
            }
        });
    } else {
        markdown += `| No agreement analysis available | - | - | - |\n`;
    }

    return markdown;
}

// Function to enhance the executive summary section
export function enhanceExecutiveSummary(markdown, report) {
    markdown += '\n## Executive Summary\n\n';

    // Add a comprehensive summary paragraph
    const totalFindings = Object.values(report.findingsByCategory || {}).flat().length;
    const strengths = (report.keyStrengths || []).length;
    const improvements = (report.keyAreasForImprovement || []).length;

    markdown += `This report presents a comprehensive code review of the ${report.projectName || 'Triumvirate'} codebase conducted by ${Array.isArray(report.models) ? report.models.length : 0} leading language models. `;
    markdown += `The analysis identified ${totalFindings} findings across ${Object.keys(report.findingsByCategory || {}).length} categories, `;
    markdown += `highlighting ${strengths} key strengths and ${improvements} areas for improvement.\n\n`;

    // Add a summary of agreement statistics if available
    if (Array.isArray(report.agreementStatistics) && report.agreementStatistics.length > 0) {
        const allThreeModels = report.agreementStatistics.reduce(
            (sum, stat) => sum + stat.allThreeModels,
            0
        );
        const twoModels = report.agreementStatistics.reduce((sum, stat) => sum + stat.twoModels, 0);
        const oneModel = report.agreementStatistics.reduce((sum, stat) => sum + stat.oneModel, 0);

        markdown += `**Agreement Analysis**: ${allThreeModels} findings had high agreement (all models), `;
        markdown += `${twoModels} findings had partial agreement (multiple models), and `;
        markdown += `${oneModel} findings were identified by only one model.\n\n`;
    }

    // Add a visual distribution of findings (ASCII-based chart)
    markdown += '```\nDistribution of Findings by Category:\n';

    if (report.findingsByCategory) {
        const categories = Object.keys(report.findingsByCategory);
        const maxCount = Math.max(
            ...Object.values(report.findingsByCategory).map(arr => arr.length)
        );
        const chartWidth = 40;

        categories.forEach(category => {
            const count = report.findingsByCategory[category].length;
            const barLength = Math.round((count / maxCount) * chartWidth);
            const bar = '█'.repeat(barLength);
            markdown += `${category.padEnd(20)} | ${bar} ${count}\n`;
        });
    }

    markdown += '```\n\n';

    return markdown;
}

// Function to enhance the recommendations priority matrix
export function enhanceRecommendationsPriorityMatrix(markdown, report) {
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
            } else {
                // Add fallback recommendations based on findings if no recommendations are available
                if (
                    priority === 'High Priority' &&
                    Array.isArray(report.keyAreasForImprovement) &&
                    report.keyAreasForImprovement.length > 0
                ) {
                    report.keyAreasForImprovement.slice(0, 2).forEach((area, index) => {
                        if (area.recommendation) {
                            markdown += `${index + 1}. ${area.recommendation}\n`;
                        }
                    });
                } else {
                    markdown += 'No recommendations available.\n';
                }
            }
            markdown += '\n';
        } catch (priorityError) {
            console.error('Error processing priority recommendations:', priorityError);
            markdown += `### Error processing ${priority} recommendations\n\n`;
        }
    });

    return markdown;
}

// Function to improve code example formatting
export function improveCodeExampleFormatting(codeExample) {
    if (!codeExample || !codeExample.code) {
        return codeExample;
    }

    // Ensure proper indentation
    let code = codeExample.code;
    const lines = code.split('\n');

    // Find the minimum indentation level (excluding empty lines)
    const nonEmptyLines = lines.filter(line => line.trim().length > 0);
    const minIndent = Math.min(
        ...nonEmptyLines.map(line => {
            const match = line.match(/^\s*/);
            return match ? match[0].length : 0;
        })
    );

    // Remove the common indentation
    if (minIndent > 0) {
        code = lines
            .map(line => {
                if (line.trim().length === 0) return '';
                return line.substring(minIndent);
            })
            .join('\n');
    }

    // Truncate very long code examples while preserving critical parts
    const maxLines = 20;
    if (lines.length > maxLines) {
        const firstLines = lines.slice(0, Math.floor(maxLines / 2));
        const lastLines = lines.slice(-Math.floor(maxLines / 2));
        code = [...firstLines, '// ... truncated ...', ...lastLines].join('\n');
    }

    return {
        code,
        language: codeExample.language || 'typescript',
    };
}

// Function to enhance category extraction with Claude
export async function enhanceCategoryExtraction(reviews) {
    const prompt = `
I need you to analyze these code review outputs from different models and extract the main categories discussed.
Please identify 6-10 distinct categories that cover the major topics across all reviews.

For each category, provide:
1. A concise name (e.g., "Code Quality", "Security", "Performance")
2. A short 1-2 sentence description of what this category encompasses

Make sure to include these standard categories if they are relevant:
- Code Quality: Code style, readability, maintainability, and adherence to best practices
- Documentation: Comments, inline documentation, README files, and other documentation
- Error Handling: How errors and edge cases are managed in the code
- Security: Potential security vulnerabilities and security best practices
- Performance: Code efficiency, optimization opportunities, and resource usage
- Architecture: Overall code structure, design patterns, and organization
- Testing: Test coverage, test quality, and testing practices

${reviews.map((review, index) => `MODEL ${index + 1} REVIEW:\n${review}`).join('\n\n')}
`;

    // The rest of the implementation would be similar to the existing extractCategoriesWithClaude function
    // This is just a template for how the prompt should be enhanced
    return [];
}

// Function to enhance findings extraction with Claude
export async function enhanceFindingsExtraction(reviews, categories, models) {
    const prompt = `
I need you to analyze these code review outputs and extract specific findings.
For each finding:
1. Write a clear, concise title (max 10 words)
2. Provide a detailed description (1-2 sentences)
3. Assign to exactly one category from the list
4. Determine if it's a strength or area for improvement
5. Specify which models mentioned it
6. Extract any relevant code examples
7. Formulate a specific, actionable recommendation

Be specific and consistent in your categorization.

Categories:
${categories.map(c => `- ${c.name}: ${c.shortDescription}`).join('\n')}

Reviews:
${reviews.map((review, i) => `MODEL ${models[i]?.name || i + 1}:\n${review}`).join('\n\n')}
`;

    // The rest of the implementation would be similar to the existing extractFindingsWithClaude function
    // This is just a template for how the prompt should be enhanced
    return [];
}
