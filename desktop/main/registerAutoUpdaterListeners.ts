import { app, dialog, BrowserWindow } from 'electron';
import { autoUpdater, UpdateInfo, UpdateDownloadedEvent } from 'electron-updater';
import { Main } from '../main';
import { log } from './logger';

/**
 * Update channels for the application
 */
export enum UpdateChannel {
  STABLE = 'stable',
  BETA = 'beta',
  ALPHA = 'alpha'
}

/**
 * Registers all auto-updater event listeners
 * @param main - The main application instance
 */
export default function registerAutoUpdaterListeners(main: Main): void {
  log.info('Registering auto-updater listeners');

  // Set update channel from store or default to stable
  const updateChannel = main.store.get('updateChannel', UpdateChannel.STABLE);
  setUpdateChannel(updateChannel);

  // Register IPC handlers for update operations
  main.registerUpdateHandlers();

  // Check for updates automatically if enabled
  const autoCheckUpdates = main.store.get('autoCheckUpdates', true);
  if (autoCheckUpdates && !main.isTest) {
    // Wait a bit after app starts before checking for updates
    setTimeout(() => {
      if (!main.checkedForUpdate) {
        checkForUpdates(false);
      }
    }, 10000); // 10 seconds delay
  }

  // Auto-updater event: checking-for-update
  autoUpdater.on('checking-for-update', () => {
    log.info('Checking for updates...');
    main.checkedForUpdate = true;
    
    // Notify all windows
    notifyAllWindows('checking-for-update');
  });

  // Auto-updater event: update-available
  autoUpdater.on('update-available', (info: UpdateInfo) => {
    log.info('Update available:', info);
    
    // Notify all windows
    notifyAllWindows('update-available', info);
    
    // Show notification if not silent check
    if (!main.silentCheck) {
      dialog.showMessageBox({
        type: 'info',
        title: 'Update Available',
        message: `A new version (${info.version}) of ERPNext Desktop is available.`,
        buttons: ['Download Now', 'Later'],
        defaultId: 0
      }).then(({ response }) => {
        if (response === 0) {
          // User chose to download now
          downloadUpdate();
        }
      }).catch(err => {
        log.error('Error showing update dialog:', err);
      });
    }
  });

  // Auto-updater event: update-not-available
  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    log.info('No updates available:', info);
    
    // Notify all windows
    notifyAllWindows('update-not-available', info);
    
    // Show notification if not silent check and user manually checked
    if (!main.silentCheck && main.userInitiatedCheck) {
      dialog.showMessageBox({
        type: 'info',
        title: 'No Updates Available',
        message: `You're running the latest version (${app.getVersion()}) of ERPNext Desktop.`,
        buttons: ['OK']
      }).catch(err => {
        log.error('Error showing no update dialog:', err);
      });
    }
    
    // Reset flags
    main.userInitiatedCheck = false;
    main.silentCheck = false;
  });

  // Auto-updater event: download-progress
  autoUpdater.on('download-progress', (progressObj) => {
    const logMessage = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}% (${progressObj.transferred}/${progressObj.total})`;
    log.info(logMessage);
    
    // Notify all windows
    notifyAllWindows('update-progress', progressObj);
  });

  // Auto-updater event: update-downloaded
  autoUpdater.on('update-downloaded', (info: UpdateDownloadedEvent) => {
    log.info('Update downloaded:', info);
    
    // Notify all windows
    notifyAllWindows('update-downloaded', info);
    
    // Show notification
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Ready',
      message: `Version ${info.version} has been downloaded and is ready to install.`,
      detail: 'The application will restart to install the update.',
      buttons: ['Install Now', 'Install Later'],
      defaultId: 0
    }).then(({ response }) => {
      if (response === 0) {
        // User chose to install now
        installUpdate();
      }
    }).catch(err => {
      log.error('Error showing update downloaded dialog:', err);
    });
  });

  // Auto-updater event: error
  autoUpdater.on('error', (error) => {
    log.error('Auto-updater error:', error);
    
    // Notify all windows
    notifyAllWindows('update-error', error.toString());
    
    // Show error dialog if user initiated the check
    if (main.userInitiatedCheck) {
      dialog.showErrorBox(
        'Update Error',
        `An error occurred while checking for updates: ${error.message}`
      );
      
      // Reset flag
      main.userInitiatedCheck = false;
    }
  });

  /**
   * Set the update channel
   * @param channel - The update channel to use
   */
  function setUpdateChannel(channel: string): void {
    log.info(`Setting update channel to: ${channel}`);
    
    // Store the selected channel
    main.store.set('updateChannel', channel);
    
    // Configure auto-updater based on channel
    switch (channel) {
      case UpdateChannel.BETA:
        autoUpdater.channel = 'beta';
        autoUpdater.allowPrerelease = true;
        break;
      case UpdateChannel.ALPHA:
        autoUpdater.channel = 'alpha';
        autoUpdater.allowPrerelease = true;
        break;
      case UpdateChannel.STABLE:
      default:
        autoUpdater.channel = 'latest';
        autoUpdater.allowPrerelease = false;
        break;
    }
  }

  /**
   * Check for updates
   * @param userInitiated - Whether the check was initiated by the user
   */
  function checkForUpdates(userInitiated: boolean = false): void {
    log.info(`Checking for updates (user initiated: ${userInitiated})`);
    
    // Set flags
    main.userInitiatedCheck = userInitiated;
    main.silentCheck = !userInitiated;
    
    try {
      autoUpdater.checkForUpdates();
    } catch (error) {
      log.error('Error checking for updates:', error);
      
      if (userInitiated) {
        dialog.showErrorBox(
          'Update Error',
          `Failed to check for updates: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  /**
   * Download the available update
   */
  function downloadUpdate(): void {
    log.info('Downloading update...');
    
    try {
      autoUpdater.downloadUpdate();
    } catch (error) {
      log.error('Error downloading update:', error);
      
      dialog.showErrorBox(
        'Download Error',
        `Failed to download update: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Install the downloaded update
   */
  function installUpdate(): void {
    log.info('Installing update...');
    
    // Perform cleanup before installing update
    main.cleanup().then(() => {
      // Quit and install
      autoUpdater.quitAndInstall(false, true);
    }).catch(error => {
      log.error('Error during cleanup before update:', error);
      
      // Try to install anyway
      autoUpdater.quitAndInstall(false, true);
    });
  }

  /**
   * Notify all windows about an update event
   * @param event - The event name
   * @param data - The event data
   */
  function notifyAllWindows(event: string, data?: any): void {
    BrowserWindow.getAllWindows().forEach(window => {
      if (!window.isDestroyed()) {
        window.webContents.send(event, data);
      }
    });
  }

  /**
   * Register IPC handlers for update operations
   */
  Main.prototype.registerUpdateHandlers = function(): void {
    // Check for updates
    this.ipcMain.handle('check-for-updates', () => {
      checkForUpdates(true);
      return true;
    });
    
    // Download update
    this.ipcMain.handle('download-update', () => {
      downloadUpdate();
      return true;
    });
    
    // Install update
    this.ipcMain.handle('install-update', () => {
      installUpdate();
      return true;
    });
    
    // Get current version
    this.ipcMain.handle('get-current-version', () => {
      return app.getVersion();
    });
    
    // Set update channel
    this.ipcMain.handle('set-update-channel', (_, channel) => {
      if (Object.values(UpdateChannel).includes(channel as UpdateChannel)) {
        setUpdateChannel(channel);
        return true;
      }
      return false;
    });
    
    // Get update channel
    this.ipcMain.handle('get-update-channel', () => {
      return this.store.get('updateChannel', UpdateChannel.STABLE);
    });
  };

  log.info('Auto-updater listeners registered successfully');
}
