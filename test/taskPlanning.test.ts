import * as fs from 'fs';

vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);

const mockSummary = `# Codebase Summary\n\n- Module A: Handles auth\n- Module B: Processes data`;
const mockPlan = JSON.stringify({ tasks: [{ id: 1, name: 'Task 1' }] });

vi.mock('fs', async () => {
    return {
        readFileSync: vi.fn(path => {
            if (path === 'summary.md') {
                return mockSummary;
            }
            if (path === 'plan.json') {
                return mockPlan;
            }
            return '';
        }),
        writeFileSync: vi.fn(),
        existsSync: vi.fn().mockImplementation(path => {
            return path === 'summary.md' || path === 'plan.json';
        }),
    };
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
// Do NOT import planAction or nextAction here!

vi.mock('fs', async () => {
    const actual = await vi.importActual<typeof fs>('fs');
    return {
        ...actual,
        readFileSync: vi.fn(path => {
            if (path === 'summary.md') {
                return mockSummary;
            }
            if (path === 'plan.json') {
                return mockPlan;
            }
            return '';
        }),
        writeFileSync: vi.fn(),
        existsSync: vi.fn().mockReturnValue(true),
    };
});

describe('Task Planning Pipeline', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('planAction should process summary.md and produce a task plan', async () => {
        // Mock LLM provider for task planning
        vi.mock('../src/utils/llm-providers', () => ({
            ClaudeProvider: class {
                runCompletion() {
                    return Promise.resolve({
                        data: JSON.stringify({ tasks: [{ id: 1, name: 'Task 1' }] }),
                        usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20 },
                    });
                }
                isAvailable() {
                    return true;
                }
            },
        }));

        const { runPlanAction } = await import('../src/cli/actions/planAction');
        const plan = await runPlanAction({ input: 'summary.md', output: 'plan.json' });
        expect(plan).toBeDefined();
        expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('nextAction should process plan and produce the next task', async () => {
        const { runNextAction } = await import('../src/cli/actions/nextAction');
        const next = await runNextAction({ input: 'plan.json' });
        expect(next).toBeDefined();
        expect(fs.writeFileSync).toHaveBeenCalled();
    });
});
