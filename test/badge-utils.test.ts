import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import type { CodeReviewReport, ReviewFinding } from '../src/types/report.js';
import {
    determineBadgeStatus,
    generateBadgeUrl,
    generateBadgeFromReport,
    updateReadmeBadge,
    findReadme,
    type BadgeStatus,
} from '../src/utils/badge-utils.js';

// Helper to create a mock finding
function createMockFinding(
    title: string,
    isStrength: boolean,
    agreementCount: number
): ReviewFinding {
    const modelAgreements: Record<string, boolean> = {};
    const models = ['openai', 'claude', 'gemini'];
    for (let i = 0; i < agreementCount && i < models.length; i++) {
        modelAgreements[models[i]] = true;
    }
    for (let i = agreementCount; i < models.length; i++) {
        modelAgreements[models[i]] = false;
    }

    return {
        title,
        description: `Description for ${title}`,
        category: { name: 'Test Category', description: 'Test' },
        modelAgreements,
        isStrength,
    };
}

// Helper to create a mock report
function createMockReport(findings: ReviewFinding[]): CodeReviewReport {
    return {
        projectName: 'Test Project',
        reviewDate: new Date().toISOString(),
        categories: [{ name: 'Test Category', description: 'Test' }],
        models: [
            { id: 'openai', name: 'OpenAI' },
            { id: 'claude', name: 'Claude' },
            { id: 'gemini', name: 'Gemini' },
        ],
        modelMetrics: [],
        keyStrengths: findings.filter(f => f.isStrength),
        keyAreasForImprovement: findings.filter(f => !f.isStrength),
        findingsByCategory: {
            'Test Category': findings,
        },
        modelInsights: [],
        agreementAnalysis: [],
        agreementStatistics: [],
    };
}

