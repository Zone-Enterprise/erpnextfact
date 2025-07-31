import { ipcMain, BrowserWindow, WebContents } from 'electron';
import { Main } from '../main';
import { log, LogLevel } from './logger';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Registers all IPC main message listeners for communication between main and renderer processes
 * @param main - The main application instance
 */
export default function registerIpcMainMessageListeners(main: Main): void {
  log.info('Registering IPC main message listeners');

  // ==============================
  // 1. Log messages from renderer
  // ==============================
  
  // Handle log messages from renderer process
  ipcMain.on('renderer-log', (_, level: string, message: string, data?: any) => {
    // Map string level to LogLevel enum
    let logLevel: LogLevel;
    switch (level.toLowerCase()) {
      case 'debug':
        logLevel = LogLevel.DEBUG;
        break;
      case 'info':
        logLevel = LogLevel.INFO;
        break;
      case 'warn':
        logLevel = LogLevel.WARN;
        break;
      case 'error':
        logLevel = LogLevel.ERROR;
        break;
      default:
        logLevel = LogLevel.INFO;
    }
    
    // Log the message using the main process logger
    log.log(logLevel, `[Renderer] ${message}`, data);
  });
  
  // Provide direct methods for each log level
  ipcMain.on('renderer-log-debug', (_, message: string, data?: any) => {
    log.debug(`[Renderer] ${message}`, data);
  });
  
  ipcMain.on('renderer-log-info', (_, message: string, data?: any) => {
    log.info(`[Renderer] ${message}`, data);
  });
  
  ipcMain.on('renderer-log-warn', (_, message: string, data?: any) => {
    log.warn(`[Renderer] ${message}`, data);
  });
  
  ipcMain.on('renderer-log-error', (_, message: string, data?: any) => {
    log.error(`[Renderer] ${message}`, data);
  });

  // ==============================
  // 2. Server status updates
  // ==============================
  
  // Listen for server status changes from the main process
  main.on('server-ready', () => {
    log.info('Server is ready, notifying renderer');
    broadcastToAllWindows('server-status', { status: 'ready', port: main.serverPort });
  });
  
  // Handle server status requests from renderer
  ipcMain.on('request-server-status', (event) => {
    event.reply('server-status', {
      status: main.serverReady ? 'ready' : 'starting',
      port: main.serverPort
    });
  });
  
  // Listen for server events from the main process
  main.serverProcess?.stdout?.on('data', (data) => {
    const output = data.toString();
    broadcastToAllWindows('server-output', { type: 'stdout', data: output });
  });
  
  main.serverProcess?.stderr?.on('data', (data) => {
    const output = data.toString();
    broadcastToAllWindows('server-output', { type: 'stderr', data: output });
  });
  
  // Handle manual server restart requests from renderer
  ipcMain.on('restart-server-request', async (event) => {
    try {
      log.info('Server restart requested from renderer');
      event.reply('server-status', { status: 'restarting' });
      
      await main.restartServer();
      
      event.reply('server-status', {
        status: main.serverReady ? 'ready' : 'starting',
        port: main.serverPort
      });
    } catch (error) {
      log.error('Error restarting server:', error);
      event.reply('server-error', {
        message: 'Failed to restart server',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // ==============================
  // 3. Progress updates
  // ==============================
  
  // Handle progress updates for long-running operations
  ipcMain.on('progress-update', (_, operation: string, progress: number, detail?: string) => {
    log.debug(`Progress update for ${operation}: ${progress}%${detail ? ` - ${detail}` : ''}`);
    
    // Broadcast progress to all windows
    broadcastToAllWindows('progress-update', {
      operation,
      progress,
      detail
    });
    
    // Update splash screen if available and operation is startup
    if (operation === 'startup' && main.splashWindow && !main.splashWindow.isDestroyed()) {
      main.splashWindow.webContents.send('update-status', detail || `Starting... ${progress}%`);
    }
  });
  
  // Register operation start
  ipcMain.on('operation-started', (_, operation: string, details?: any) => {
    log.info(`Operation started: ${operation}`, details);
    broadcastToAllWindows('operation-status', {
      operation,
      status: 'started',
      details
    });
  });
  
  // Register operation completion
  ipcMain.on('operation-completed', (_, operation: string, result?: any) => {
    log.info(`Operation completed: ${operation}`, result);
    broadcastToAllWindows('operation-status', {
      operation,
      status: 'completed',
      result
    });
  });

  // ==============================
  // 4. Error reporting
  // ==============================
  
  // Handle error reporting from renderer
  ipcMain.on('renderer-error', (_, error: any) => {
    // Log the error
    log.error('Error reported from renderer:', error);
    
    // Broadcast error to all windows
    broadcastToAllWindows('main-process-error', {
      source: 'renderer',
      error: error instanceof Error ? 
        { message: error.message, stack: error.stack } : 
        { message: String(error) }
    });
  });
  
  // Handle uncaught exceptions from renderer
  ipcMain.on('renderer-uncaught-exception', (_, error: any) => {
    log.error('Uncaught exception in renderer:', error);
    
    // Optionally show dialog for critical errors
    if (error?.isCritical) {
      main.showErrorDialog('Application Error', error.message || 'An unknown error occurred');
    }
  });
  
  // Handle unhandled promise rejections from renderer
  ipcMain.on('renderer-unhandled-rejection', (_, reason: any) => {
    log.error('Unhandled promise rejection in renderer:', reason);
  });

  // ==============================
  // 5. Custom event handling
  // ==============================
  
  // Generic event relay system
  // This allows renderer processes to communicate with each other via the main process
  ipcMain.on('relay-event', (event, channel: string, ...args: any[]) => {
    // Log the relayed event
    log.debug(`Relaying event: ${channel}`, args);
    
    // Get sender ID to avoid echoing back to sender
    const senderId = event.sender.id;
    
    // Broadcast to all windows except sender
    BrowserWindow.getAllWindows().forEach(window => {
      if (!window.isDestroyed() && window.webContents.id !== senderId) {
        window.webContents.send(channel, ...args);
      }
    });
  });
  
  // Custom application events
  
  // Database connection status
  ipcMain.on('database-status-change', (_, status: string, details?: any) => {
    log.info(`Database status changed to ${status}`, details);
    broadcastToAllWindows('database-status', { status, details });
  });
  
  // User authentication events
  ipcMain.on('user-logged-in', (_, userData: any) => {
    log.info('User logged in', { userId: userData.userId, username: userData.username });
    
    // Store last logged in user
    main.store.set('lastUser', {
      userId: userData.userId,
      username: userData.username,
      timestamp: Date.now()
    });
    
    broadcastToAllWindows('user-auth-change', { status: 'logged-in', user: userData });
  });
  
  ipcMain.on('user-logged-out', () => {
    log.info('User logged out');
    broadcastToAllWindows('user-auth-change', { status: 'logged-out' });
  });
  
  // System notifications
  ipcMain.on('show-notification', (_, options: { title: string, body: string }) => {
    log.debug('Showing notification', options);
    
    // Get focused window
    const focusedWindow = BrowserWindow.getFocusedWindow();
    
    if (focusedWindow && !focusedWindow.isDestroyed()) {
      focusedWindow.webContents.send('show-notification', options);
    } else {
      // If no focused window, send to all windows
      broadcastToAllWindows('show-notification', options);
    }
  });
  
  // Custom command execution
  ipcMain.handle('execute-custom-command', async (_, command: string, args: string[]) => {
    log.info(`Executing custom command: ${command}`, { args });
    
    try {
      // Validate command for security
      if (!isValidCustomCommand(command)) {
        throw new Error(`Invalid custom command: ${command}`);
      }
      
      // Execute command based on type
      if (command === 'check-bench-version') {
        return await main.executeCommand('bench --version', main.benchPath);
      } else if (command === 'list-sites') {
        return await main.executeCommand('bench list-sites', main.benchPath);
      } else if (command === 'get-app-versions') {
        return await main.executeCommand('bench version', main.benchPath);
      }
      
      throw new Error(`Unknown command: ${command}`);
    } catch (error) {
      log.error(`Error executing custom command ${command}:`, error);
      throw error;
    }
  });

  log.info('IPC main message listeners registered successfully');
}

/**
 * Broadcasts a message to all open windows
 * @param channel - The channel to send on
 * @param data - The data to send
 */
function broadcastToAllWindows(channel: string, data: any): void {
  BrowserWindow.getAllWindows().forEach(window => {
    if (!window.isDestroyed()) {
      window.webContents.send(channel, data);
    }
  });
}

/**
 * Validates if a custom command is allowed for security
 * @param command - The command to validate
 * @returns Whether the command is valid
 */
function isValidCustomCommand(command: string): boolean {
  // Whitelist of allowed commands
  const allowedCommands = [
    'check-bench-version',
    'list-sites',
    'get-app-versions'
  ];
  
  return allowedCommands.includes(command);
}
