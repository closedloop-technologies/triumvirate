/**
 * GitHub PR Comments Utilities
 * Handles posting PR summaries and inline review comments via GitHub API
 */

import { Octokit } from '@octokit/rest';

import type { ReviewFinding, CodeReviewReport } from '../types/report.js';

/**
 * Configuration for GitHub PR comments
 */
export interface GitHubPRConfig {
    token: string;
    owner: string;
    repo: string;
    pullNumber: number;
    commitSha: string;
}

/**
 * Result of posting PR comments
 */
export interface PRCommentResult {
    summaryCommentId?: number;
    inlineCommentsPosted: number;
    inlineCommentsFailed: number;
    errors: string[];
}

/**
 * Inline comment to post on a PR
 */
interface InlineComment {
    path: string;
    line: number;
    body: string;
    side?: 'LEFT' | 'RIGHT';
}

/**
 * Parse GitHub context from environment variables (GitHub Actions)
 */
export async function parseGitHubContext(): Promise<Partial<GitHubPRConfig> | null> {
    const token = process.env['GITHUB_TOKEN'];
    const eventPath = process.env['GITHUB_EVENT_PATH'];
    const repository = process.env['GITHUB_REPOSITORY'];

    if (!token || !repository) {
        return null;
    }

    const [owner, repo] = repository.split('/');

    // Try to get PR number and commit SHA from event payload
    let pullNumber: number | undefined;
    let commitSha: string | undefined;

    if (eventPath) {
        try {
            const fs = await import('fs');
            const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
            pullNumber = event.pull_request?.number;
            commitSha = event.pull_request?.head?.sha || process.env['GITHUB_SHA'];
        } catch {
            // Fall back to environment variables
            commitSha = process.env['GITHUB_SHA'];
        }
    }

    return {
        token,
        owner,
        repo,
        pullNumber,
        commitSha,
    };
}

/**
 * Create an Octokit instance with the provided token
 */
function createOctokit(token: string): Octokit {
    return new Octokit({ auth: token });
}

/**
 * Format a finding as a markdown comment body
 */
function formatFindingAsComment(finding: ReviewFinding): string {
    const agreementModels = Object.entries(finding.modelAgreements)
        .filter(([, agrees]) => agrees)
        .map(([model]) => model);

    const agreementCount = agreementModels.length;
    const agreementEmoji = agreementCount >= 3 ? '🚨' : agreementCount === 2 ? '❗' : '⚠️';
    const agreementLabel =
        agreementCount >= 3
            ? 'High Agreement'
            : agreementCount === 2
              ? 'Partial Agreement'
              : 'Low Agreement';

    let body = `### ${agreementEmoji} ${finding.title}\n\n`;
    body += `**${agreementLabel}** (${agreementModels.join(', ')})\n\n`;
    body += `${finding.description}\n\n`;

    if (finding.recommendation) {
        body += `**Recommendation:** ${finding.recommendation}\n\n`;
    }

    if (finding.codeExample) {
        body += `**Suggested:**\n\`\`\`${finding.codeExample.language}\n${finding.codeExample.code}\n\`\`\`\n`;
    }

    body += `\n---\n*Posted by [Triumvirate](https://github.com/closedloop-technologies/triumvirate)*`;

    return body;
}

/**
 * Generate a PR summary comment from the review report
 */
export function generatePRSummary(report: CodeReviewReport): string {
    const totalFindings = Object.values(report.findingsByCategory || {}).flat().length;
    const strengths = report.keyStrengths?.length || 0;
    const improvements = report.keyAreasForImprovement?.length || 0;

    // Count findings by agreement level
    const allFindings = Object.values(report.findingsByCategory || {}).flat();
    const highAgreement = allFindings.filter(f => {
        const count = Object.values(f.modelAgreements).filter(Boolean).length;
        return count >= 3;
    }).length;
    const partialAgreement = allFindings.filter(f => {
        const count = Object.values(f.modelAgreements).filter(Boolean).length;
        return count === 2;
    }).length;

    let summary = `## 🔍 Triumvirate Code Review Summary\n\n`;
    summary += `| Metric | Count |\n`;
    summary += `|--------|-------|\n`;
    summary += `| Total Findings | ${totalFindings} |\n`;
    summary += `| Key Strengths | ${strengths} |\n`;
    summary += `| Areas for Improvement | ${improvements} |\n`;
    summary += `| 🚨 High Agreement | ${highAgreement} |\n`;
    summary += `| ❗ Partial Agreement | ${partialAgreement} |\n\n`;

    // Key areas for improvement (top 5)
    if (report.keyAreasForImprovement && report.keyAreasForImprovement.length > 0) {
        summary += `### 🎯 Top Issues to Address\n\n`;
        report.keyAreasForImprovement.slice(0, 5).forEach((finding, idx) => {
            const agreementCount = Object.values(finding.modelAgreements).filter(Boolean).length;
            const emoji = agreementCount >= 3 ? '🚨' : agreementCount === 2 ? '❗' : '⚠️';
            summary += `${idx + 1}. ${emoji} **${finding.title}**`;
            if (finding.filePath) {
                summary += ` (\`${finding.filePath}`;
                if (finding.startLine) {
                    summary += `:${finding.startLine}`;
                    if (finding.endLine && finding.endLine !== finding.startLine) {
                        summary += `-${finding.endLine}`;
                    }
                }
                summary += `\`)`;
            }
            summary += `\n`;
        });
        summary += `\n`;
    }

    // Key strengths (top 3)
    if (report.keyStrengths && report.keyStrengths.length > 0) {
        summary += `### ✅ Key Strengths\n\n`;
        report.keyStrengths.slice(0, 3).forEach((finding, idx) => {
            summary += `${idx + 1}. **${finding.title}**\n`;
        });
        summary += `\n`;
    }

    // Model insights
    if (report.modelInsights && report.modelInsights.length > 0) {
        summary += `### 🤖 Model Insights\n\n`;
        report.modelInsights.forEach(insight => {
            summary += `- **${insight.model?.name || 'Unknown'}**: ${insight.insight}\n`;
        });
        summary += `\n`;
    }

    // Cost summary
    if (report.modelMetrics && report.modelMetrics.length > 0) {
        const totalCost = report.modelMetrics.reduce((sum, m) => sum + (m.cost || 0), 0);
        const totalTokens = report.modelMetrics.reduce((sum, m) => sum + (m.totalTokens || 0), 0);
        summary += `### 💰 API Usage\n\n`;
        summary += `- **Total Cost:** $${totalCost.toFixed(4)}\n`;
        summary += `- **Total Tokens:** ${totalTokens.toLocaleString()}\n\n`;
    }

    summary += `---\n`;
    summary += `*Generated by [Triumvirate](https://github.com/closedloop-technologies/triumvirate) - Multi-model AI code reviews with consensus detection*`;

    return summary;
}

