import { app, dialog, BrowserWindow, ipcMain } from 'electron';
import { ChildProcess, spawn, exec, ExecOptions } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as net from 'net';
import { promisify } from 'util';
import { log } from './logger';

const execAsync = promisify(exec);
const fsExists = promisify(fs.exists);
const fsReadFile = promisify(fs.readFile);
const fsWriteFile = promisify(fs.writeFile);
const fsMkdir = promisify(fs.mkdir);

/**
 * Error handling and emitting
 */

/**
 * Emits an error from the main process to all renderer processes
 * @param error - The error to emit
 */
export function emitMainProcessError(error: Error | string): void {
  log.error('Main process error:', error);
  
  const errorMessage = error instanceof Error ? 
    { message: error.message, stack: error.stack } : 
    { message: error, stack: null };
  
  // Send to all renderer processes
  BrowserWindow.getAllWindows().forEach(window => {
    if (!window.isDestroyed()) {
      window.webContents.send('main-process-error', errorMessage);
    }
  });
}

/**
 * Shows an error dialog with the given error message
 * @param title - The title of the error dialog
 * @param error - The error to display
 */
export function showErrorDialog(title: string, error: Error | string): void {
  const message = error instanceof Error ? error.message : error;
  
  log.error(`${title}: ${message}`);
  
  dialog.showErrorBox(title, message);
}

/**
 * Handles uncaught exceptions in the main process
 * @param error - The uncaught exception
 */
export function handleUncaughtException(error: Error): void {
  log.error('Uncaught exception in main process:', error);
  
  // Show error dialog only if app is ready
  if (app.isReady()) {
    dialog.showErrorBox(
      'Unexpected Error',
      `An unexpected error occurred: ${error.message}\n\nThe application may not function correctly.`
    );
  }
  
  // Emit to renderer
  emitMainProcessError(error);
}

/**
 * Server startup verification
 */

/**
 * Checks if a port is available
 * @param port - The port to check
 * @returns Promise that resolves to true if port is available, false otherwise
 */
export async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    
    server.once('error', () => {
      resolve(false);
    });
    
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    
    server.listen(port);
  });
}

/**
 * Waits for a server to be available on the given port
 * @param port - The port to check
 * @param timeout - Timeout in milliseconds
 * @param interval - Check interval in milliseconds
 * @returns Promise that resolves when server is available or rejects on timeout
 */
export async function waitForServer(
  port: number,
  timeout = 60000,
  interval = 1000
): Promise<void> {
  const startTime = Date.now();
  
  return new Promise((resolve, reject) => {
    const check = () => {
      const client = net.connect(port, '127.0.0.1');
      
      client.on('connect', () => {
        client.end();
        resolve();
      });
      
      client.on('error', () => {
        // Check if we've exceeded the timeout
        if (Date.now() - startTime > timeout) {
          reject(new Error(`Server did not start on port ${port} within ${timeout}ms`));
          return;
        }
        
        // Try again after interval
        setTimeout(check, interval);
      });
    };
    
    check();
  });
}

/**
 * Checks if a URL is reachable
 * @param url - The URL to check
 * @param timeout - Timeout in milliseconds
 * @returns Promise that resolves to true if URL is reachable, false otherwise
 */
export async function isUrlReachable(url: string, timeout = 5000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    return response.status >= 200 && response.status < 300;
  } catch (error) {
    return false;
  }
}

/**
 * Database connection checks
 */

/**
 * Checks if MariaDB/MySQL is installed and accessible
 * @returns Promise that resolves to true if MariaDB is accessible, false otherwise
 */
