import { execSync } from 'child_process';

export function runAction(mode = 'normal', execFn = execSync) {
    const failFlag = mode === 'strict' ? '--fail-on-error' : '';
    const command =
        `npx triumvirate --models openai,claude,gemini --diff --output triumvirate.json ${failFlag}`.trim();
    execFn(command, { stdio: 'inherit' });
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const mode = process.env.INPUT_MODE || 'normal';
    runAction(mode);
}
