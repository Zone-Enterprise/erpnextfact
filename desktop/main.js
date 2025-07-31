// eslint-disable-next-line
require('source-map-support').install({
  handleUncaughtException: false,
  environment: 'node',
});

import { emitMainProcessError } from './main/helpers';
import {
  app,
  BrowserWindow,
  BrowserWindowConstructorOptions,
  dialog,
  ipcMain,
  protocol,
  ProtocolRequest,
  ProtocolResponse,
  shell,
  Menu,
} from 'electron';
import { autoUpdater } from 'electron-updater';
import fs from 'fs';
import path from 'path';
import { execSync, spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import Store from 'electron-store';
import registerAppLifecycleListeners from './main/registerAppLifecycleListeners';
import registerAutoUpdaterListeners from './main/registerAutoUpdaterListeners';
import registerIpcMainActionListeners from './main/registerIpcMainActionListeners';
import registerIpcMainMessageListeners from './main/registerIpcMainMessageListeners';
import registerProcessListeners from './main/registerProcessListeners';
import { setupLogging, log } from './main/logger';

// Define store schema for application settings
interface StoreSchema {
  serverPort: number;
  siteName: string;
  databaseType: 'mariadb' | 'sqlite';
  mariadbConfig?: {
    host: string;
    port: number;
    user: string;
    password: string;
  };
  autoStart: boolean;
  firstRun: boolean;
}

export class Main extends EventEmitter {
  title = 'ERPNext Desktop';
  icon: string;
  store: Store<StoreSchema>;
  // Expose ipcMain so other modules can attach handlers via `main.ipcMain`
  ipcMain = ipcMain;

  winURL = '';
  checkedForUpdate = false;
  mainWindow: BrowserWindow | null = null;
  splashWindow: BrowserWindow | null = null;
  
  // Server processes
  serverProcess: ChildProcess | null = null;
  mariadbProcess: ChildProcess | null = null;
  
  // Configuration
  serverPort = 8000;
  siteName = 'erpnext.localhost';
  databaseType: 'mariadb' | 'sqlite' = 'mariadb';
  serverReady = false;
  
  // Window dimensions
  WIDTH = 1280;
  HEIGHT = 800;

  constructor() {
    super();
    
    // Set up logging
    setupLogging();
    log.info('Starting ERPNext Desktop application');

    // Initialize store for settings
    this.store = new Store<StoreSchema>({
      defaults: {
        serverPort: 8000,
        siteName: 'erpnext.localhost',
        databaseType: 'mariadb',
        mariadbConfig: {
          host: 'localhost',
          port: 3306,
          user: 'root',
          password: 'erpnext',
        },
        autoStart: true,
        firstRun: true,
      },
    });

    // Load settings from store
    this.serverPort = this.store.get('serverPort');
    this.siteName = this.store.get('siteName');
    this.databaseType = this.store.get('databaseType');

    this.icon = this.isDevelopment
      ? path.resolve('./desktop/build/icon.png')
      : path.join(__dirname, 'icons', '512x512.png');

    protocol.registerSchemesAsPrivileged([
      { scheme: 'app', privileges: { secure: true, standard: true } },
    ]);

    if (this.isDevelopment) {
      autoUpdater.logger = console;
    }

    // https://github.com/electron-userland/electron-builder/issues/4987
    app.commandLine.appendSwitch('disable-http2');
    autoUpdater.requestHeaders = {
      'Cache-Control':
        'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    };

    this.registerListeners();
    if (this.isMac && this.isDevelopment) {
      app.dock.setIcon(this.icon);
    }

    // If on macOS register a basic dock menu
    if (this.isMac) {
      Menu.setApplicationMenu(this.getDockMenu());
    }
  }

  get isDevelopment() {
    return process.env.NODE_ENV === 'development';
  }

  get isTest() {
    return !!process.env.IS_TEST;
  }

  get isMac() {
    return process.platform === 'darwin';
  }

  get isLinux() {
    return process.platform === 'linux';
  }

  get isWindows() {
    return process.platform === 'win32';
  }

  get appDataPath() {
    return path.join(app.getPath('userData'), 'erpnext-data');
  }

  get configPath() {
    return path.join(this.appDataPath, 'config');
  }

  get benchPath() {
    return path.join(this.appDataPath, 'frappe-bench');
  }

  get databasePath() {
    return path.join(this.appDataPath, 'database');
  }

  /**
   * Placeholder that will be replaced by registerAutoUpdaterListeners.
   * Defined here to avoid type/runtime errors before replacement.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  registerUpdateHandlers(): void {
    /* no-op – replaced at runtime */
  }

  registerListeners() {
    registerIpcMainMessageListeners(this);
    registerIpcMainActionListeners(this);
    registerAutoUpdaterListeners(this);
    registerAppLifecycleListeners(this);
    registerProcessListeners(this);

    // Register custom IPC handlers for ERPNext-specific functionality
    ipcMain.handle('check-server-status', () => {
      return this.serverReady;
    });

    ipcMain.handle('restart-server', async () => {
      await this.restartServer();
      return true;
    });

    ipcMain.handle('update-database-config', async (_, config) => {
      this.store.set('databaseType', config.type);
      if (config.type === 'mariadb') {
        this.store.set('mariadbConfig', config.mariadb);
      }
      await this.restartServer();
      return true;
    });

    ipcMain.handle('open-external-url', (_, url) => {
      shell.openExternal(url);
      return true;
    });

    ipcMain.handle('show-open-dialog', async (_, options) => {
      const result = await dialog.showOpenDialog(options);
      return result;
    });

    ipcMain.handle('show-save-dialog', async (_, options) => {
      const result = await dialog.showSaveDialog(options);
      return result;
    });
  }

  /**
   * Create a basic dock menu (macOS only)
   */
  getDockMenu(): Menu {
    if (!this.isMac) {
      return Menu.buildFromTemplate([]);
    }

    return Menu.buildFromTemplate([
      {
        label: 'Show',
        click: () => {
          if (!this.mainWindow) return;
          if (this.mainWindow.isMinimized()) this.mainWindow.restore();
          this.mainWindow.focus();
        },
      },
      {
        label: 'Restart ERPNext Server',
        click: () => {
          this.restartServer().catch((err) => emitMainProcessError(err));
        },
      },
      { type: 'separator' },
      { role: 'quit' },
    ]);
  }

  /**
   * Helper to show error dialog consistently
   */
  showErrorDialog(title: string, message: string): void {
    dialog.showErrorBox(title, message);
  }

  /**
   * Execute a shell command and return stdout/stderr.
   * Used by IPC handlers for bench or other utilities.
   */
  async executeCommand(
    command: string,
    cwd?: string
  ): Promise<{ stdout: string; stderr: string }> {
    const exec = require('child_process').exec;
    return new Promise((resolve, reject) => {
      exec(
        command,
        { cwd, env: { ...process.env } },
        (error: Error | null, stdout: string, stderr: string) => {
          if (error) {
            reject(error);
            return;
          }
          resolve({ stdout, stderr });
        }
      );
    });
  }

  getOptions(): BrowserWindowConstructorOptions {
    const preload = path.join(__dirname, 'main', 'preload.js');
    const options: BrowserWindowConstructorOptions = {
      width: this.WIDTH,
      height: this.HEIGHT,
      title: this.title,
      titleBarStyle: 'hidden',
      trafficLightPosition: { x: 16, y: 16 },
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        preload,
        webSecurity: true,
        allowRunningInsecureContent: false,
      },
      autoHideMenuBar: true,
      frame: !this.isMac,
      resizable: true,
      show: false, // Don't show until ready-to-show
    };

    if (this.isDevelopment || this.isLinux) {
      Object.assign(options, { icon: this.icon });
    }

    if (this.isLinux) {
      Object.assign(options, {
        icon: path.join(__dirname, '/icons/512x512.png'),
      });
    }

    return options;
  }

  getSplashOptions(): BrowserWindowConstructorOptions {
    return {
      width: 500,
      height: 300,
      frame: false,
      transparent: true,
      resizable: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
      center: true,
      show: true,
    };
  }

  async createSplashWindow() {
    const options = this.getSplashOptions();
    this.splashWindow = new BrowserWindow(options);

    const splashPath = this.isDevelopment
      ? `file://${path.resolve('./desktop/src/splash.html')}`
      : `file://${path.join(__dirname, 'src', 'splash.html')}`;

    await this.splashWindow.loadURL(splashPath);
  }

  async createWindow() {
    // First show splash screen
    await this.createSplashWindow();

    // Start server in background
    await this.ensureDirectories();
    await this.startServer();

    const options = this.getOptions();
    this.mainWindow = new BrowserWindow(options);

    if (this.isDevelopment) {
      this.setViteServerURL();
    } else {
      this.registerAppProtocol();
    }

    // Set up loading URL
    const loadURL = this.serverReady 
      ? `http://localhost:${this.serverPort}`
      : this.winURL;

    await this.mainWindow.loadURL(loadURL);
    
    if (this.isDevelopment && !this.isTest) {
      this.mainWindow.webContents.openDevTools();
    }

    this.setMainWindowListeners();

    // Show window when ready
    this.mainWindow.once('ready-to-show', () => {
      if (!this.mainWindow) return;
      this.mainWindow.show();
      
      // Close splash screen
      if (this.splashWindow) {
        this.splashWindow.close();
        this.splashWindow = null;
      }
    });
  }

  setViteServerURL() {
    let port = 6969;
    let host = '0.0.0.0';

    if (process.env.VITE_PORT && process.env.VITE_HOST) {
      port = Number(process.env.VITE_PORT);
      host = process.env.VITE_HOST;
    }

    // Load the url of the dev server if in development mode
    this.winURL = `http://${host}:${port}/`;
  }

  registerAppProtocol() {
    protocol.registerBufferProtocol('app', bufferProtocolCallback);

    // Use the registered protocol url to load the files.
    this.winURL = 'app://./index.html';
  }

  setMainWindowListeners() {
    if (this.mainWindow === null) {
      return;
    }

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    this.mainWindow.webContents.on('did-fail-load', () => {
      if (!this.mainWindow) return;
      
      // If server is ready but page failed to load, try the server URL
      if (this.serverReady) {
        this.mainWindow.loadURL(`http://localhost:${this.serverPort}`).catch((err) =>
          emitMainProcessError(err)
        );
      } else {
        // Otherwise load the fallback URL
        this.mainWindow.loadURL(this.winURL).catch((err) =>
          emitMainProcessError(err)
        );
      }
    });
  }

  async ensureDirectories() {
    // Create necessary directories if they don't exist
    const directories = [
      this.appDataPath,
      this.configPath,
      this.databasePath,
    ];

    for (const dir of directories) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    // Check if this is first run
    const firstRun = this.store.get('firstRun');
    if (firstRun) {
      log.info('First run detected, setting up ERPNext environment');
      await this.setupERPNextEnvironment();
      this.store.set('firstRun', false);
    }
  }

  async setupERPNextEnvironment() {
    try {
      // Update splash screen status if available
      if (this.splashWindow) {
        this.splashWindow.webContents.send('update-status', 'Setting up ERPNext environment...');
      }

      // Check if bench directory exists
      if (!fs.existsSync(this.benchPath)) {
        // Copy bench files from resources
        const resourcePath = this.isDevelopment
          ? path.resolve('./desktop/assets/bench-template')
          : path.join(process.resourcesPath, 'assets', 'bench-template');

        // Use fs-extra to copy directory recursively
        const fse = require('fs-extra');
        await fse.copy(resourcePath, this.benchPath);
      }

      // Initialize database based on selected type
      if (this.databaseType === 'mariadb') {
        await this.setupMariaDB();
      } else {
        await this.setupSQLite();
      }

      log.info('ERPNext environment setup complete');
    } catch (error) {
      log.error('Error setting up ERPNext environment:', error);
      dialog.showErrorBox(
        'Setup Error',
        `Failed to set up ERPNext environment: ${error.message}`
      );
    }
  }

  async setupMariaDB() {
    // Check if MariaDB is installed or use embedded version
    const mariadbConfig = this.store.get('mariadbConfig');
    
    try {
      if (this.isWindows) {
        // For Windows, start embedded MariaDB
        const mariadbPath = this.isDevelopment
          ? path.resolve('./desktop/assets/mariadb')
          : path.join(process.resourcesPath, 'assets', 'mariadb');
        
        const dataDir = path.join(this.databasePath, 'mariadb-data');
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }

        // Initialize MariaDB if needed
        if (!fs.existsSync(path.join(dataDir, 'ibdata1'))) {
          execSync(`"${path.join(mariadbPath, 'bin', 'mysql_install_db.exe')}" --datadir="${dataDir}"`);
        }

        // Start MariaDB server
        this.mariadbProcess = spawn(
          path.join(mariadbPath, 'bin', 'mysqld.exe'),
          [
            `--datadir=${dataDir}`,
            `--port=${mariadbConfig.port}`,
            '--console',
            '--innodb-flush-method=normal',
          ],
          { stdio: 'pipe' }
        );

        this.mariadbProcess.stdout?.on('data', (data) => {
          log.info(`MariaDB: ${data.toString()}`);
        });

        this.mariadbProcess.stderr?.on('data', (data) => {
          log.error(`MariaDB Error: ${data.toString()}`);
        });
      } else {
        // For Mac/Linux, check if MariaDB is installed
        try {
          execSync('mysql --version');
          log.info('MariaDB/MySQL is installed on the system');
        } catch (error) {
          log.error('MariaDB/MySQL is not installed:', error);
          dialog.showErrorBox(
            'Database Error',
            'MariaDB/MySQL is not installed on your system. Please install it or select SQLite database option.'
          );
          // Switch to SQLite as fallback
          this.store.set('databaseType', 'sqlite');
          await this.setupSQLite();
          return;
        }
      }
    } catch (error) {
      log.error('Error setting up MariaDB:', error);
      dialog.showErrorBox(
        'Database Error',
        `Failed to set up MariaDB: ${error.message}`
      );
    }
  }

  async setupSQLite() {
    try {
      // SQLite setup is simpler, just ensure the directory exists
      const sqliteDir = path.join(this.databasePath, 'sqlite');
      if (!fs.existsSync(sqliteDir)) {
        fs.mkdirSync(sqliteDir, { recursive: true });
      }
      
      log.info('SQLite database directory created');
    } catch (error) {
      log.error('Error setting up SQLite:', error);
      dialog.showErrorBox(
        'Database Error',
        `Failed to set up SQLite: ${error.message}`
      );
    }
  }

  async startServer() {
    try {
      // Update splash screen status if available
      if (this.splashWindow) {
        this.splashWindow.webContents.send('update-status', 'Starting ERPNext server...');
      }
      
      // Check if bench directory exists
      if (!fs.existsSync(this.benchPath)) {
        throw new Error('ERPNext bench directory not found');
      }

      // Start server based on platform
      if (this.isWindows) {
        this.serverProcess = spawn(
          'cmd.exe',
          ['/c', 'bench', 'start', '--no-browser', `--port=${this.serverPort}`],
          {
            cwd: this.benchPath,
            env: { ...process.env, NODE_ENV: 'production' },
            stdio: 'pipe',
          }
        );
      } else {
        this.serverProcess = spawn(
          'bench',
          ['start', '--no-browser', `--port=${this.serverPort}`],
          {
            cwd: this.benchPath,
            env: { ...process.env, NODE_ENV: 'production' },
            stdio: 'pipe',
          }
        );
      }

      // Handle server output
      this.serverProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        log.info(`Server: ${output}`);
        
        // Check if server is ready
        if (output.includes('Starting Frappe web server')) {
          this.serverReady = true;
          this.emit('server-ready');
          
          // Update splash screen status if available
          if (this.splashWindow) {
            this.splashWindow.webContents.send('update-status', 'ERPNext server is ready!');
          }
          
          // If main window exists, load the ERPNext URL
          if (this.mainWindow) {
            this.mainWindow.loadURL(`http://localhost:${this.serverPort}`);
          }
        }
      });

      this.serverProcess.stderr?.on('data', (data) => {
        log.error(`Server Error: ${data.toString()}`);
      });

      this.serverProcess.on('close', (code) => {
        log.info(`Server process exited with code ${code}`);
        this.serverReady = false;
        this.serverProcess = null;
      });

      // Set a timeout to check if server starts successfully
      setTimeout(() => {
        if (!this.serverReady) {
          log.warn('Server did not start within expected time');
          if (this.splashWindow) {
            this.splashWindow.webContents.send('update-status', 'Server startup delayed, please wait...');
          }
        }
      }, 30000); // 30 seconds timeout

    } catch (error) {
      log.error('Error starting server:', error);
      dialog.showErrorBox(
        'Server Error',
        `Failed to start ERPNext server: ${error.message}`
      );
    }
  }

  async restartServer() {
    log.info('Restarting server...');
    
    // Stop current server
    await this.stopServer();
    
    // Start server again
    await this.startServer();
    
    return true;
  }

  async stopServer() {
    // Stop server process if running
    if (this.serverProcess) {
      log.info('Stopping server process...');
      
      // Different termination based on platform
      if (this.isWindows) {
        // On Windows, we need to kill the process tree
        try {
          execSync(`taskkill /pid ${this.serverProcess.pid} /T /F`);
        } catch (error) {
          log.error('Error killing server process:', error);
        }
      } else {
        // On Mac/Linux, we can use process.kill
        this.serverProcess.kill('SIGTERM');
      }
      
      this.serverProcess = null;
    }
    
    // Stop MariaDB process if running
    if (this.mariadbProcess) {
      log.info('Stopping MariaDB process...');
      
      if (this.isWindows) {
        try {
          execSync(`taskkill /pid ${this.mariadbProcess.pid} /T /F`);
        } catch (error) {
          log.error('Error killing MariaDB process:', error);
        }
      } else {
        this.mariadbProcess.kill('SIGTERM');
      }
      
      this.mariadbProcess = null;
    }
    
    this.serverReady = false;
  }

  async cleanup() {
    log.info('Cleaning up before exit...');
    await this.stopServer();
  }
}

/**
 * Callback used to register the custom app protocol,
 * during prod, files are read and served by using this
 * protocol.
 */
function bufferProtocolCallback(
  request: ProtocolRequest,
  callback: (response: ProtocolResponse) => void
) {
  const { pathname, host } = new URL(request.url);
  const filePath = path.join(
    __dirname,
    'src',
    decodeURI(host),
    decodeURI(pathname)
  );

  fs.readFile(filePath, (_, data) => {
    const extension = path.extname(filePath).toLowerCase();
    const mimeType =
      {
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.html': 'text/html',
        '.svg': 'image/svg+xml',
        '.json': 'application/json',
      }[extension] ?? '';

    callback({ mimeType, data });
  });
}

export default new Main();
