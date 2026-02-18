import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';

/**
 * Run the Triumvirate review action
 * @param {Object} options - Action options
 * @param {string} options.mode - Execution mode: 'normal' or 'strict'
 * @param {boolean} options.postSummary - Whether to post a summary comment on the PR
 * @param {boolean} options.postInlineComments - Whether to post inline comments
 * @param {string} options.githubToken - GitHub token for posting comments
 * @param {Function} execFn - Function to execute commands (for testing)
 */
export async function runAction(options = {}, execFn = execSync) {
    const {
        mode = 'normal',
        postSummary = true,
        postInlineComments = true,
        githubToken = process.env['GITHUB_TOKEN'],
    } = options;

    const failFlag = mode === 'strict' ? '--fail-on-error' : '';
    const outputFile = 'triumvirate.json';
    const command =
        `npx triumvirate review --models openai,claude,gemini --diff --output ${outputFile} ${failFlag}`.trim();

    // Run the review
    execFn(command, { stdio: 'inherit' });

    // Post PR comments if enabled and we have the necessary context
    const shouldPostComments = (postSummary || postInlineComments) && githubToken;
    const isPullRequest = process.env['GITHUB_EVENT_NAME'] === 'pull_request';

    if (shouldPostComments && isPullRequest && existsSync(outputFile)) {
        await postPRComments({
            outputFile,
            postSummary,
            postInlineComments,
            githubToken,
        });
    }
}

/**
 * Post PR comments using the review output
 */
async function postPRComments({
    outputFile,
    postSummary: _postSummary,
    postInlineComments: _postInlineComments,
    githubToken,
}) {
    try {
        // Dynamically import the PR comments module (it's TypeScript, will be compiled)
        const { postPRComments: postComments, parseGitHubContext } =
            await import('../dist/utils/github-pr-comments.js');

        // Parse GitHub context
        const context = await parseGitHubContext();
        if (!context || !context.owner || !context.repo || !context.pullNumber) {
            console.log('⚠️ Could not determine PR context, skipping PR comments');
            return;
        }

        // Read the review output
        const reportData = JSON.parse(readFileSync(outputFile, 'utf8'));

        // Build config
        const config = {
            token: githubToken,
            owner: context.owner,
            repo: context.repo,
            pullNumber: context.pullNumber,
            commitSha: context.commitSha || process.env['GITHUB_SHA'],
        };

        // Post comments
        const result = await postComments(config, reportData);

        // Log results
        if (result.summaryCommentId) {
            console.log(`✅ Posted PR summary comment (ID: ${result.summaryCommentId})`);
        }
        if (result.inlineCommentsPosted > 0) {
            console.log(`✅ Posted ${result.inlineCommentsPosted} inline comments`);
        }
        if (result.inlineCommentsFailed > 0) {
            console.log(`⚠️ Failed to post ${result.inlineCommentsFailed} inline comments`);
        }
        if (result.errors.length > 0) {
            result.errors.forEach(err => console.warn(`  - ${err}`));
        }
    } catch (error) {
        console.error('⚠️ Failed to post PR comments:', error.message);
        // Don't fail the action if PR comments fail
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const mode = process.env['INPUT_MODE'] || 'normal';
    const postSummary = process.env['INPUT_POST_SUMMARY'] !== 'false';
    const postInlineComments = process.env['INPUT_POST_INLINE_COMMENTS'] !== 'false';
    const githubToken = process.env['INPUT_GITHUB_TOKEN'] || process.env['GITHUB_TOKEN'];

    runAction({ mode, postSummary, postInlineComments, githubToken }).catch(err => {
        console.error('Action failed:', err);
        process.exit(1);
    });
}
