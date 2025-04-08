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
