class Logger {
    static log(level, message, error = null) {
        const timestamp = new Date().toISOString();
        const icons = { INFO: '📝', WARN: '⚠️', ERROR: '❌', SUCCESS: '✅', POLL: '🗳️' };
        const logMessage = `[${level}] ${timestamp} ${icons[level] || '🔷'} ${message}`;
        
        if (error) {
            console.error(logMessage, error);
        } else {
            if (level === 'ERROR') console.error(logMessage);
            else if (level === 'WARN') console.warn(logMessage);
            else console.log(logMessage);
        }
    }

    static info(message) { this.log('INFO', message); }
    static warn(message) { this.log('WARN', message); }
    static error(message, error = null) { this.log('ERROR', message, error); }
    static success(message) { this.log('SUCCESS', message); }
    static poll(message) { this.log('POLL', message); }
}

module.exports = Logger;
