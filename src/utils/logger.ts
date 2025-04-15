import pc from 'picocolors';

// Define log levels
export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'note' | 'debug' | 'trace';

const LOG_LEVELS = {
    silent: 0,
    error: 1,
    warn: 2,
    info: 3,
    note: 4,
    debug: 5,
    trace: 6,
};

// Hacker/arcade style prefixes for different log levels
const LOG_PREFIXES = {
    error: '░░ [ERROR]', // ░░ [ERROR]
    warn: '▒▒ [WARN]', // ▒▒ [WARN]
    info: '▓▓ [INFO]', // ▓▓ [INFO]
    note: '██ [NOTE]', // ██ [NOTE]
    debug: '⟨DEBUG⟩', // ⟨DEBUG⟩
    trace: '⟨TRACE⟩', // ⟨TRACE⟩
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
            console.error(pc.red(`${LOG_PREFIXES.error} ${args.join(' ')}`));
        }
    }

    warn(...args: unknown[]): void {
        if (this.logLevel >= LOG_LEVELS.warn) {
            console.warn(pc.yellow(`${LOG_PREFIXES.warn} ${args.join(' ')}`));
        }
    }

    info(...args: unknown[]): void {
        if (this.logLevel >= LOG_LEVELS.info) {
            console.info(pc.cyan(`${LOG_PREFIXES.info} ${args.join(' ')}`));
        }
    }

    note(...args: unknown[]): void {
        if (this.logLevel >= LOG_LEVELS.note) {
            console.info(pc.green(`${LOG_PREFIXES.note} ${args.join(' ')}`));
        }
    }

    debug(...args: unknown[]): void {
        if (this.logLevel >= LOG_LEVELS.debug) {
            console.debug(pc.magenta(`${LOG_PREFIXES.debug} ${args.join(' ')}`));
        }
    }

    trace(...args: unknown[]): void {
        if (this.logLevel >= LOG_LEVELS.trace) {
            console.debug(pc.gray(`${LOG_PREFIXES.trace} ${args.join(' ')}`));
        }
    }
}

export const logger = new Logger();
