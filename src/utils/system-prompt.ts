import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * Fetch a URL and save it to a temporary file.
 * @param url - URL to fetch
 * @returns Path to the saved file
 */
export async function fetchDoc(url: string): Promise<string> {
    const response = await fetch(url, {
        headers: { 'User-Agent': 'triumvirate' },
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }
    const text = await response.text();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tridoc-'));
    const fileName = path.basename(new URL(url).pathname) || 'doc.txt';
    const filePath = path.join(tmpDir, fileName);
    fs.writeFileSync(filePath, text, 'utf8');
    return filePath;
}

/**
 * Resolve a list of docs provided by the user. URLs are fetched and saved
 * locally, while local paths are validated.
 * @param docs - Array of file paths or URLs
 * @returns Array of resolved local file paths
 */
export async function resolveDocs(docs: string[]): Promise<string[]> {
    const resolved: string[] = [];
    for (const doc of docs) {
        if (doc.startsWith('http://') || doc.startsWith('https://')) {
            resolved.push(await fetchDoc(doc));
        } else {
            if (!fs.existsSync(doc)) {
                throw new Error(`Documentation file not found: ${doc}`);
            }
            resolved.push(doc);
        }
    }
    return resolved;
}

/**
 * Create a system prompt from a task description and documentation files.
 * @param task - Task description
 * @param docs - Array of local documentation file paths
 * @returns Generated system prompt string
 */
export async function createSystemPrompt(task?: string, docs: string[] = []): Promise<string> {
    const parts: string[] = [];
    if (task) {
        parts.push(`Task:\n${task}`);
    }
    for (const doc of docs) {
        if (fs.existsSync(doc)) {
            const content = await fs.promises.readFile(doc, 'utf8');
            parts.push(`Documentation from ${doc}:\n${content}`);
        }
    }
    return parts.join('\n\n');
}
