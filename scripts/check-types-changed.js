#!/usr/bin/env node

import { execSync } from 'child_process';

// Get staged TypeScript files
const getStagedTsFiles = () => {
    try {
        const output = execSync('git diff --cached --name-only --diff-filter=ACMR "*.ts" "*.tsx"', {
            encoding: 'utf8',
        });
        return output.trim().split('\n').filter(Boolean);
    } catch (error) {
        console.error('Error getting staged TS files:', error);
        return [];
    }
};

// Main function
const main = () => {
    const files = getStagedTsFiles();

    if (files.length === 0) {
        console.log('No TypeScript files to check');
        process.exit(0);
    }

    console.log(`Checking types for ${files.length} files...`);

    try {
        // Run tsc on the staged files only
        execSync(`npx tsc --noEmit --skipLibCheck ${files.join(' ')}`, {
            stdio: 'inherit',
            encoding: 'utf8',
        });
        console.log('Type checking passed!');
        process.exit(0);
    } catch (error) {
        console.error('Type checking failed!');
        process.exit(1);
    }
};

main();
