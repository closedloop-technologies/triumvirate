import { describe, it, expect, vi } from 'vitest';

import { runAction } from '../scripts/github-action.js';

describe('github action runner', () => {
    it('adds fail-on-error flag in strict mode', () => {
        const exec = vi.fn();
        runAction('strict', exec);
        expect(exec).toHaveBeenCalled();
        expect(exec.mock.calls[0][0]).toContain('--fail-on-error');
    });

    it('runs without fail-on-error in normal mode', () => {
        const exec = vi.fn();
        runAction('normal', exec);
        expect(exec).toHaveBeenCalled();
        expect(exec.mock.calls[0][0]).not.toContain('--fail-on-error');
    });
});
