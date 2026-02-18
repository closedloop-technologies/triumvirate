/**
 * Unit tests for report-utils.ts
 */

import { describe, it, expect } from 'vitest';

import type { ModelResult } from '../src/types/model-responses.js';
import type { CodeReviewReport, ReviewCategory, ReviewFinding } from '../src/types/report.js';
import {
    createModelMetrics,
    analyzeModelAgreement,
    calculateAgreementStats,
    formatReportAsMarkdown,
} from '../src/utils/report-utils.js';

describe('Report Utils', () => {
    describe('createModelMetrics', () => {
        it('should create metrics from model results', () => {
            const modelResults: ModelResult[] = [
                {
                    model: 'openai',
                    review: 'Test review',
                    metrics: {
                        latency: 1500,
                        tokenTotal: 5000,
                        cost: '0.05',
                    },
                },
                {
                    model: 'claude',
                    review: 'Another review',
                    metrics: {
                        latency: 2000,
                        tokenTotal: 6000,
                        cost: '0.06',
                    },
                },
            ];

            const metrics = createModelMetrics(modelResults);

            expect(metrics).toHaveLength(2);
            expect(metrics[0].model.name).toBe('openai');
            expect(metrics[0].status).toBe('✅ Completed');
            expect(metrics[0].latencyMs).toBe(1500);
            expect(metrics[0].cost).toBe(0.05);
            expect(metrics[0].totalTokens).toBe(5000);
            expect(metrics[0].costPer1kTokens).toBe(0.01);

            expect(metrics[1].model.name).toBe('claude');
            expect(metrics[1].cost).toBe(0.06);
        });

        it('should handle failed model results', () => {
            const modelResults: ModelResult[] = [
                {
                    model: 'gemini',
                    review: '',
                    metrics: {
                        latency: 0,
                        tokenTotal: 0,
                        cost: '0',
                        error: 'API timeout',
                    },
                },
            ];

            const metrics = createModelMetrics(modelResults);

            expect(metrics).toHaveLength(1);
            expect(metrics[0].status).toBe('❌ Failed');
            expect(metrics[0].costPer1kTokens).toBe(0);
        });

        it('should handle missing metrics gracefully', () => {
            const modelResults: ModelResult[] = [
                {
                    model: 'openai',
                    review: 'Test',
                    metrics: {},
                },
            ];

            const metrics = createModelMetrics(modelResults);

            expect(metrics[0].latencyMs).toBe(0);
            expect(metrics[0].totalTokens).toBe(0);
            expect(metrics[0].cost).toBe(0);
        });
    });

    describe('analyzeModelAgreement', () => {
        it('should analyze agreement between models', () => {
            const reviews = [
                'The code has good readability and follows naming conventions. There is a potential null pointer bug.',
                'Code quality is excellent with proper documentation. Found a bug with undefined variable access.',
                'The architecture is well designed. Performance could be improved with caching.',
            ];
            const modelIds = ['openai', 'claude', 'gemini'];

            const analysis = analyzeModelAgreement(reviews, modelIds);

            expect(analysis).toBeInstanceOf(Array);
            expect(analysis.length).toBeGreaterThan(0);

            // Each analysis should have area, highAgreement, partialAgreement, disagreement
            analysis.forEach(item => {
                expect(item).toHaveProperty('area');
                expect(item).toHaveProperty('highAgreement');
                expect(item).toHaveProperty('partialAgreement');
                expect(item).toHaveProperty('disagreement');
            });
        });

        it('should handle empty reviews', () => {
            const reviews: string[] = [];
            const modelIds: string[] = [];

            const analysis = analyzeModelAgreement(reviews, modelIds);

            expect(analysis).toBeInstanceOf(Array);
        });

        it('should identify categories from keywords', () => {
            const reviews = [
                'Security vulnerability found: SQL injection risk in user input handling.',
                'Critical security issue: authentication bypass possible.',
            ];
            const modelIds = ['openai', 'claude'];

            const analysis = analyzeModelAgreement(reviews, modelIds);

            const securityAnalysis = analysis.find(a => a.area === 'Security');
            expect(securityAnalysis).toBeDefined();
        });
    });

    describe('calculateAgreementStats', () => {
        it('should calculate agreement statistics', () => {
            const categories: ReviewCategory[] = [
                { name: 'Security', description: 'Security issues' },
                { name: 'Performance', description: 'Performance issues' },
            ];

            const findings: Record<string, ReviewFinding[]> = {
                Security: [
                    {
                        title: 'SQL Injection',
                        description: 'Potential SQL injection',
                        category: categories[0],
                        modelAgreements: { openai: true, claude: true, gemini: true },
                        isStrength: false,
                    },
                    {
                        title: 'XSS Risk',
                        description: 'Cross-site scripting risk',
                        category: categories[0],
                        modelAgreements: { openai: true, claude: true, gemini: false },
                        isStrength: false,
                    },
                ],
                Performance: [
                    {
                        title: 'Slow Query',
                        description: 'Database query is slow',
                        category: categories[1],
                        modelAgreements: { openai: true, claude: false, gemini: false },
                        isStrength: false,
                    },
                ],
            };

            const stats = calculateAgreementStats(findings, categories);

            expect(stats).toHaveLength(2);

            const securityStats = stats.find(s => s.category === 'Security');
            expect(securityStats).toBeDefined();
            expect(securityStats?.allThreeModels).toBe(1); // All 3 models agree
            expect(securityStats?.twoModels).toBe(1); // 2 models agree

            const perfStats = stats.find(s => s.category === 'Performance');
            expect(perfStats).toBeDefined();
            expect(perfStats?.oneModel).toBe(1); // Only 1 model
        });

        it('should handle empty findings', () => {
            const categories: ReviewCategory[] = [
                { name: 'Security', description: 'Security issues' },
            ];
            const findings: Record<string, ReviewFinding[]> = {};

            const stats = calculateAgreementStats(findings, categories);

            expect(stats).toHaveLength(1);
            expect(stats[0].allThreeModels).toBe(0);
            expect(stats[0].twoModels).toBe(0);
            expect(stats[0].oneModel).toBe(0);
        });
    });

    describe('formatReportAsMarkdown', () => {
        it('should format a complete report as markdown', () => {
            const report: CodeReviewReport = {
                projectName: 'Test Project',
                reviewDate: '2024-01-15',
                categories: [{ name: 'Security', description: 'Security issues' }],
                models: [
                    { id: 'openai', name: 'OpenAI GPT-4' },
                    { id: 'claude', name: 'Claude 3' },
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
                        description: 'Consistent error handling',
                        category: { name: 'Code Quality', description: '' },
                        modelAgreements: { openai: true, claude: true },
                        isStrength: true,
                    },
                ],
                keyAreasForImprovement: [
                    {
                        title: 'Missing validation',
                        description: 'Input validation needed',
                        category: { name: 'Security', description: '' },
                        modelAgreements: { openai: true, claude: true },
                        isStrength: false,
                    },
                ],
                findingsByCategory: {
                    Security: [
                        {
                            title: 'Missing validation',
                            description: 'Input validation needed',
                            category: { name: 'Security', description: '' },
                            modelAgreements: { openai: true, claude: true },
                            isStrength: false,
                        },
                    ],
                },
                modelInsights: [],
                agreementAnalysis: [],
                agreementStatistics: [],
            };

            const markdown = formatReportAsMarkdown(report);

            expect(markdown).toContain('Test Project');
            expect(markdown).toContain('Code Review Report');
            expect(markdown).toContain('Good error handling');
            expect(markdown).toContain('Missing validation');
            expect(markdown).toContain('Security');
        });

        it('should handle empty report gracefully', () => {
            const report: CodeReviewReport = {
                projectName: 'Empty Project',
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

            const markdown = formatReportAsMarkdown(report);

            expect(markdown).toContain('Empty Project');
            expect(markdown).toContain('Code Review Report');
        });

        it('should include model metrics in markdown', () => {
            const report: CodeReviewReport = {
                projectName: 'Metrics Test',
                reviewDate: '2024-01-15',
                categories: [],
                models: [{ id: 'openai', name: 'OpenAI GPT-4' }],
                modelMetrics: [
                    {
                        model: { id: 'openai', name: 'OpenAI GPT-4' },
                        status: 'completed',
                        latencyMs: 1500,
                        cost: 0.05,
                        totalTokens: 5000,
                        costPer1kTokens: 0.01,
                    },
                ],
                keyStrengths: [],
                keyAreasForImprovement: [],
                findingsByCategory: {},
                modelInsights: [],
                agreementAnalysis: [],
                agreementStatistics: [],
            };

            const markdown = formatReportAsMarkdown(report);

            expect(markdown).toContain('OpenAI GPT-4');
        });

        it('should format findings with agreement indicators', () => {
            const report: CodeReviewReport = {
                projectName: 'Agreement Test',
                reviewDate: '2024-01-15',
                categories: [{ name: 'Test', description: 'Test category' }],
                models: [
                    { id: 'openai', name: 'OpenAI' },
                    { id: 'claude', name: 'Claude' },
                    { id: 'gemini', name: 'Gemini' },
                ],
                modelMetrics: [],
                keyStrengths: [],
                keyAreasForImprovement: [
                    {
                        title: 'High agreement issue',
                        description: 'All models agree',
                        category: { name: 'Test', description: '' },
                        modelAgreements: { openai: true, claude: true, gemini: true },
                        isStrength: false,
                    },
                ],
                findingsByCategory: {
                    Test: [
                        {
                            title: 'High agreement issue',
                            description: 'All models agree',
                            category: { name: 'Test', description: '' },
                            modelAgreements: { openai: true, claude: true, gemini: true },
                            isStrength: false,
                        },
                    ],
                },
                modelInsights: [],
                agreementAnalysis: [],
                agreementStatistics: [],
            };

            const markdown = formatReportAsMarkdown(report);

            expect(markdown).toContain('High agreement issue');
        });
    });
});
