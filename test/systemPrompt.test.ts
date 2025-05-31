import * as fs from 'fs';
import * as path from 'path';

import { describe, it, expect, vi } from 'vitest';

import { resolveDocs, createSystemPrompt } from '../src/utils/system-prompt';

describe('system prompt utilities', () => {
    it('creates prompt from task and docs', async () => {
        const tmp = path.join(process.cwd(), 'tmp-doc.txt');
        fs.writeFileSync(tmp, 'example doc', 'utf8');
        const prompt = await createSystemPrompt('my task', [tmp]);
        expect(prompt).toContain('my task');
        expect(prompt).toContain('example doc');
        fs.unlinkSync(tmp);
    });

    it('resolves doc URLs via fetch', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            text: () => Promise.resolve('remote data'),
        });
        const originalFetch = global.fetch;

        global.fetch = fetchMock;

        const files = await resolveDocs(['https://example.com/doc']);
        expect(files.length).toBe(1);
        const content = fs.readFileSync(files[0], 'utf8');
        expect(content).toBe('remote data');

        fs.unlinkSync(files[0]);

        global.fetch = originalFetch;
    });
});
