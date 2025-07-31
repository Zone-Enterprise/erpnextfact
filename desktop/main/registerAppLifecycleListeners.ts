import { app, BrowserWindow, dialog, shell } from 'electron';
import { Main } from '../main';
import { log } from './logger';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Registers all application lifecycle event listeners
 * @param main - The main application instance
 */
export default function registerAppLifecycleListeners(main: Main): void {
  log.info('Registering app lifecycle listeners');

  // App ready event
  // This is called when Electron has finished initialization
  if (app.isReady()) {
    log.info('App is already ready, creating window');
    main.createWindow().catch(err => {
      log.error('Failed to create window:', err);
    });
  } else {
    app.on('ready', async () => {
      log.info('App ready event triggered');
      
      try {
        // Create main application window
        await main.createWindow();
      } catch (error) {
        log.error('Error during app ready:', error);
        dialog.showErrorBox(
          'Startup Error',
          `Failed to start application: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  // Window all closed event
  // This is called when all windows have been closed
  app.on('window-all-closed', () => {
    log.info('All windows closed event triggered');
    
    // On macOS applications keep their process running until the user quits
    // explicitly with Cmd + Q
    if (!main.isMac) {
      log.info('Not on macOS, quitting application');
      app.quit();
    } else {
      log.info('On macOS, keeping application running');
    }
  });

  // App activate event (macOS specific)
  // This is called when the application is activated (clicked on dock)
  app.on('activate', async () => {
    log.info('App activate event triggered');
    
    // On macOS it's common to re-create a window when the dock icon is clicked
    // and there are no other windows open
    if (BrowserWindow.getAllWindows().length === 0) {
      log.info('No windows open, creating new window');
      try {
        await main.createWindow();
      } catch (error) {
        log.error('Error creating window on activate:', error);
      }
    } else {
      // Focus the existing window
      const windows = BrowserWindow.getAllWindows();
      if (windows.length > 0 && windows[0]) {
        const win = windows[0];
        if (win.isMinimized()) {
          win.restore();
        }
        win.focus();
      }
    }
  });

  // Before quit event
  // This is called before the application starts closing windows
  app.on('before-quit', async (event) => {
    log.info('Before quit event triggered');
    
    // If we're still starting up the server, prevent quitting
    if (main.splashWindow && !main.serverReady) {
      log.info('Server still starting up, preventing quit');
      event.preventDefault();
      
      // Ask user if they want to quit while server is starting
      const { response } = await dialog.showMessageBox({
        type: 'question',
        buttons: ['Yes', 'No'],
        title: 'Confirm',
        message: 'ERPNext server is still starting up. Are you sure you want to quit?'
      });
      
      if (response === 0) { // Yes
        // Allow quit on next attempt
        app.quit();
      }
      
      return;
    }
    
    try {
      // Perform cleanup operations
      await main.cleanup();
    } catch (error) {
      log.error('Error during application cleanup:', error);
    }
  });

  // Will quit event
  // This is called when all windows have been closed and the application will quit
  app.on('will-quit', (event) => {
    log.info('Will quit event triggered');
    
    // Final cleanup that might be needed
    try {
      // Any synchronous cleanup that must happen before the app exits
      log.info('Application is about to exit');
    } catch (error) {
      log.error('Error during final cleanup:', error);
    }
  });

  // Open file event (macOS)
  // This is called when a file is opened with the application
  app.on('open-file', (event, filePath) => {
    event.preventDefault();
    log.info(`Open file event triggered with path: ${filePath}`);
    
    // Handle opening specific file types
    if (filePath.endsWith('.erpnext')) {
      // If app is ready, open the file
      if (app.isReady() && main.mainWindow) {
        main.mainWindow.webContents.send('open-file', filePath);
      } else {
        // Store the file path to open after app is ready
        app.once('ready', () => {
          if (main.mainWindow) {
            main.mainWindow.webContents.send('open-file', filePath);
          }
        });
      }
    }
  });

  // Open URL event
  // This is called when a URL with the app's protocol is opened
  app.on('open-url', (event, url) => {
    event.preventDefault();
    log.info(`Open URL event triggered with URL: ${url}`);
    
    // Handle custom protocol (e.g., erpnext://)
    if (url.startsWith('erpnext://')) {
      if (app.isReady() && main.mainWindow) {
        main.mainWindow.webContents.send('open-url', url);
      } else {
        app.once('ready', () => {
          if (main.mainWindow) {
            main.mainWindow.webContents.send('open-url', url);
          }
        });
      }
    }
  });

  // Second instance event
  // This is called when a second instance of the app is started
  const gotTheLock = app.requestSingleInstanceLock();
  
  if (!gotTheLock) {
    log.info('Another instance is already running, quitting');
    app.quit();
  } else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
      log.info('Second instance detected');
      
      // Focus the main window if it exists
      if (main.mainWindow) {
        if (main.mainWindow.isMinimized()) {
          main.mainWindow.restore();
        }
        main.mainWindow.focus();
        
        // Check if the second instance was launched with arguments
        if (process.platform === 'win32' || process.platform === 'linux') {
          // Look for file paths or URLs in command line arguments
          const fileOrUrl = commandLine.find(arg => 
            arg.endsWith('.erpnext') || arg.startsWith('erpnext://')
          );
          
          if (fileOrUrl) {
            if (fileOrUrl.startsWith('erpnext://')) {
              main.mainWindow.webContents.send('open-url', fileOrUrl);
            } else {
              main.mainWindow.webContents.send('open-file', fileOrUrl);
            }
          }
        }
      }
    });
  }

  // Register protocol handler (erpnext://)
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient('erpnext', process.execPath, [
        path.resolve(process.argv[1])
      ]);
    }
  } else {
    app.setAsDefaultProtocolClient('erpnext');
  }

  // Handle macOS dock menu
  if (main.isMac) {
    app.dock.setMenu(main.getDockMenu());
  }

  log.info('App lifecycle listeners registered successfully');
}
