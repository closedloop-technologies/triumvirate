import * as fs from 'fs';
import * as path from 'path';

import { describe, it, beforeAll, afterAll, expect } from 'vitest';

import { runNextAction } from '../src/cli/actions/nextAction.js';
import { runPlanAction } from '../src/cli/actions/planAction.js';
import { runCliAction } from '../src/cli/actions/runAction.js';
import { runSummarizeAction } from '../src/cli/actions/summarizeAction.js';

// Determine if we should run the end-to-end test
const shouldRun =
    process.env.RUN_E2E === 'true' &&
    !!process.env.OPENAI_API_KEY &&
    !!process.env.ANTHROPIC_API_KEY &&
    !!process.env.GOOGLE_API_KEY;

const describeIf = shouldRun ? describe : describe.skip;

describeIf('Triumvirate end-to-end workflow', () => {
    const reviewJson = path.join(process.cwd(), 'e2e-review.json');
    const summaryMd = path.join(process.cwd(), 'e2e-summary.md');
    const planJson = path.join(process.cwd(), 'e2e-plan.json');

    beforeAll(async () => {
        // Run a review across all models
        await runCliAction(['.'], {
            models: 'openai/gpt-4.1,anthropic/claude-3-7-sonnet-20250219,google/gemini-2.5-pro-exp-03-25',
            output: reviewJson,
            diff: true,
            enhancedReport: true,
            failOnError: false,
        });

        // Generate a summary from the raw review output
        await runSummarizeAction({
            input: reviewJson.replace(/\.json$/, '-enhanced.json'),
            output: summaryMd,
        });

        // Create a plan from the summary
        await runPlanAction({
            input: summaryMd,
            output: planJson,
        });
    });

    afterAll(() => {
        for (const file of [reviewJson, summaryMd, planJson]) {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
            }
        }
    });

    it('produces a review file', () => {
        expect(fs.existsSync(reviewJson)).toBe(true);
    });

    it('produces a summary file', () => {
        expect(fs.existsSync(summaryMd)).toBe(true);
    });

    it('produces a plan file', () => {
        expect(fs.existsSync(planJson)).toBe(true);
    });

    it('can output the next task without throwing', async () => {
        await expect(
            runNextAction({
                input: planJson,
            })
        ).resolves.not.toThrow();
    });
});
