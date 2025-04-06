#!/usr/bin/env node

import { execSync } from 'child_process';

// Function to measure execution time
const measureTime = fn => {
    const start = process.hrtime.bigint();
    fn();
    const end = process.hrtime.bigint();
    return Number(end - start) / 1_000_000; // Convert to milliseconds
};

// Test pre-commit hook performance
const testPreCommitPerformance = () => {
    try {
        console.log('Testing pre-commit hook performance...');

        // Run the pre-commit hook and measure time
        const timeMs = measureTime(() => {
            execSync('npx lint-staged && node scripts/check-types-changed.js', {
                stdio: 'inherit',
                encoding: 'utf8',
            });
        });

        console.log(`\nPre-commit hook completed in ${(timeMs / 1000).toFixed(2)} seconds`);

        // Check if it meets the acceptance criteria
        if (timeMs < 3000) {
            console.log('✅ Meets acceptance criteria (under 3 seconds)');
        } else {
            console.log('⚠️ Does not meet acceptance criteria (over 3 seconds)');
        }

        return timeMs;
    } catch (error) {
        console.error('Error testing pre-commit hook:', error);
        process.exit(1);
    }
};

testPreCommitPerformance();
