import { app, BrowserWindow, dialog, shell, ipcMain } from 'electron';
import { Main } from '../main';
import { log } from './logger';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Registers all IPC main action listeners for handling renderer process requests
 * @param main - The main application instance
 */
export default function registerIpcMainActionListeners(main: Main): void {
  log.info('Registering IPC main action listeners');

  // Window management actions
  ipcMain.handle('window-minimize', () => {
    const window = BrowserWindow.getFocusedWindow();
    if (window) {
      window.minimize();
      return true;
    }
    return false;
  });

  ipcMain.handle('window-maximize', () => {
    const window = BrowserWindow.getFocusedWindow();
    if (window) {
      if (window.isMaximized()) {
        window.unmaximize();
      } else {
        window.maximize();
      }
      return window.isMaximized();
    }
    return false;
  });

  ipcMain.handle('window-close', () => {
    const window = BrowserWindow.getFocusedWindow();
    if (window) {
      window.close();
      return true;
    }
    return false;
  });

  ipcMain.handle('window-is-maximized', () => {
    const window = BrowserWindow.getFocusedWindow();
    return window ? window.isMaximized() : false;
  });

  // Settings management actions
  ipcMain.handle('settings-get-all', () => {
    try {
      return main.store.store;
    } catch (error) {
      log.error('Error getting all settings:', error);
      throw new Error('Failed to get settings');
    }
  });

  ipcMain.handle('settings-get', (_, key: string) => {
    try {
      return main.store.get(key);
    } catch (error) {
      log.error(`Error getting setting "${key}":`, error);
      throw new Error(`Failed to get setting: ${key}`);
    }
  });

  ipcMain.handle('settings-set', (_, key: string, value: any) => {
    try {
      main.store.set(key, value);
      return true;
    } catch (error) {
      log.error(`Error setting "${key}":`, error);
      throw new Error(`Failed to set setting: ${key}`);
    }
  });

  ipcMain.handle('settings-delete', (_, key: string) => {
    try {
      main.store.delete(key);
      return true;
    } catch (error) {
      log.error(`Error deleting setting "${key}":`, error);
      throw new Error(`Failed to delete setting: ${key}`);
    }
  });

  // App information actions
  ipcMain.handle('app-version', () => {
    return app.getVersion();
  });

  ipcMain.handle('app-name', () => {
    return app.getName();
  });

  ipcMain.handle('app-restart', async () => {
    try {
      await main.cleanup();
      app.relaunch();
      app.exit(0);
      return true;
    } catch (error) {
      log.error('Error restarting app:', error);
      throw new Error('Failed to restart application');
    }
  });

  ipcMain.handle('app-quit', async () => {
    try {
      await main.cleanup();
      app.quit();
      return true;
    } catch (error) {
      log.error('Error quitting app:', error);
      throw new Error('Failed to quit application');
    }
  });

  // Database operations
  ipcMain.handle('database-check-mariadb', async () => {
    try {
      // Check if MariaDB is installed and accessible
      if (main.isWindows) {
        // For Windows, check embedded MariaDB
        const mariadbPath = main.isDevelopment
          ? path.resolve('./desktop/assets/mariadb')
          : path.join(process.resourcesPath, 'assets', 'mariadb');
        
        return fs.existsSync(path.join(mariadbPath, 'bin', 'mysqld.exe'));
      } else {
        // For Mac/Linux, check system MariaDB
        try {
          await execAsync('mysql --version');
          return true;
        } catch (error) {
          return false;
        }
      }
    } catch (error) {
      log.error('Error checking MariaDB:', error);
      return false;
    }
  });

  ipcMain.handle('database-test-connection', async (_, config: any) => {
    try {
      if (config.type === 'mariadb') {
        const { host, port, user, password } = config.mariadb;
        try {
          await execAsync(
            `mysql -h${host} -P${port} -u${user} -p${password} -e "SELECT 1"`
          );
          return { success: true };
        } catch (error) {
          log.error('MariaDB connection test failed:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          };
        }
      } else if (config.type === 'sqlite') {
        // For SQLite, just check if the directory is writable
        const sqliteDir = path.join(main.databasePath, 'sqlite');
        try {
          if (!fs.existsSync(sqliteDir)) {
            fs.mkdirSync(sqliteDir, { recursive: true });
          }
          const testFile = path.join(sqliteDir, 'test-write.tmp');
          fs.writeFileSync(testFile, 'test');
          fs.unlinkSync(testFile);
          return { success: true };
        } catch (error) {
          log.error('SQLite test failed:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          };
        }
      }
      
      return { success: false, error: 'Invalid database type' };
    } catch (error) {
      log.error('Error testing database connection:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  // Server management
  ipcMain.handle('check-server-status', () => {
    return main.serverReady;
  });

  ipcMain.handle('restart-server', async () => {
    try {
      await main.restartServer();
      return true;
    } catch (error) {
      log.error('Error restarting server:', error);
      throw new Error('Failed to restart server');
    }
  });

  ipcMain.handle('get-server-port', () => {
    return main.serverPort;
  });

  ipcMain.handle('get-site-name', () => {
    return main.siteName;
  });

  ipcMain.handle('update-database-config', async (_, config) => {
    try {
      main.store.set('databaseType', config.type);
      if (config.type === 'mariadb') {
        main.store.set('mariadbConfig', config.mariadb);
      }
      
      // Update instance variables
      main.databaseType = config.type;
      
      // Restart server with new configuration
      await main.restartServer();
      return true;
    } catch (error) {
      log.error('Error updating database config:', error);
      throw new Error('Failed to update database configuration');
    }
  });

  // File dialogs and external URLs
  ipcMain.handle('show-open-dialog', async (_, options) => {
    try {
      return await dialog.showOpenDialog(options);
    } catch (error) {
      log.error('Error showing open dialog:', error);
      throw new Error('Failed to show open dialog');
    }
  });

  ipcMain.handle('show-save-dialog', async (_, options) => {
    try {
      return await dialog.showSaveDialog(options);
    } catch (error) {
      log.error('Error showing save dialog:', error);
      throw new Error('Failed to show save dialog');
    }
  });

  ipcMain.handle('open-external-url', async (_, url: string) => {
    try {
      // Validate URL for security
      const validUrl = new URL(url);
      if (!['http:', 'https:'].includes(validUrl.protocol)) {
        throw new Error('Invalid URL protocol');
      }
      
      await shell.openExternal(url);
      return true;
    } catch (error) {
      log.error('Error opening external URL:', error);
      throw new Error('Failed to open external URL');
    }
  });

  // File system operations
  ipcMain.handle('get-app-paths', () => {
    return {
      userData: app.getPath('userData'),
      appData: app.getPath('appData'),
      desktop: app.getPath('desktop'),
      documents: app.getPath('documents'),
      downloads: app.getPath('downloads'),
      temp: app.getPath('temp'),
      home: app.getPath('home'),
      logs: app.getPath('logs'),
      benchPath: main.benchPath,
      databasePath: main.databasePath,
      configPath: main.configPath
    };
  });

  ipcMain.handle('check-path-exists', (_, filePath: string) => {
    try {
      return fs.existsSync(filePath);
    } catch (error) {
      log.error('Error checking path exists:', error);
      return false;
    }
  });

  log.info('IPC main action listeners registered successfully');
}
