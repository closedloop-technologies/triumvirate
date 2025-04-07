import { red, yellow, blue, dim, magenta, gray } from 'picocolors';

// Define log levels
type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'note' | 'debug' | 'trace';

const LOG_LEVELS = {
    silent: 0,
    error: 1,
    warn: 2,
    info: 3,
    note: 4,
    debug: 5,
    trace: 6,
};

class Logger {
    private logLevel: number = LOG_LEVELS.info;

    setLogLevel(level: LogLevel | number): void {
        if (typeof level === 'string') {
            this.logLevel = LOG_LEVELS[level] || LOG_LEVELS.info;
        } else {
            this.logLevel = level;
        }
    }

    getLogLevel(): number {
        return this.logLevel;
    }

    log(...args: unknown[]): void {
        if (this.logLevel >= LOG_LEVELS.info) {
            console.log(...args);
        }
    }

    error(...args: unknown[]): void {
        if (this.logLevel >= LOG_LEVELS.error) {
            console.error(red(args.join(' ')));
        }
    }

    warn(...args: unknown[]): void {
        if (this.logLevel >= LOG_LEVELS.warn) {
            console.warn(yellow(args.join(' ')));
        }
    }

    info(...args: unknown[]): void {
        if (this.logLevel >= LOG_LEVELS.info) {
            console.info(blue(args.join(' ')));
        }
    }

    note(...args: unknown[]): void {
        if (this.logLevel >= LOG_LEVELS.note) {
            console.info(dim(args.join(' ')));
        }
    }

    debug(...args: unknown[]): void {
        if (this.logLevel >= LOG_LEVELS.debug) {
            console.debug(magenta(args.join(' ')));
        }
    }

    trace(...args: unknown[]): void {
        if (this.logLevel >= LOG_LEVELS.trace) {
            console.debug(gray(args.join(' ')));
        }
    }
}

export const logger = new Logger();
