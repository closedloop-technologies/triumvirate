import * as fs from 'fs';
import * as path from 'path';

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock process.exit to prevent tests from terminating
vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);

// Mock data for tests
const mockSummary = `# Codebase Summary

- Module A: Handles auth
- Module B: Processes data`;
const mockPlan = JSON.stringify({
    tasks: [
        {
            id: 'task-1',
            title: 'Fix authentication bug',
            description: 'There is an issue with the auth module',
            priority: 'high',
            dependencies: [],
            type: 'bug',
            completed: false,
        },
    ],
    metadata: {
        createdAt: new Date().toISOString(),
        sourceFile: 'summary.md',
    },
});

// Mock fs module
vi.mock('fs', async () => {
    const actual = await vi.importActual<typeof fs>('fs');
    return {
        ...actual,
        readFileSync: vi.fn().mockImplementation((filePath, _options) => {
            // Handle both string paths and resolved paths
            const fileName = typeof filePath === 'string' ? path.basename(filePath) : '';

            if (fileName === 'summary.md' || filePath.toString().includes('summary.md')) {
                return mockSummary;
            }
            if (fileName === 'plan.json' || filePath.toString().includes('plan.json')) {
                return mockPlan;
            }
            throw new Error(`ENOENT: no such file or directory, open '${filePath}'`);
        }),
        writeFileSync: vi.fn(),
        existsSync: vi.fn().mockImplementation(filePath => {
            const fileName = typeof filePath === 'string' ? path.basename(filePath) : '';
            return (
                fileName === 'summary.md' ||
                fileName === 'plan.json' ||
                filePath.toString().includes('summary.md') ||
                filePath.toString().includes('plan.json')
            );
        }),
    };
});

// Mock fs/promises module
vi.mock('fs/promises', async () => {
    return {
        readFile: vi.fn().mockImplementation(async (filePath, _options) => {
            const fileName = typeof filePath === 'string' ? path.basename(filePath) : '';

            if (fileName === 'summary.md' || filePath.toString().includes('summary.md')) {
                return mockSummary;
            }
            if (fileName === 'plan.json' || filePath.toString().includes('plan.json')) {
                return mockPlan;
            }
            throw new Error(`ENOENT: no such file or directory, open '${filePath}'`);
        }),
        writeFile: vi.fn(),
        mkdir: vi.fn(),
    };
});

// Mock LLM providers
vi.mock('../src/utils/llm-providers', () => {
    return {
        ClaudeProvider: class {
            runStructured() {
                return Promise.resolve({
                    data: {
                        tasks: [
                            {
                                id: 'task-1',
                                title: 'Fix authentication bug',
                                description: 'There is an issue with the auth module',
                                priority: 'high',
                                dependencies: [],
                                type: 'bug',
                            },
                        ],
                    },
                    usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20 },
                });
            }
            isAvailable() {
                return true;
            }
        },
        OpenAIProvider: class {
            isAvailable() {
                return false;
            }
        },
        GeminiProvider: class {
            isAvailable() {
                return false;
            }
        },
    };
});

describe('Task Planning Pipeline', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.clearAllMocks();
    });

    it('planAction should process summary.md and produce a task plan', async () => {
        const { runPlanAction } = await import('../src/cli/actions/planAction');

        // Override process.exit for this test
        const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);

        await runPlanAction({
            input: 'summary.md',
            output: 'plan.json',
            agentModel: 'claude',
        });

        // Check that the file write was called
        expect(fs.writeFileSync).toHaveBeenCalled();
        // Check that process.exit was not called with error code
        expect(exitSpy).not.toHaveBeenCalledWith(1);
    });

    it('nextAction should process plan and produce the next task', async () => {
        const { runNextAction } = await import('../src/cli/actions/nextAction');

        // Override process.exit for this test
        const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);

        await runNextAction({
            input: 'plan.json',
        });

        // Check that process.exit was not called with error code
        expect(exitSpy).not.toHaveBeenCalledWith(1);
    });
});
