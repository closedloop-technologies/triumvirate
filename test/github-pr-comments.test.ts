/**
 * Tests for GitHub PR Comments functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { CodeReviewReport } from '../src/types/report.js';
import { generatePRSummary, isGitHubActionsWithPR } from '../src/utils/github-pr-comments.js';

describe('GitHub PR Comments', () => {
    describe('generatePRSummary', () => {
        it('should generate a markdown summary from a report', () => {
            const mockReport: CodeReviewReport = {
                projectName: 'test-project',
                reviewDate: '2024-01-15',
                categories: [
                    { name: 'Security', description: 'Security issues' },
                    { name: 'Performance', description: 'Performance issues' },
                ],
                models: [
                    { id: 'openai', name: 'OpenAI GPT-4' },
                    { id: 'claude', name: 'Claude 3' },
                    { id: 'gemini', name: 'Gemini Pro' },
                ],
                modelMetrics: [
                    {
                        model: { id: 'openai', name: 'OpenAI GPT-4' },
                        status: 'completed',
                        latencyMs: 1000,
                        cost: 0.05,
                        totalTokens: 5000,
                        costPer1kTokens: 0.01,
                    },
                ],
                keyStrengths: [
                    {
                        title: 'Good error handling',
                        description: 'Consistent error handling patterns',
                        category: { name: 'Code Quality', description: '' },
                        modelAgreements: {
                            'OpenAI GPT-4': true,
                            'Claude 3': true,
                            'Gemini Pro': true,
                        },
                        isStrength: true,
                    },
                ],
                keyAreasForImprovement: [
                    {
                        title: 'Missing input validation',
                        description: 'User inputs are not validated',
                        category: { name: 'Security', description: '' },
                        modelAgreements: {
                            'OpenAI GPT-4': true,
                            'Claude 3': true,
                            'Gemini Pro': true,
                        },
                        isStrength: false,
                        filePath: 'src/api/handlers.ts',
                        startLine: 42,
                    },
                ],
                findingsByCategory: {
                    Security: [
                        {
                            title: 'Missing input validation',
                            description: 'User inputs are not validated',
                            category: { name: 'Security', description: '' },
                            modelAgreements: {
                                'OpenAI GPT-4': true,
                                'Claude 3': true,
                                'Gemini Pro': true,
                            },
                            isStrength: false,
                            filePath: 'src/api/handlers.ts',
                            startLine: 42,
                        },
                    ],
                },
                modelInsights: [
                    {
                        model: { id: 'openai', name: 'OpenAI GPT-4' },
                        insight: 'Focused on security patterns',
                        details: 'Detailed security analysis',
                    },
                ],
                agreementAnalysis: [],
                agreementStatistics: [],
            };

            const summary = generatePRSummary(mockReport);

            // Check that summary contains expected sections
            expect(summary).toContain('Triumvirate Code Review Summary');
            expect(summary).toContain('Total Findings');
            expect(summary).toContain('Key Strengths');
            expect(summary).toContain('Top Issues to Address');
            expect(summary).toContain('Missing input validation');
            expect(summary).toContain('src/api/handlers.ts:42');
            expect(summary).toContain('Good error handling');
            expect(summary).toContain('API Usage');
            expect(summary).toContain('$0.05');
        });

        it('should handle empty report gracefully', () => {
            const emptyReport: CodeReviewReport = {
                projectName: 'empty-project',
                reviewDate: '2024-01-15',
                categories: [],
                models: [],
                modelMetrics: [],
                keyStrengths: [],
                keyAreasForImprovement: [],
                findingsByCategory: {},
                modelInsights: [],
                agreementAnalysis: [],
                agreementStatistics: [],
            };

            const summary = generatePRSummary(emptyReport);

            expect(summary).toContain('Triumvirate Code Review Summary');
            expect(summary).toContain('Total Findings | 0');
        });

        it('should show agreement emojis correctly', () => {
            const report: CodeReviewReport = {
                projectName: 'test',
                reviewDate: '2024-01-15',
                categories: [],
                models: [],
                modelMetrics: [],
                keyStrengths: [],
                keyAreasForImprovement: [
                    {
                        title: 'High agreement issue',
                        description: 'All models agree',
                        category: { name: 'Test', description: '' },
                        modelAgreements: { model1: true, model2: true, model3: true },
                        isStrength: false,
                    },
                    {
                        title: 'Partial agreement issue',
                        description: 'Two models agree',
                        category: { name: 'Test', description: '' },
                        modelAgreements: { model1: true, model2: true, model3: false },
                        isStrength: false,
                    },
                ],
                findingsByCategory: {},
                modelInsights: [],
                agreementAnalysis: [],
                agreementStatistics: [],
            };

            const summary = generatePRSummary(report);

            expect(summary).toContain('🚨'); // High agreement
            expect(summary).toContain('❗'); // Partial agreement
        });
    });

    describe('isGitHubActionsWithPR', () => {
        const originalEnv = process.env;

        beforeEach(() => {
            vi.resetModules();
            process.env = { ...originalEnv };
        });

        afterEach(() => {
            process.env = originalEnv;
        });

        it('should return true when in GitHub Actions PR context', () => {
            process.env['GITHUB_ACTIONS'] = 'true';
            process.env['GITHUB_TOKEN'] = 'test-token';
            process.env['GITHUB_EVENT_NAME'] = 'pull_request';

            expect(isGitHubActionsWithPR()).toBe(true);
        });

        it('should return false when not in GitHub Actions', () => {
            delete process.env['GITHUB_ACTIONS'];
            process.env['GITHUB_TOKEN'] = 'test-token';
            process.env['GITHUB_EVENT_NAME'] = 'pull_request';

            expect(isGitHubActionsWithPR()).toBe(false);
        });

        it('should return false when no token', () => {
            process.env['GITHUB_ACTIONS'] = 'true';
            delete process.env['GITHUB_TOKEN'];
            process.env['GITHUB_EVENT_NAME'] = 'pull_request';

            expect(isGitHubActionsWithPR()).toBe(false);
        });

        it('should return false when not a pull request event', () => {
            process.env['GITHUB_ACTIONS'] = 'true';
            process.env['GITHUB_TOKEN'] = 'test-token';
            process.env['GITHUB_EVENT_NAME'] = 'push';

            expect(isGitHubActionsWithPR()).toBe(false);
        });
    });
});
