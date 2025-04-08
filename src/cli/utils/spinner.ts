import logUpdate from 'log-update';
import pc from 'picocolors';

interface SpinnerOptions {
    quiet?: boolean;
    verbose?: boolean;
}

// Custom spinner frames for a more hacker/arcade aesthetic
const hackerSpinner = {
    interval: 80,
    frames: [
        '▓▒░    ',
        '▒░▓    ',
        '░▓▒    ',
        '▓▒░    ',
        '▒░▓    ',
        '░▓▒    ',
        '█▓▒░   ',
        '▓▒░█   ',
        '▒░█▓   ',
        '░█▓▒   ',
        '█▓▒░   ',
        '▓▒░█   ',
        '⟨⟩     ',
        '⟨⟩     ',
        '⟨=⟩    ',
        '⟨==⟩   ',
        '⟨===⟩  ',
        '⟨====⟩ ',
        '⟨=====⟩',
        '⟨====⟩ ',
        '⟨===⟩  ',
        '⟨==⟩   ',
        '⟨=⟩    ',
        '⟨⟩     ',
    ],
};

export class LogBox {
    private lines: string[] = [];
    private maxLines: number = 5;
    private readonly isQuiet: boolean = false;
    private boxWidth: number = 80;
    private static instance: LogBox | null = null;

    constructor(maxLines: number = 5, options: SpinnerOptions = {}) {
        // Singleton pattern to prevent multiple instances
        if (LogBox.instance) {
            return LogBox.instance;
        }

        this.maxLines = maxLines;
        this.isQuiet = options.quiet || options.verbose || false;
        // Initialize with empty lines
        this.lines = Array(maxLines).fill('');
        LogBox.instance = this;
    }

    start(): void {
        if (this.isQuiet) {
            return;
        }
        // Initial render with empty box
        this.render();
    }

    addLine(line: string): void {
        if (this.isQuiet) {
            return;
        }

        // Trim the line if it's too long
        const trimmedLine = line.trim();

        // Add new line and remove oldest if we exceed maxLines
        this.lines.push(trimmedLine);
        if (this.lines.length > this.maxLines) {
            this.lines.shift();
        }

        this.render();
    }

    render(): void {
        if (this.isQuiet) {
            return;
        }

        // Create the box with the lines
        const topBorder = pc.gray(`┌${'─'.repeat(this.boxWidth)}┐`);
        const bottomBorder = pc.gray(`└${'─'.repeat(this.boxWidth)}┘`);

        const contentLines = this.lines.map(line => {
            // Truncate or pad the line to fit the box width
            const displayLine =
                line.length > this.boxWidth - 4
                    ? line.substring(0, this.boxWidth - 7) + '...'
                    : line.padEnd(this.boxWidth - 4, ' ');
            return `│ ${pc.gray(displayLine)} │`;
        });

        // Join all lines with newlines
        const content = contentLines.join('\n');

        // Use logUpdate to update the console in place
        logUpdate(`${topBorder}\n${content}\n${bottomBorder}`);
    }

    stop(): void {
        if (this.isQuiet) {
            return;
        }

        // Finalize the output and allow normal console output to continue
        logUpdate.done();
        LogBox.instance = null;
    }

    clear(): void {
        if (this.isQuiet) {
            return;
        }

        logUpdate.clear();
    }
}

export class Spinner {
    private spinner = hackerSpinner;
    private message: string;
    private currentFrame = 0;
    private interval: ReturnType<typeof setInterval> | null = null;
    private readonly isQuiet: boolean;

    constructor(message: string, options: SpinnerOptions = {}) {
        this.message = message;
        // If the user has specified the verbose flag or quiet flag, don't show the spinner
        this.isQuiet = options.quiet || options.verbose || false;
    }

    start(): void {
        if (this.isQuiet) {
            return;
        }

        const { frames } = this.spinner;
        const framesLength = frames.length;
        this.interval = setInterval(() => {
            this.currentFrame++;
            const frame = frames[this.currentFrame % framesLength] || '';
            logUpdate(`${pc.cyan(frame)} ${pc.yellow(this.message)}`);
        }, this.spinner.interval);
    }

    update(message: string): void {
        if (this.isQuiet) {
            return;
        }

        this.message = message;
        const { frames } = this.spinner;
        const frame = frames[this.currentFrame % frames.length] || '';
        logUpdate(`${pc.cyan(frame)} ${pc.yellow(this.message)}`);
    }

    stop(finalMessage: string): void {
        if (this.isQuiet) {
            return;
        }

        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        logUpdate(finalMessage);
        logUpdate.done();
    }

    succeed(message: string): void {
        if (this.isQuiet) {
            return;
        }

        this.stop(`${pc.green('██')} ${pc.cyan(message)}`);
    }

    fail(message: string): void {
        if (this.isQuiet) {
            return;
        }

        this.stop(`${pc.red('░░')} ${pc.magenta(message)}`);
    }
}
