import { describe, it, expect, vi } from 'vitest';

import { runAction } from '../scripts/github-action.js';

describe('github action runner', () => {
    it('adds fail-on-error flag in strict mode', async () => {
        const exec = vi.fn();
        await runAction({ mode: 'strict' }, exec);
        expect(exec).toHaveBeenCalled();
        expect(exec.mock.calls[0][0]).toContain('--fail-on-error');
    });

    it('runs without fail-on-error in normal mode', async () => {
        const exec = vi.fn();
        await runAction({ mode: 'normal' }, exec);
        expect(exec).toHaveBeenCalled();
        expect(exec.mock.calls[0][0]).not.toContain('--fail-on-error');
    });

    it('includes review command in the execution', async () => {
        const exec = vi.fn();
        await runAction({}, exec);
        expect(exec).toHaveBeenCalled();
        expect(exec.mock.calls[0][0]).toContain('npx triumvirate review');
        expect(exec.mock.calls[0][0]).toContain('--diff');
        expect(exec.mock.calls[0][0]).toContain('--models openai,claude,gemini');
    });
});
