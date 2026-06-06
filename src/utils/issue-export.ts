import type { CodeReviewReport, ReviewFinding } from '../types/report.js';

export interface IssueExportOptions {
    owner?: string;
    repo?: string;
    jiraProjectKey?: string;
    sourceReportPath?: string;
    maxIssues?: number;
}

export interface ExportedIssue {
    title: string;
    body: string;
    labels: string[];
    source: {
        projectName: string;
        reviewDate: string;
        category: string;
        filePath?: string;
        startLine?: number;
        endLine?: number;
        agreements: string[];
    };
}

export interface JiraIssueExport {
    fields: {
        project: { key: string };
        summary: string;
        description: string;
        issuetype: { name: 'Task' };
        labels: string[];
    };
    source: ExportedIssue['source'];
}

export interface IssueExportBundle {
    schema_version: 1;
    status: 'Pending human, prework completed';
    remote_side_effect_allowed: false;
    human_approval_required: true;
    source_report_path: string | null;
    target: {
        github_repository: string | null;
        jira_project_key: string | null;
    };
    github_issues: ExportedIssue[];
    jira_issues: JiraIssueExport[];
    approval_gate: {
        required_before_remote_create: string[];
        rollback_note: string;
    };
}

const SECRET_PATTERNS = [
    /api[_-]?key\s*[:=]\s*\S+/i,
    /authorization\s*[:=]\s*bearer\s+\S+/i,
    /password\s*[:=]\s*\S+/i,
    /token\s*[:=]\s*\S+/i,
];

function sanitizeText(text: string | undefined): string {
    if (!text) {
        return '';
    }
    return SECRET_PATTERNS.reduce(
        (value, pattern) => value.replace(pattern, '[REDACTED]'),
        text
    ).trim();
}

function slugLabel(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 48);
}

function agreementLabels(finding: ReviewFinding): string[] {
    return Object.entries(finding.modelAgreements ?? {})
        .filter(([, agreed]) => Boolean(agreed))
        .map(([model]) => model);
}

function findingPriorityLabel(finding: ReviewFinding): string {
    const agreements = agreementLabels(finding).length;
    if (agreements >= 3) {
        return 'triage-high-agreement';
    }
    if (agreements === 2) {
        return 'triage-partial-agreement';
    }
    return 'triage-single-model';
}

function issueBody(report: CodeReviewReport, finding: ReviewFinding): string {
    const location =
        finding.filePath && finding.startLine
            ? `${finding.filePath}:${finding.startLine}${finding.endLine ? `-${finding.endLine}` : ''}`
            : 'No file location recorded';
    const agreements = agreementLabels(finding);
    const recommendation = sanitizeText(finding.recommendation) || 'No recommendation recorded.';
    const codeExample = finding.codeExample?.code
        ? `\n\nCode example:\n\n\`\`\`${finding.codeExample.language || ''}\n${sanitizeText(finding.codeExample.code)}\n\`\`\``
        : '';

    return [
        'Status: Pending human, prework completed',
        '',
        `Review: ${sanitizeText(report.projectName)} on ${sanitizeText(report.reviewDate)}`,
        `Category: ${sanitizeText(finding.category.name)}`,
        `Location: ${location}`,
        `Model agreement: ${agreements.length ? agreements.join(', ') : 'none recorded'}`,
        '',
        'Description:',
        sanitizeText(finding.description) || 'No description recorded.',
        '',
        'Recommendation:',
        recommendation,
        codeExample,
        '',
        'Human approval gate:',
        '- Confirm target repository or Jira project.',
        '- Confirm issue text is public-safe and contains no secrets.',
        '- Confirm duplicate issue search is complete.',
        '- Confirm rollback action if remote creation is mistaken.',
    ]
        .filter(Boolean)
        .join('\n');
}

function toGithubIssue(report: CodeReviewReport, finding: ReviewFinding): ExportedIssue {
    const category = sanitizeText(finding.category.name);
    const agreements = agreementLabels(finding);

    return {
        title: sanitizeText(finding.title),
        body: issueBody(report, finding),
        labels: [
            'triumvirate-export',
            'pending-human-approval',
            slugLabel(category),
            findingPriorityLabel(finding),
        ],
        source: {
            projectName: sanitizeText(report.projectName),
            reviewDate: sanitizeText(report.reviewDate),
            category,
            filePath: finding.filePath,
            startLine: finding.startLine,
            endLine: finding.endLine,
            agreements,
        },
    };
}

function toJiraIssue(issue: ExportedIssue, jiraProjectKey: string): JiraIssueExport {
    return {
        fields: {
            project: { key: jiraProjectKey },
            summary: issue.title,
            description: issue.body,
            issuetype: { name: 'Task' },
            labels: issue.labels,
        },
        source: issue.source,
    };
}

export function exportReviewIssues(
    report: CodeReviewReport,
    options: IssueExportOptions = {}
): IssueExportBundle {
    const maxIssues = options.maxIssues ?? 20;
    const findings = Object.values(report.findingsByCategory ?? {})
        .flat()
        .filter(finding => !finding.isStrength)
        .slice(0, maxIssues);
    const githubIssues = findings.map(finding => toGithubIssue(report, finding));
    const jiraProjectKey = options.jiraProjectKey?.trim() || null;

    return {
        schema_version: 1,
        status: 'Pending human, prework completed',
        remote_side_effect_allowed: false,
        human_approval_required: true,
        source_report_path: options.sourceReportPath ?? null,
        target: {
            github_repository:
                options.owner && options.repo ? `${options.owner}/${options.repo}` : null,
            jira_project_key: jiraProjectKey,
        },
        github_issues: githubIssues,
        jira_issues: jiraProjectKey
            ? githubIssues.map(issue => toJiraIssue(issue, jiraProjectKey))
            : [],
        approval_gate: {
            required_before_remote_create: [
                'human selects target tracker',
                'human approves exported issue text',
                'duplicate issue search is recorded',
                'public-safe and no-secrets review passes',
                'rollback or close-note is prepared',
            ],
            rollback_note:
                'If a remote issue is created by mistake, close it with a correction note and preserve this export packet as evidence.',
        },
    };
}
