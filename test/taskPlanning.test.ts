import * as fs from 'fs';
import * as path from 'path';

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock process.exit to prevent tests from terminating
vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);

// Mock data for tests (used in fs mock below)
const _mockSummary = `# Codebase Summary

- Module A: Handles auth
- Module B: Processes data`;
const _mockPlan = JSON.stringify({
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

// Mock fs module - planAction uses fs.promises
vi.mock('fs', async () => {
    const actual = await vi.importActual<typeof fs>('fs');

    const mockSummaryContent = `# Codebase Summary

- Module A: Handles auth
- Module B: Processes data`;
    const mockPlanContent = JSON.stringify({
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

    return {
        ...actual,
        readFileSync: vi.fn().mockImplementation((filePath, _options) => {
            const fileName = typeof filePath === 'string' ? path.basename(filePath) : '';

            if (fileName === 'summary.md' || filePath.toString().includes('summary.md')) {
                return mockSummaryContent;
            }
            if (fileName === 'plan.json' || filePath.toString().includes('plan.json')) {
                return mockPlanContent;
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
        promises: {
            readFile: vi.fn().mockImplementation(async (filePath: string) => {
                if (filePath.includes('summary.md')) {
                    return mockSummaryContent;
                }
                if (filePath.includes('plan.json')) {
                    return mockPlanContent;
                }
                throw new Error(`ENOENT: no such file or directory, open '${filePath}'`);
            }),
            writeFile: vi.fn().mockResolvedValue(undefined),
            mkdir: vi.fn().mockResolvedValue(undefined),
            readdir: vi.fn().mockResolvedValue([]),
            stat: vi.fn().mockResolvedValue({ mtime: new Date() }),
        },
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
        vi.clearAllMocks();
        // Set up environment
        process.env['ANTHROPIC_API_KEY'] = 'test-key';
        // Use legacy providers instead of BAML for testing (BAML requires actual client)
        process.env['USE_LEGACY'] = 'true';
    });

    it('planAction should process summary.md and produce a task plan', async () => {
        const { runPlanAction } = await import('../src/cli/actions/planAction');
        const fsModule = await import('fs');

        // Override process.exit for this test
        const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);

        await runPlanAction({
            input: 'summary.md',
            output: 'plan.json',
            agentModel: 'claude',
        });

        // Check that the async file write was called (planAction uses fs.promises.writeFile)
        expect(fsModule.promises.writeFile).toHaveBeenCalled();
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
