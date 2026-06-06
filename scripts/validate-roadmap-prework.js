import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const requiredFiles = [
    'ROADMAP.md',
    'docs/roadmap-prework.md',
    'docs/decisions.md',
    'docs/issue-tracker-export-prework.md',
    'src/utils/issue-export.ts',
    'test/issue-export.test.ts',
    'scripts/validate-issue-export-prework.js',
];

const requiredPhrases = {
    'ROADMAP.md': [
        'Roadmap Prework Status',
        'docs/roadmap-prework.md',
        'Pending human, prework completed',
    ],
    'docs/roadmap-prework.md': [
        'Status: Pending human, prework completed',
        'Configuration file support',
        'Interactive mode',
        'Plugin system',
        'Issue tracker integration',
        'Repomix token-limit reruns',
        'Additional LLM providers',
        'Web UI',
        'Review history and trends',
        'Team collaboration',
        'Human-Pending Boundaries',
        'Issue tracker export prework',
        'Remote issue creation remains blocked',
    ],
    'docs/issue-tracker-export-prework.md': [
        'Status: Pending human, prework completed',
        'remote_side_effect_allowed: false',
        'human_approval_required: true',
        'Do not call GitHub, Jira, Linear, or any issue tracker API',
    ],
    'docs/decisions.md': [
        'Roadmap Items Become Prework Packets First',
        'issue tracker',
        'Plugin support',
        'Provider expansion',
        'Issue Tracker Export Is Local First',
    ],
};

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

const packet = read('docs/roadmap-prework.md');
const featureRows = packet
    .split('\n')
    .filter(line => line.startsWith('| ') && line.includes('Pending human, prework completed'));

assert(
    featureRows.length >= 12,
    `Expected at least 12 feature packet rows, found ${featureRows.length}`
);

for (const blockedClaim of ['creating any remote issue', 'plugin code', 'web UI launch claim']) {
    assert(packet.includes(blockedClaim), `Missing human-pending boundary for ${blockedClaim}`);
}

console.log('Validated Triumvirate roadmap prework');
console.log('Status: Pending human, prework completed');
