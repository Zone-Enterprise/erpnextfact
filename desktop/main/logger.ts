import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { promisify } from 'util';
import { EventEmitter } from 'events';

// Promisified fs functions
const fsAppend = promisify(fs.appendFile);
const fsReadFile = promisify(fs.readFile);
const fsStat = promisify(fs.stat);
const fsUnlink = promisify(fs.unlink);
const fsReaddir = promisify(fs.readdir);
const fsMkdir = promisify(fs.mkdir);

// Log levels with numeric values for comparison
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

// Log level name mapping
const LOG_LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
  [LogLevel.NONE]: 'NONE'
};

// Configuration interface
interface LoggerConfig {
  level: LogLevel;
  maxFileSize: number; // in bytes
  maxFiles: number;
  logToConsole: boolean;
  logToFile: boolean;
  logDir?: string;
  fileNamePrefix: string;
}

/**
 * Logger class for ERPNext Desktop
 * Handles logging to console and file with rotation
 */
class Logger extends EventEmitter {
  private config: LoggerConfig;
  private currentLogFile: string;
  private isInitialized = false;
  private logQueue: Array<{level: LogLevel, message: string, data?: any}> = [];
  private isProcessingQueue = false;

  constructor() {
    super();
    
    // Default configuration
    this.config = {
      level: LogLevel.INFO,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      logToConsole: true,
      logToFile: true,
      fileNamePrefix: 'erpnext-desktop'
    };
    
    this.currentLogFile = '';
  }

  /**
   * Initialize the logger
   * @param config - Optional configuration to override defaults
   */
  async initialize(config?: Partial<LoggerConfig>): Promise<void> {
    // Merge provided config with defaults
    if (config) {
      this.config = { ...this.config, ...config };
    }
    
    // Set log directory if not provided
    if (!this.config.logDir) {
      // Use app's logs directory
      this.config.logDir = path.join(
        app.getPath('userData'),
        'logs'
      );
    }
    
    // Ensure log directory exists
    await this.ensureLogDirectory();
    
    // Set current log file
    this.currentLogFile = this.getLogFilePath();
    
    this.isInitialized = true;
    
    // Process any queued logs
    this.processLogQueue();
    
    this.debug('Logger initialized', {
      config: { ...this.config, level: LOG_LEVEL_NAMES[this.config.level] }
    });
  }

  /**
   * Ensure log directory exists
   */
  private async ensureLogDirectory(): Promise<void> {
    try {
      await fsMkdir(this.config.logDir!, { recursive: true });
    } catch (error: any) {
      // Ignore error if directory already exists
      if (error.code !== 'EEXIST') {
        console.error('Failed to create log directory:', error);
      }
    }
  }

  /**
   * Get path for the current log file
   */
  private getLogFilePath(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return path.join(
      this.config.logDir!,
      `${this.config.fileNamePrefix}-${timestamp}.log`
    );
  }

  /**
   * Format a log message
   * @param level - Log level
   * @param message - Log message
   * @param data - Optional data to log
   */
  private formatLogMessage(level: LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const levelName = LOG_LEVEL_NAMES[level];
    
    let logMessage = `[${timestamp}] [${levelName}] ${message}`;
    
    if (data !== undefined) {
      try {
        // Format data as JSON if it's an object, otherwise convert to string
        const dataString = typeof data === 'object' && data !== null
          ? JSON.stringify(data, null, 2)
          : String(data);
        
        logMessage += `\n${dataString}`;
      } catch (error) {
        logMessage += `\n[Error formatting data: ${error}]`;
      }
    }
    
    return logMessage;
  }

