#!/usr/bin/env node

/**
 * Documentation Spelling Check Script
 *
 * This script checks spelling in documentation files using cspell.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// ANSI color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    bold: '\x1b[1m',
};

// Documentation files to check
const docsToCheck = [
    'README.md',
    'CONTRIBUTING.md',
    'CHANGELOG.md',
    'DoD.md',
    'deployment_checklist.md',
    'src/cli/**/*.ts', // CLI help text and descriptions
];

// Check if cspell is installed
function checkCSpellInstalled() {
    try {
        execSync('npx cspell --version', { stdio: 'pipe' });
        return true;
        // eslint-disable-next-line no-unused-vars
    } catch (_err) {
        return false;
    }
}

// Run spelling check on a file or pattern
function checkSpelling(filePattern) {
    try {
        const result = execSync(`npx cspell "${filePattern}"`, {
            cwd: rootDir,
            encoding: 'utf8',
            stdio: 'pipe',
        });
        return { success: true, output: result };
    } catch (error) {
        return {
            success: false,
            output: error.stdout || '',
            error: error.stderr || error.message,
        };
    }
}

// Main function
async function main() {
    console.log(colors.bold + colors.blue + '\n📝 DOCUMENTATION SPELLING CHECK' + colors.reset);

    // Check if cspell is installed
    if (!checkCSpellInstalled()) {
        console.log(
            colors.yellow + '\nCSpell is not installed. Installing it now...' + colors.reset
        );
        try {
            execSync('npm install --save-dev cspell', { stdio: 'inherit', cwd: rootDir });
            console.log(colors.green + 'CSpell installed successfully.' + colors.reset);
        } catch (error) {
            console.error(colors.red + 'Failed to install CSpell:' + colors.reset);
            console.error(error.message);
            process.exit(1);
        }
    }

    // Create a temporary cspell configuration if it doesn't exist
    const cspellConfigPath = path.resolve(rootDir, 'cspell.json');
    let createdTempConfig = false;

    if (!fs.existsSync(cspellConfigPath)) {
        const defaultConfig = {
            version: '0.2',
            language: 'en',
            words: [
                'triumvirate',
                'justbuild',
                'openai',
                'anthropic',
                'claude',
                'gemini',
                'repomix',
                'tsup',
                'esbuild',
                'vitest',
                'tsconfig',
                'eslint',
                'prepublishOnly',
                'precommit',
            ],
            ignorePaths: [
                'node_modules/**',
                'dist/**',
                'coverage/**',
                '*.log',
                'package-lock.json',
                'yarn.lock',
            ],
        };

        fs.writeFileSync(cspellConfigPath, JSON.stringify(defaultConfig, null, 2));
        createdTempConfig = true;
        console.log(colors.yellow + 'Created temporary cspell configuration.' + colors.reset);
    }

    // Check spelling in each documentation file
    let allPassed = true;
    const results = {};

    for (const doc of docsToCheck) {
        const displayName = doc.includes('*')
            ? doc
            : path.relative(rootDir, path.resolve(rootDir, doc));
        process.stdout.write(`Checking spelling in ${displayName}... `);

        const result = checkSpelling(doc);
        results[displayName] = result.success;

        if (result.success) {
            console.log(colors.green + '✓ PASSED' + colors.reset);
        } else {
            console.log(colors.red + '✗ FAILED' + colors.reset);
            console.log(result.output);
            allPassed = false;
        }
    }

    // Clean up temporary configuration
    if (createdTempConfig) {
        fs.unlinkSync(cspellConfigPath);
        console.log(colors.yellow + '\nRemoved temporary cspell configuration.' + colors.reset);
    }

    // Summary
    console.log(
        '\n' +
            colors.bold +
            (allPassed ? colors.green : colors.red) +
            `Spelling check ${allPassed ? 'PASSED' : 'FAILED'}` +
            colors.reset
    );

    if (!allPassed) {
        console.log('\nFailed checks:');
        for (const [file, passed] of Object.entries(results)) {
            if (!passed) {
                console.log(`${colors.red}✗${colors.reset} ${file}`);
            }
        }
        process.exit(1);
    }

    return allPassed;
}

// Run the main function
main().catch(error => {
    console.error(colors.red + '\n❌ Error running spelling check:' + colors.reset);
    console.error(error);
    process.exit(1);
});
