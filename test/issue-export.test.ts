import { describe, expect, it } from 'vitest';

import type { CodeReviewReport, ReviewCategory, ReviewFinding } from '../src/types/report.js';
import { exportReviewIssues } from '../src/utils/issue-export.js';

const category: ReviewCategory = {
    name: 'Security',
    description: 'Security issues',
};

function finding(overrides: Partial<ReviewFinding> = {}): ReviewFinding {
    return {
        title: 'Unsafe token logging',
        description: 'The code logs token=abc123 in debug output.',
        category,
        modelAgreements: { openai: true, claude: true, gemini: false },
        recommendation: 'Remove password=hunter2 from logs before release.',
        isStrength: false,
        filePath: 'src/logger.ts',
        startLine: 12,
        endLine: 18,
        ...overrides,
    };
}

function report(findings: ReviewFinding[]): CodeReviewReport {
    return {
        projectName: 'Example Project',
        reviewDate: '2026-06-06',
        categories: [category],
        models: [],
        modelMetrics: [],
        keyStrengths: [],
        keyAreasForImprovement: findings,
        findingsByCategory: { Security: findings },
        modelInsights: [],
        agreementAnalysis: [],
        agreementStatistics: [],
    };
}

describe('exportReviewIssues', () => {
    it('exports GitHub and Jira-shaped payloads without allowing remote side effects', () => {
        const bundle = exportReviewIssues(report([finding()]), {
            owner: 'closedloop-technologies',
            repo: 'triumvirate',
            jiraProjectKey: 'TRI',
            sourceReportPath: 'reports/review.json',
        });

        expect(bundle.status).toBe('Pending human, prework completed');
        expect(bundle.remote_side_effect_allowed).toBe(false);
        expect(bundle.human_approval_required).toBe(true);
        expect(bundle.target.github_repository).toBe('closedloop-technologies/triumvirate');
        expect(bundle.github_issues).toHaveLength(1);
        expect(bundle.jira_issues).toHaveLength(1);
        expect(bundle.github_issues[0].labels).toContain('pending-human-approval');
        expect(bundle.github_issues[0].labels).toContain('triage-partial-agreement');
        expect(bundle.jira_issues[0].fields.project.key).toBe('TRI');
    });

    it('filters strengths and limits exported issue count', () => {
        const bundle = exportReviewIssues(
            report([
                finding({ title: 'Problem one' }),
                finding({ title: 'Strength', isStrength: true }),
                finding({ title: 'Problem two' }),
            ]),
            { maxIssues: 1 }
        );

        expect(bundle.github_issues).toHaveLength(1);
        expect(bundle.github_issues[0].title).toBe('Problem one');
    });

    it('redacts secret-like text from exported issue bodies', () => {
        const bundle = exportReviewIssues(report([finding()]));
        const body = bundle.github_issues[0].body;

        expect(body).toContain('[REDACTED]');
        expect(body).not.toContain('abc123');
        expect(body).not.toContain('hunter2');
    });
});