/**
 * Post a summary comment on the PR
 */
export async function postPRSummaryComment(
    config: GitHubPRConfig,
    report: CodeReviewReport
): Promise<number | null> {
    const octokit = createOctokit(config.token);
    const summary = generatePRSummary(report);

    try {
        // First, try to find and update an existing Triumvirate comment
        const { data: comments } = await octokit.issues.listComments({
            owner: config.owner,
            repo: config.repo,
            issue_number: config.pullNumber,
        });

        const existingComment = comments.find((c: { body?: string }) =>
            c.body?.includes('Triumvirate Code Review Summary')
        );

        if (existingComment) {
            // Update existing comment
            const { data } = await octokit.issues.updateComment({
                owner: config.owner,
                repo: config.repo,
                comment_id: existingComment.id,
                body: summary,
            });
            return data.id;
        } else {
            // Create new comment
            const { data } = await octokit.issues.createComment({
                owner: config.owner,
                repo: config.repo,
                issue_number: config.pullNumber,
                body: summary,
            });
            return data.id;
        }
    } catch (error) {
        console.error('Failed to post PR summary comment:', error);
        return null;
    }
}

/**
 * Post inline review comments on the PR
 */
export async function postInlineComments(
    config: GitHubPRConfig,
    findings: ReviewFinding[]
): Promise<{ posted: number; failed: number; errors: string[] }> {
    const octokit = createOctokit(config.token);
    const errors: string[] = [];
    let posted = 0;
    let failed = 0;

    // Filter findings that have file path and line number
    const inlineFindings = findings.filter(f => f.filePath && f.startLine && !f.isStrength);

    if (inlineFindings.length === 0) {
        return { posted: 0, failed: 0, errors: [] };
    }

    // Prepare inline comments
    const comments: InlineComment[] = inlineFindings.map(finding => ({
        path: finding.filePath!,
        line: finding.startLine!,
        body: formatFindingAsComment(finding),
        side: 'RIGHT' as const,
    }));

    // Post as a review with multiple comments
    try {
        await octokit.pulls.createReview({
            owner: config.owner,
            repo: config.repo,
            pull_number: config.pullNumber,
            commit_id: config.commitSha,
            event: 'COMMENT',
            comments: comments.map(c => ({
                path: c.path,
                line: c.line,
                body: c.body,
                side: c.side,
            })),
        });
        posted = comments.length;
    } catch {
        // If batch fails, try posting individually
        console.warn('Batch review comment failed, trying individual comments...');

        for (const comment of comments) {
            try {
                await octokit.pulls.createReviewComment({
                    owner: config.owner,
                    repo: config.repo,
                    pull_number: config.pullNumber,
                    commit_id: config.commitSha,
                    path: comment.path,
                    line: comment.line,
                    body: comment.body,
                    side: comment.side,
                });
                posted++;
            } catch (err) {
                failed++;
                const errorMsg = err instanceof Error ? err.message : String(err);
                errors.push(
                    `Failed to post comment on ${comment.path}:${comment.line}: ${errorMsg}`
                );
            }
        }
    }

    return { posted, failed, errors };
}

/**
 * Post all PR comments (summary + inline)
 */
export async function postPRComments(
    config: GitHubPRConfig,
    report: CodeReviewReport
): Promise<PRCommentResult> {
    const result: PRCommentResult = {
        inlineCommentsPosted: 0,
        inlineCommentsFailed: 0,
        errors: [],
    };

    // Post summary comment
    const summaryId = await postPRSummaryComment(config, report);
    if (summaryId) {
        result.summaryCommentId = summaryId;
    } else {
        result.errors.push('Failed to post PR summary comment');
    }

    // Collect all findings for inline comments
    const allFindings = Object.values(report.findingsByCategory || {}).flat();

    // Post inline comments
    const inlineResult = await postInlineComments(config, allFindings);
    result.inlineCommentsPosted = inlineResult.posted;
    result.inlineCommentsFailed = inlineResult.failed;
    result.errors.push(...inlineResult.errors);

    return result;
}

/**
 * Check if we're running in a GitHub Actions environment with PR context
 */
export function isGitHubActionsWithPR(): boolean {
    return !!(
        process.env['GITHUB_ACTIONS'] &&
        process.env['GITHUB_TOKEN'] &&
        process.env['GITHUB_EVENT_NAME'] === 'pull_request'
    );
}