describe('badge-utils', () => {
    describe('determineBadgeStatus', () => {
        it('should return "passed" when there are no improvement findings', () => {
            const report = createMockReport([createMockFinding('Strength 1', true, 3)]);
            expect(determineBadgeStatus(report)).toBe('passed');
        });

        it('should return "passed" when only low-agreement improvements exist', () => {
            const report = createMockReport([
                createMockFinding('Strength 1', true, 3),
                createMockFinding('Minor Issue', false, 1), // Only 1 model agrees
            ]);
            expect(determineBadgeStatus(report)).toBe('passed');
        });

        it('should return "warnings" when partial-agreement improvements exist', () => {
            const report = createMockReport([
                createMockFinding('Strength 1', true, 3),
                createMockFinding('Partial Issue', false, 2), // 2 models agree
            ]);
            expect(determineBadgeStatus(report)).toBe('warnings');
        });

        it('should return "failed" when high-agreement improvements exist', () => {
            const report = createMockReport([
                createMockFinding('Strength 1', true, 3),
                createMockFinding('Critical Issue', false, 3), // All 3 models agree
            ]);
            expect(determineBadgeStatus(report)).toBe('failed');
        });

        it('should prioritize "failed" over "warnings"', () => {
            const report = createMockReport([
                createMockFinding('Partial Issue', false, 2),
                createMockFinding('Critical Issue', false, 3),
            ]);
            expect(determineBadgeStatus(report)).toBe('failed');
        });
    });

    describe('generateBadgeUrl', () => {
        it('should generate correct URL for passed status', () => {
            const url = generateBadgeUrl('passed');
            expect(url).toContain('img.shields.io');
            expect(url).toContain('Triumvirate');
            expect(url).toContain('Passed');
            expect(url).toContain('brightgreen');
        });

        it('should generate correct URL for warnings status', () => {
            const url = generateBadgeUrl('warnings');
            expect(url).toContain('Warnings');
            expect(url).toContain('yellow');
        });

        it('should generate correct URL for failed status', () => {
            const url = generateBadgeUrl('failed');
            expect(url).toContain('Issues%20Found');
            expect(url).toContain('red');
        });

        it('should respect custom label', () => {
            const url = generateBadgeUrl('passed', { label: 'Code Review' });
            expect(url).toContain('Code%20Review');
        });

        it('should respect custom style', () => {
            const url = generateBadgeUrl('passed', { style: 'for-the-badge' });
            expect(url).toContain('style=for-the-badge');
        });
    });

    describe('generateBadgeFromReport', () => {
        it('should generate badge result with correct properties', () => {
            const report = createMockReport([
                createMockFinding('Strength 1', true, 3),
                createMockFinding('Issue 1', false, 2),
            ]);

            const result = generateBadgeFromReport(report);

            expect(result.status).toBe('warnings');
            expect(result.url).toContain('img.shields.io');
            expect(result.markdown).toMatch(/!\[Triumvirate\]\(https:\/\/img\.shields\.io/);
            expect(result.summary).toContain('1 strengths');
            expect(result.summary).toContain('1 improvements');
        });
    });

    describe('updateReadmeBadge', () => {
        let tempDir: string;
        let readmePath: string;

        beforeEach(() => {
            tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'badge-test-'));
            readmePath = path.join(tempDir, 'README.md');
        });

        afterEach(() => {
            fs.rmSync(tempDir, { recursive: true, force: true });
        });

        it('should insert badge after first heading when no markers exist', () => {
            fs.writeFileSync(readmePath, '# My Project\n\nSome content here.');

            const badgeResult = {
                status: 'passed' as BadgeStatus,
                url: 'https://img.shields.io/badge/test',
                markdown: '![Triumvirate](https://img.shields.io/badge/test)',
                summary: 'test summary',
            };

            const updated = updateReadmeBadge(readmePath, badgeResult);
            expect(updated).toBe(true);

            const content = fs.readFileSync(readmePath, 'utf-8');
            expect(content).toContain('<!-- triumvirate-badge-start -->');
            expect(content).toContain('<!-- triumvirate-badge-end -->');
            expect(content).toContain('![Triumvirate]');
            // Badge should be after the heading
            expect(content.indexOf('# My Project')).toBeLessThan(
                content.indexOf('<!-- triumvirate-badge-start -->')
            );
        });

        it('should replace existing badge when markers exist', () => {
            const initialContent = `# My Project

<!-- triumvirate-badge-start -->
![Triumvirate](https://img.shields.io/badge/old)
<!-- triumvirate-badge-end -->

Some content here.`;

            fs.writeFileSync(readmePath, initialContent);

            const badgeResult = {
                status: 'failed' as BadgeStatus,
                url: 'https://img.shields.io/badge/new',
                markdown: '![Triumvirate](https://img.shields.io/badge/new)',
                summary: 'new summary',
            };

            const updated = updateReadmeBadge(readmePath, badgeResult);
            expect(updated).toBe(true);

            const content = fs.readFileSync(readmePath, 'utf-8');
            expect(content).toContain('badge/new');
            expect(content).not.toContain('badge/old');
            // Should only have one set of markers
            expect(content.match(/<!-- triumvirate-badge-start -->/g)?.length).toBe(1);
        });

        it('should return false when README does not exist', () => {
            const result = updateReadmeBadge('/nonexistent/path/README.md', {
                status: 'passed',
                url: 'test',
                markdown: 'test',
                summary: 'test',
            });
            expect(result).toBe(false);
        });
    });

    describe('findReadme', () => {
        let tempDir: string;

        beforeEach(() => {
            tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'readme-test-'));
        });

        afterEach(() => {
            fs.rmSync(tempDir, { recursive: true, force: true });
        });

        it('should find README.md', () => {
            fs.writeFileSync(path.join(tempDir, 'README.md'), '# Test');
            const result = findReadme(tempDir);
            expect(result).toBe(path.join(tempDir, 'README.md'));
        });

        it('should find readme.md (lowercase)', () => {
            fs.writeFileSync(path.join(tempDir, 'readme.md'), '# Test');
            const result = findReadme(tempDir);
            expect(result).toBe(path.join(tempDir, 'readme.md'));
        });

        it('should return null when no README exists', () => {
            const result = findReadme(tempDir);
            expect(result).toBeNull();
        });
    });
});
