import cliSpinners from 'cli-spinners';
import logUpdate from 'log-update';
import pc from 'picocolors';

interface SpinnerOptions {
    quiet?: boolean;
    verbose?: boolean;
}

export class Spinner {
    private spinner = cliSpinners.dwarfFortress;
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
            logUpdate(`${pc.cyan(frame)} ${this.message}`);
        }, this.spinner.interval);
    }

    update(message: string): void {
        if (this.isQuiet) {
            return;
        }

        this.message = message;
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

        this.stop(`${pc.green('✔')} ${message}`);
    }

    fail(message: string): void {
        if (this.isQuiet) {
            return;
        }

        this.stop(`${pc.red('✖')} ${message}`);
    }
}
