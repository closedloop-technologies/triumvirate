import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const requiredFiles = [
    'docs/issue-tracker-export-prework.md',
    'src/utils/issue-export.ts',
    'test/issue-export.test.ts',
];

const requiredPhrases = {
    'docs/issue-tracker-export-prework.md': [
        'Status: Pending human, prework completed',
        'remote_side_effect_allowed: false',
        'human_approval_required: true',
        'Do not call GitHub, Jira, Linear, or any issue tracker API',
        'duplicate issue search',
        'rollback note',
    ],
    'src/utils/issue-export.ts': [
        "status: 'Pending human, prework completed'",
        'remote_side_effect_allowed: false',
        'human_approval_required: true',
        'required_before_remote_create',
        'exportReviewIssues',
    ],
    'test/issue-export.test.ts': [
        'exports GitHub and Jira-shaped payloads',
        'filters strengths and limits exported issue count',
        'redacts secret-like text',
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

const implementation = read('src/utils/issue-export.ts');
for (const forbidden of ['issues.create(', 'createIssue(', 'fetch(', 'Octokit(']) {
    assert(
        !implementation.includes(forbidden),
        `issue export implementation has remote side-effect marker: ${forbidden}`
    );
}

console.log('Validated Triumvirate issue tracker export prework');
console.log('Status: Pending human, prework completed');