  /**
   * Write a log message to file
   * @param message - Formatted log message
   */
  private async writeToFile(message: string): Promise<void> {
    if (!this.config.logToFile) return;
    
    try {
      // Append newline to message
      const logEntry = message + os.EOL;
      
      // Append to current log file
      await fsAppend(this.currentLogFile, logEntry);
      
      // Check if rotation is needed
      await this.checkRotation();
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  /**
   * Check if log rotation is needed and rotate if necessary
   */
  private async checkRotation(): Promise<void> {
    try {
      const stats = await fsStat(this.currentLogFile);
      
      if (stats.size >= this.config.maxFileSize) {
        await this.rotateLogFiles();
      }
    } catch (error) {
      console.error('Error checking log file size:', error);
    }
  }

  /**
   * Rotate log files
   */
  private async rotateLogFiles(): Promise<void> {
    try {
      // Get all log files
      const files = await fsReaddir(this.config.logDir!);
      const logFiles = files
        .filter(file => file.startsWith(this.config.fileNamePrefix) && file.endsWith('.log'))
        .map(file => path.join(this.config.logDir!, file))
        .sort();
      
      // Remove oldest files if we have too many
      while (logFiles.length >= this.config.maxFiles) {
        const oldestFile = logFiles.shift();
        if (oldestFile) {
          await fsUnlink(oldestFile);
          this.debug(`Rotated log file deleted: ${oldestFile}`);
        }
      }
      
      // Create new log file
      this.currentLogFile = this.getLogFilePath();
      this.debug(`Log rotated, new file: ${this.currentLogFile}`);
    } catch (error) {
      console.error('Error rotating log files:', error);
    }
  }

  /**
   * Process the log queue
   */
  private async processLogQueue(): Promise<void> {
    if (this.isProcessingQueue || this.logQueue.length === 0) return;
    
    this.isProcessingQueue = true;
    
    try {
      while (this.logQueue.length > 0) {
        const { level, message, data } = this.logQueue.shift()!;
        await this.logInternal(level, message, data);
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Internal logging method
   * @param level - Log level
   * @param message - Log message
   * @param data - Optional data to log
   */
  private async logInternal(level: LogLevel, message: string, data?: any): Promise<void> {
    // Skip if log level is below configured level
    if (level < this.config.level) return;
    
    const formattedMessage = this.formatLogMessage(level, message, data);
    
    // Log to console if enabled
    if (this.config.logToConsole) {
      switch (level) {
        case LogLevel.DEBUG:
          console.debug(formattedMessage);
          break;
        case LogLevel.INFO:
          console.info(formattedMessage);
          break;
        case LogLevel.WARN:
          console.warn(formattedMessage);
          break;
        case LogLevel.ERROR:
          console.error(formattedMessage);
          break;
      }
    }
    
    // Log to file if enabled and initialized
    if (this.config.logToFile && this.isInitialized) {
      await this.writeToFile(formattedMessage);
    }
    
    // Emit log event
    this.emit('log', { level, message, data, formatted: formattedMessage });
  }

  /**
   * Log a message
   * @param level - Log level
   * @param message - Log message
   * @param data - Optional data to log
   */
  log(level: LogLevel, message: string, data?: any): void {
    if (!this.isInitialized) {
      // Queue log message if not initialized
      this.logQueue.push({ level, message, data });
      return;
    }
    
    this.logInternal(level, message, data).catch(err => {
      console.error('Error in logging:', err);
    });
  }

  /**
   * Log a debug message
   * @param message - Log message
   * @param data - Optional data to log
   */
  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  /**
   * Log an info message
   * @param message - Log message
   * @param data - Optional data to log
   */
  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }

  /**
   * Log a warning message
   * @param message - Log message
   * @param data - Optional data to log
   */
  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }

  /**
   * Log an error message
   * @param message - Log message
   * @param data - Optional data to log
   */
  error(message: string, data?: any): void {
    this.log(LogLevel.ERROR, message, data);
  }

  /**
   * Set the log level
   * @param level - New log level
   */
  setLevel(level: LogLevel): void {
    this.config.level = level;
    this.debug(`Log level set to ${LOG_LEVEL_NAMES[level]}`);
  }

  /**
   * Get the current log level
   */
  getLevel(): LogLevel {
    return this.config.level;
  }

  /**
   * Get the current log level name
   */
  getLevelName(): string {
    return LOG_LEVEL_NAMES[this.config.level];
  }

  /**
   * Get the path to the current log file
   */
  getCurrentLogFile(): string {
    return this.currentLogFile;
  }

  /**
   * Get the content of the current log file
   */
  async getLogContent(): Promise<string> {
    try {
      if (!this.isInitialized || !this.currentLogFile) {
        return '';
      }
      
      return await fsReadFile(this.currentLogFile, 'utf8');
    } catch (error) {
      console.error('Failed to read log file:', error);
      return '';
    }
  }

  /**
   * Get all log files
   */
  async getLogFiles(): Promise<string[]> {
    try {
      if (!this.isInitialized || !this.config.logDir) {
        return [];
      }
      
      const files = await fsReaddir(this.config.logDir);
      return files
        .filter(file => file.startsWith(this.config.fileNamePrefix) && file.endsWith('.log'))
        .map(file => path.join(this.config.logDir!, file))
        .sort();
    } catch (error) {
      console.error('Failed to get log files:', error);
      return [];
    }
  }

  /**
   * Clear all log files
   */
  async clearLogs(): Promise<boolean> {
    try {
      if (!this.isInitialized || !this.config.logDir) {
        return false;
      }
      
      const files = await this.getLogFiles();
      
      // Delete all log files except current one
      for (const file of files) {
        if (file !== this.currentLogFile) {
          await fsUnlink(file);
        }
      }
      
      // Create a new current log file
      this.currentLogFile = this.getLogFilePath();
      
      this.info('Logs cleared');
      return true;
    } catch (error) {
      console.error('Failed to clear logs:', error);
      return false;
    }
  }

  /**
   * Archive logs to a zip file
   * @param archivePath - Path to save the archive
   */
  async archiveLogs(archivePath?: string): Promise<string | null> {
    try {
      if (!this.isInitialized || !this.config.logDir) {
        return null;
      }
      
      // Use provided path or generate one
      const outputPath = archivePath || path.join(
        app.getPath('downloads'),
        `erpnext-desktop-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`
      );
      
      // We'd normally use a zip library here, but for simplicity
      // we'll just return the path to the log directory
      this.info(`Logs would be archived to: ${outputPath}`);
      
      // In a real implementation, we'd zip the logs here
      // For now, just return the log directory
      return this.config.logDir;
    } catch (error) {
      console.error('Failed to archive logs:', error);
      return null;
    }
  }
}

// Create singleton instance
export const log = new Logger();

/**
 * Set up logging for the application
 * @param config - Optional configuration to override defaults
 */
export async function setupLogging(config?: Partial<LoggerConfig>): Promise<void> {
  await log.initialize(config);
  
  // Set up global error handlers
  process.on('uncaughtException', (error) => {
    log.error('Uncaught exception:', error);
  });
  
  process.on('unhandledRejection', (reason) => {
    log.error('Unhandled promise rejection:', reason);
  });
}

export default {
  log,
  setupLogging,
  LogLevel
};
