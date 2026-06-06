import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const requiredFiles = ['scripts/e2e-test.js', 'docs/e2e-harness-prework.md'];

const requiredPhrases = {
    'scripts/e2e-test.js': [
        'Greeting fixture failed',
        'Fixture file created',
        'Temporary E2E workspace cleaned',
        '!fixtureContents.includes',
    ],
    'docs/e2e-harness-prework.md': [
        'Status: Pending human, prework completed',
        'Fixture generation',
        'CLI surface smoke',
        'Option parsing smoke',
        'Workspace hygiene',
        'Human-Pending Boundaries',
        'credentialed Vitest workflow',
    ],
};

const unfinishedMarker = 'TO' + 'DO';

function read(path) {
    return readFileSync(resolve(process.cwd(), path), 'utf8');
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

for (const file of requiredFiles) {
    read(file);
}

for (const [file, phrases] of Object.entries(requiredPhrases)) {
    const contents = read(file);
    const missing = phrases.filter(phrase => !contents.includes(phrase));
    assert(missing.length === 0, `${file} missing required phrases: ${missing.join(', ')}`);
}

const e2eScript = read('scripts/e2e-test.js');
const embeddedFixture = e2eScript.match(/fs\.writeFileSync\([\s\S]*?`\n([\s\S]*?)\n  `\n    \);/);

assert(embeddedFixture, 'Unable to locate generated e2e fixture body');
assert(
    !embeddedFixture[1].includes(unfinishedMarker),
    'Generated e2e fixture must not contain unfinished-work marker text'
);
assert(embeddedFixture[1].includes("greet('World')"), 'Generated e2e fixture must exercise greet');

console.log('Validated Triumvirate e2e harness prework');
console.log('Status: Pending human, prework completed');
