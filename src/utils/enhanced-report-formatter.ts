// Enhanced report formatter for Triumvirate
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

/**
 * Enhanced format for the report as Markdown
 * Includes improvements to address issues with the current report format:
 * 1. Fixes the Model Agreement Analysis section
 * 2. Adds missing Priority Recommendations
 * 3. Improves Category Extraction
 * 4. Enhances Executive Summary
 * 5. Adds Visual Elements (where possible in markdown)
 * 6. Improves Code Example Formatting
 */
export function enhancedFormatReportAsMarkdown(report: CodeReviewReport): string {
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
                    console.error('Error processing metric:', metricError);
                    markdown += `| Error processing metric | - | - | - | - |\n`;
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

        markdown += `This report presents a comprehensive code review of the ${report.projectName || 'Triumvirate'} codebase conducted by ${Array.isArray(report.models) ? report.models.length : 0} leading language models. `;
        markdown += `The analysis identified ${totalFindings} findings across ${Object.keys(report.findingsByCategory || {}).length} categories, `;
        markdown += `highlighting ${strengths} key strengths and ${improvements} areas for improvement.\n\n`;

        // Add a summary of agreement statistics if available
        if (Array.isArray(report.agreementStatistics) && report.agreementStatistics.length > 0) {
            const allThreeModels = report.agreementStatistics.reduce(
                (sum, stat) => sum + stat.allThreeModels,
                0
            );
            const twoModels = report.agreementStatistics.reduce(
                (sum, stat) => sum + stat.twoModels,
                0
            );
            const oneModel = report.agreementStatistics.reduce(
                (sum, stat) => sum + stat.oneModel,
                0
            );

            markdown += `**Agreement Analysis**: ${allThreeModels} findings had high agreement (all models), ${twoModels} findings had partial agreement (multiple models), and ${oneModel} findings were identified by only one model.\n\n`;
        }

        // Key Strengths
        markdown += '### Key Strengths\n\n';
        markdown += '| Strength | openai | claude | gemini |\n';
        markdown += '|----------|:------:|:------:|:------:|\n';

        // Safely handle keyStrengths
        if (Array.isArray(report.keyStrengths)) {
            report.keyStrengths.forEach(strength => {
                try {
                    // Initialize model checks with proper type
                    const modelChecks: Record<string, string> = {
                        openai: '-',
                        claude: '-',
                        gemini: '-',
                    };

                    // Extract models that identified this strength using modelAgreement
                    if (strength.modelAgreement && strength.modelAgreement.modelAgreements) {
                        Object.entries(strength.modelAgreement.modelAgreements).forEach(
                            ([model, agreed]) => {
                                if (agreed) {
                                    modelChecks[model.toLowerCase()] = '✓';
                                }
                            }
                        );
                    }

                    // Format the strength with model checks
                    markdown += `| **${strength.title}**: ${strength.description} | ${modelChecks['openai'] || '-'} | ${modelChecks['claude'] || '-'} | ${modelChecks['gemini'] || '-'} |\n`;
                } catch (strengthError) {
                    console.error('Error processing strength:', strengthError);
                    markdown += `| Error processing strength | - | - | - |\n`;
                }
            });
        } else {
            markdown += `| No key strengths available | - | - | - |\n`;
        }

        // Key Areas for Improvement
        markdown += '\n### Key Areas for Improvement\n\n';
        markdown += '| Area for Improvement | openai | claude | gemini |\n';
        markdown += '|----------------------|:------:|:------:|:------:|\n';

        // Safely handle keyAreasForImprovement
        if (Array.isArray(report.keyAreasForImprovement)) {
            report.keyAreasForImprovement.forEach(area => {
                try {
                    // Initialize model checks with proper type
                    const modelChecks: Record<string, string> = {
                        openai: '-',
                        claude: '-',
                        gemini: '-',
                    };

                    // Extract models that identified this area using modelAgreement
                    if (area.modelAgreement && area.modelAgreement.modelAgreements) {
                        Object.entries(area.modelAgreement.modelAgreements).forEach(
                            ([model, agreed]) => {
                                if (agreed) {
                                    modelChecks[model.toLowerCase()] = '✓';
                                }
                            }
                        );
                    }

                    // Format the area with model checks
                    markdown += `| **${area.title}**: ${area.description} | ${modelChecks['openai'] || '-'} | ${modelChecks['claude'] || '-'} | ${modelChecks['gemini'] || '-'} |\n`;
                } catch (areaError) {
                    console.error('Error processing area for improvement:', areaError);
                    markdown += `| Error processing area | - | - | - |\n`;
                }
            });
        } else {
            markdown += `| No areas for improvement available | - | - | - |\n`;
        }

        // Add a visual distribution of findings (ASCII-based chart)
        markdown += '\n### Finding Distribution by Category\n\n';
        markdown += '```\n';

        if (report.findingsByCategory) {
            const categories = Object.keys(report.findingsByCategory);
            const maxCount = Math.max(
                ...Object.values(report.findingsByCategory).map(arr => arr.length),
                1
            );
            const chartWidth = 30;

            categories.forEach(category => {
                const categoryFindings = report.findingsByCategory?.[category] || [];
                const count = categoryFindings.length;
                const barLength = Math.round((count / maxCount) * chartWidth);
                const bar = '█'.repeat(barLength);
                markdown += `${category.padEnd(20)} | ${bar} ${count}\n`;
            });
        } else {
            markdown += 'No category data available.\n';
        }

        markdown += '```\n\n';

        // Findings by Category
        markdown += '## Findings by Category\n\n';

        // Safely handle categories and findings
        if (report.categories && report.findingsByCategory) {
            report.categories.forEach(category => {
                try {
                    markdown += `### ${category.name}\n\n`;

                    // Add findings for this category
                    const findings = report.findingsByCategory[category.id];
                    if (Array.isArray(findings) && findings.length > 0) {
                        findings.forEach(finding => {
                            try {
                                markdown += `#### ${finding.title}\n\n`;

                                if (finding.description) {
                                    markdown += `${finding.description}\n\n`;
                                }

                                // Add agreement level
                                let agreementLevel = '';
                                if (
                                    finding.modelAgreement &&
                                    finding.modelAgreement.modelAgreements &&
                                    Object.values(finding.modelAgreement.modelAgreements).filter(
                                        agreed => agreed
                                    ).length === 3
                                ) {
                                    agreementLevel =
                                        '✅ **High Agreement**: All models identified this issue';
                                } else if (
                                    finding.modelAgreement &&
                                    finding.modelAgreement.modelAgreements &&
                                    Object.values(finding.modelAgreement.modelAgreements).filter(
                                        agreed => agreed
                                    ).length === 2
                                ) {
                                    agreementLevel =
                                        '🔶 **Partial Agreement**: Multiple models identified this issue';
                                } else {
                                    agreementLevel =
                                        '⚠️ **Low Agreement**: Only one model identified this issue';
                                }

                                if (agreementLevel) {
                                    markdown += `${agreementLevel}\n\n`;
                                }

                                // Add code example with improved formatting
                                if (finding.codeExample && finding.codeExample.code) {
                                    // Ensure proper indentation and truncate if needed
                                    const { code: exampleCode } = finding.codeExample;
                                    let code = exampleCode;
                                    const lines = code.split('\n');

                                    // Find the minimum indentation level (excluding empty lines)
                                    const nonEmptyLines = lines.filter(
                                        line => line.trim().length > 0
                                    );
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
                                                if (line.trim().length === 0) {
                                                    return '';
                                                }
                                                return line.substring(minIndent);
                                            })
                                            .join('\n');
                                    }

                                    // Truncate very long code examples while preserving critical parts
                                    const maxLines = 20;
                                    if (lines.length > maxLines) {
                                        const firstLines = lines.slice(0, Math.floor(maxLines / 2));
                                        const lastLines = lines.slice(-Math.floor(maxLines / 2));
                                        code = [
                                            ...firstLines,
                                            '// ... truncated ...',
                                            ...lastLines,
                                        ].join('\n');
                                    }

                                    markdown += `\`\`\`${finding.codeExample.language || 'typescript'}\n${code}\n\`\`\`\n\n`;
                                }

                                // Add recommendation
                                if (finding.recommendation) {
                                    markdown += `**Recommendation**: ${finding.recommendation}\n\n`;
                                }

                                markdown += '---\n\n';
                            } catch (findingError) {
                                console.error('Error processing finding:', findingError);
                                markdown += `Error processing finding: ${findingError}\n\n---\n\n`;
                            }
                        });
                    } else {
                        markdown += 'No findings in this category.\n\n';
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

        // Safely handle modelInsights
        if (
            report.modelInsights &&
            Array.isArray(report.modelInsights) &&
            report.modelInsights.length > 0
        ) {
            markdown += '### Unique Insights by Model\n\n';
            markdown += '| Model | Unique Insight | Details |\n';
            markdown += '|-------|----------------|--------|\n';

            report.modelInsights.forEach(insight => {
                try {
                    markdown += `| **${insight.model.name}** | ${insight.insight} | ${insight.details} |\n`;
                } catch (insightError) {
                    console.error('Error processing model insight:', insightError);
                    markdown += `| Error processing insight | - | - |\n`;
                }
            });
        } else {
            markdown += 'No model-specific insights available.\n\n';
        }

        // Enhanced Model Agreement Analysis
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
                    const highAgreement =
                        Array.isArray(analysis.highAgreement) && analysis.highAgreement.length > 0
                            ? `${analysis.highAgreement
                                  .map(item => {
                                      const displayItem =
                                          item.length > 50 ? item.substring(0, 47) + '...' : item;
                                      return `- ${displayItem}`;
                                  })
                                  .join('')}`
                            : '';
                    const partialAgreement =
                        Array.isArray(analysis.partialAgreement) &&
                        analysis.partialAgreement.length > 0
                            ? `${analysis.partialAgreement
                                  .map(item => {
                                      const displayItem =
                                          item.length > 50 ? item.substring(0, 47) + '...' : item;
                                      return `- ${displayItem}`;
                                  })
                                  .join('')}`
                            : '';
                    const disagreement =
                        Array.isArray(analysis.disagreement) && analysis.disagreement.length > 0
                            ? `${analysis.disagreement
                                  .map(item => {
                                      const displayItem =
                                          item.length > 50 ? item.substring(0, 47) + '...' : item;
                                      return `- ${displayItem}`;
                                  })
                                  .join('')}`
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