export async function checkMariaDBInstallation(): Promise<boolean> {
  try {
    await execAsync('mysql --version');
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Tests a MariaDB connection with the given credentials
 * @param config - MariaDB connection configuration
 * @returns Promise that resolves to true if connection is successful, false otherwise
 */
export async function testMariaDBConnection(config: {
  host: string;
  port: number;
  user: string;
  password: string;
}): Promise<boolean> {
  const { host, port, user, password } = config;
  
  try {
    await execAsync(
      `mysql -h${host} -P${port} -u${user} -p${password} -e "SELECT 1"`
    );
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Checks if SQLite is installed and accessible
 * @returns Promise that resolves to true if SQLite is accessible, false otherwise
 */
export async function checkSQLiteInstallation(): Promise<boolean> {
  try {
    await execAsync('sqlite3 --version');
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Tests if a SQLite database file is valid and accessible
 * @param dbPath - Path to SQLite database file
 * @returns Promise that resolves to true if database is valid, false otherwise
 */
export async function testSQLiteDatabase(dbPath: string): Promise<boolean> {
  try {
    // Check if file exists
    if (!await fsExists(dbPath)) {
      return false;
    }
    
    // Try to run a simple query
    await execAsync(`sqlite3 "${dbPath}" "SELECT 1"`);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Platform-specific utilities
 */

/**
 * Gets the platform-specific path separator
 * @returns Path separator for current platform
 */
export function getPathSeparator(): string {
  return path.sep;
}

/**
 * Gets the platform-specific line ending
 * @returns Line ending for current platform
 */
export function getLineEnding(): string {
  return process.platform === 'win32' ? '\r\n' : '\n';
}

/**
 * Gets the platform-specific shell
 * @returns Shell command for current platform
 */
export function getShell(): string {
  return process.platform === 'win32' ? 'cmd.exe' : '/bin/bash';
}

/**
 * Gets the platform-specific shell arguments
 * @returns Shell arguments for current platform
 */
export function getShellArgs(): string[] {
  return process.platform === 'win32' ? ['/c'] : ['-c'];
}

/**
 * Determines if the app is running in portable mode
 * @returns True if running in portable mode, false otherwise
 */
export function isPortableMode(): boolean {
  // Check for portable flag file
  const portableFlagPath = path.join(
    path.dirname(app.getPath('exe')),
    'portable-data'
  );
  
  return fs.existsSync(portableFlagPath);
}

/**
 * Gets the appropriate app data path based on mode (portable vs installed)
 * @returns Path to app data directory
 */
export function getAppDataPath(): string {
  if (isPortableMode()) {
    return path.join(
      path.dirname(app.getPath('exe')),
      'portable-data'
    );
  }
  
  return app.getPath('userData');
}

/**
 * Path and file system helpers
 */

/**
 * Ensures a directory exists, creating it if necessary
 * @param dirPath - Path to directory
 * @returns Promise that resolves when directory exists
 */
export async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fsMkdir(dirPath, { recursive: true });
  } catch (error: any) {
    // Ignore error if directory already exists
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
}

/**
 * Reads a JSON file and parses its contents
 * @param filePath - Path to JSON file
 * @returns Promise that resolves to parsed JSON object
 */
export async function readJsonFile<T>(filePath: string): Promise<T> {
  const data = await fsReadFile(filePath, 'utf8');
  return JSON.parse(data) as T;
}

/**
 * Writes an object to a JSON file
 * @param filePath - Path to JSON file
 * @param data - Data to write
 * @returns Promise that resolves when file is written
 */
export async function writeJsonFile<T>(filePath: string, data: T): Promise<void> {
  const json = JSON.stringify(data, null, 2);
  await ensureDir(path.dirname(filePath));
  await fsWriteFile(filePath, json, 'utf8');
}

/**
 * Gets a temporary file path with the given prefix and extension
 * @param prefix - File name prefix
 * @param extension - File extension (without dot)
 * @returns Path to temporary file
 */
export function getTempFilePath(prefix: string, extension: string): string {
  const tempDir = app.getPath('temp');
  const fileName = `${prefix}-${Date.now()}.${extension}`;
  return path.join(tempDir, fileName);
}

/**
 * Process management utilities
 */

/**
 * Executes a command and returns its output
 * @param command - Command to execute
 * @param options - Execution options
 * @returns Promise that resolves to command output
 */
export async function executeCommand(
  command: string,
  options: ExecOptions = {}
): Promise<{ stdout: string; stderr: string }> {
  try {
    return await execAsync(command, options);
  } catch (error: any) {
    if (error.stdout || error.stderr) {
      return {
        stdout: error.stdout,
        stderr: error.stderr
      };
    }
    throw error;
  }
}

/**
 * Spawns a detached process that will continue running after parent exits
 * @param command - Command to run
 * @param args - Command arguments
 * @param options - Spawn options
 * @returns Process ID of spawned process
 */
export function spawnDetached(
  command: string,
  args: string[] = [],
  options: any = {}
): number {
  const proc = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
    ...options
  });
  
  proc.unref();
  return proc.pid!;
}

/**
 * Kills a process and all its children
 * @param pid - Process ID to kill
 * @returns Promise that resolves when process is killed
 */
export async function killProcess(pid: number): Promise<void> {
  if (process.platform === 'win32') {
    try {
      await execAsync(`taskkill /pid ${pid} /T /F`);
    } catch (error) {
      // Ignore errors if process is already gone
      log.warn(`Error killing process ${pid}:`, error);
    }
  } else {
    try {
      process.kill(pid, 'SIGKILL');
    } catch (error) {
      // Ignore errors if process is already gone
      log.warn(`Error killing process ${pid}:`, error);
    }
  }
}

/**
 * Checks if a process with the given ID is running
 * @param pid - Process ID to check
 * @returns Promise that resolves to true if process is running, false otherwise
 */
export async function isProcessRunning(pid: number): Promise<boolean> {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Finds processes by name
 * @param name - Process name to find
 * @returns Promise that resolves to array of process IDs
 */
export async function findProcessesByName(name: string): Promise<number[]> {
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execAsync(`tasklist /FI "IMAGENAME eq ${name}" /NH /FO CSV`);
      
      return stdout
        .split('\n')
        .filter(line => line.includes(name))
        .map(line => {
          const match = line.match(/"[^"]+","([^"]+)"/);
          return match ? parseInt(match[1], 10) : 0;
        })
        .filter(pid => pid > 0);
    } else {
      const { stdout } = await execAsync(`pgrep -f ${name}`);
      
      return stdout
        .split('\n')
        .filter(Boolean)
        .map(pid => parseInt(pid, 10));
    }
  } catch (error) {
    // No processes found or command failed
    return [];
  }
}

/**
 * Gets system resource usage
 * @returns Object with CPU and memory usage information
 */
export function getSystemResourceUsage(): {
  cpuUsage: NodeJS.CpuUsage;
  memoryUsage: NodeJS.MemoryUsage;
  systemFreeMem: number;
  systemTotalMem: number;
} {
  return {
    cpuUsage: process.cpuUsage(),
    memoryUsage: process.memoryUsage(),
    systemFreeMem: os.freemem(),
    systemTotalMem: os.totalmem()
  };
}

/**
 * Gets information about the current process
 * @returns Object with process information
 */
export function getProcessInfo(): {
  pid: number;
  ppid: number;
  title: string;
  arch: string;
  platform: string;
  version: string;
  execPath: string;
} {
  return {
    pid: process.pid,
    ppid: process.ppid,
    title: process.title,
    arch: process.arch,
    platform: process.platform,
    version: process.version,
    execPath: process.execPath
  };
}
