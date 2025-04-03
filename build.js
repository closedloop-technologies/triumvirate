import * as esbuild from 'esbuild';

async function build() {
    try {
        // Build CLI entry point
        await esbuild.build({
            entryPoints: ['src/bin/cli.ts'],
            bundle: true,
            platform: 'node',
            target: 'node16',
            outfile: 'dist/cli.js',
            format: 'esm',
            banner: {
                js: '#!/usr/bin/env node',
            },
            minify: process.env.NODE_ENV === 'production',
            sourcemap: process.env.NODE_ENV !== 'production',
            external: [
                // Node.js built-in modules
                'events',
                'fs',
                'path',
                'child_process',
                'util',
                'os',
                'stream',
                'buffer',
                // External dependencies that should not be bundled
                '@anthropic-ai/sdk',
                '@google/generative-ai',
                'openai',
                'dotenv',
            ],
        });

        // Build main library
        await esbuild.build({
            entryPoints: ['src/index.js'],
            bundle: true,
            platform: 'node',
            target: 'node16',
            outfile: 'dist/index.js',
            format: 'esm',
            minify: process.env.NODE_ENV === 'production',
            sourcemap: process.env.NODE_ENV !== 'production',
            external: [
                // Node.js built-in modules
                'events',
                'fs',
                'path',
                'child_process',
                'util',
                'os',
                'stream',
                'buffer',
                // External dependencies that should not be bundled
                '@anthropic-ai/sdk',
                '@google/generative-ai',
                'openai',
                'dotenv',
            ],
        });

        console.log('✅ Build completed successfully!');
    } catch (error) {
        console.error('❌ Build failed:', error);
        process.exit(1);
    }
}

build();
