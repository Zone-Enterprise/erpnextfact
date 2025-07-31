// Preload script for ERPNext Desktop
// This script securely exposes APIs from the main process to the renderer process

const { contextBridge, ipcRenderer, shell } = require('electron');
const os = require('os');
const path = require('path');

/**
 * Expose APIs to the renderer process securely
 * Only expose what's absolutely necessary
 */
contextBridge.exposeInMainWorld('erpnextAPI', {
  // System information and platform detection
  system: {
    platform: process.platform,
    arch: process.arch,
    osVersion: os.release(),
    osName: getOSName(),
    hostname: os.hostname(),
    cpuCores: os.cpus().length,
    totalMemory: os.totalmem(),
    freeMemory: () => os.freemem(), // Function to get current free memory
    homeDir: os.homedir(),
    tempDir: os.tmpdir(),
    isWindows: process.platform === 'win32',
    isMac: process.platform === 'darwin',
    isLinux: process.platform === 'linux',
  },

  // File system operations
  files: {
    // Show open dialog
    showOpenDialog: (options) => {
      // Validate options for security
      const safeOptions = sanitizeDialogOptions(options);
      return ipcRenderer.invoke('show-open-dialog', safeOptions);
    },
    
    // Show save dialog
    showSaveDialog: (options) => {
      // Validate options for security
      const safeOptions = sanitizeDialogOptions(options);
      return ipcRenderer.invoke('show-save-dialog', safeOptions);
    },
    
    // Open external URL (e.g., documentation)
    openExternal: (url) => {
      // Validate URL for security
      if (typeof url === 'string' && isValidUrl(url)) {
        return ipcRenderer.invoke('open-external-url', url);
      }
      return Promise.reject(new Error('Invalid URL'));
    }
  },

  // Server control operations
  server: {
    // Check server status
    checkStatus: () => ipcRenderer.invoke('check-server-status'),
    
    // Restart server
    restart: () => ipcRenderer.invoke('restart-server'),
    
    // Update database configuration
    updateDatabaseConfig: (config) => {
      // Validate config for security
      if (!config || typeof config !== 'object') {
        return Promise.reject(new Error('Invalid configuration'));
      }
      
      // Ensure required properties exist and are of correct types
      if (!config.type || !['mariadb', 'sqlite'].includes(config.type)) {
        return Promise.reject(new Error('Invalid database type'));
      }
      
      // If MariaDB, validate connection details
      if (config.type === 'mariadb' && config.mariadb) {
        const { host, port, user, password } = config.mariadb;
        if (typeof host !== 'string' || 
            typeof port !== 'number' || 
            typeof user !== 'string' || 
            typeof password !== 'string') {
          return Promise.reject(new Error('Invalid MariaDB configuration'));
        }
      }
      
      return ipcRenderer.invoke('update-database-config', config);
    },
    
    // Get server port
    getPort: () => ipcRenderer.invoke('get-server-port'),
    
    // Get server site name
    getSiteName: () => ipcRenderer.invoke('get-site-name')
  },

  // Auto-update APIs
  updates: {
    // Check for updates
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    
    // Download update
    downloadUpdate: () => ipcRenderer.invoke('download-update'),
    
    // Install update
    installUpdate: () => ipcRenderer.invoke('install-update'),
    
    // Get current version
    getCurrentVersion: () => ipcRenderer.invoke('get-current-version'),
    
    // Listen for update events
    onUpdateAvailable: (callback) => {
      const subscription = (_event, info) => callback(info);
      ipcRenderer.on('update-available', subscription);
      return () => ipcRenderer.removeListener('update-available', subscription);
    },
    
    onUpdateDownloaded: (callback) => {
      const subscription = (_event, info) => callback(info);
      ipcRenderer.on('update-downloaded', subscription);
      return () => ipcRenderer.removeListener('update-downloaded', subscription);
    },
    
    onUpdateError: (callback) => {
      const subscription = (_event, error) => callback(error);
      ipcRenderer.on('update-error', subscription);
      return () => ipcRenderer.removeListener('update-error', subscription);
    },
    
    onUpdateProgress: (callback) => {
      const subscription = (_event, progressObj) => callback(progressObj);
      ipcRenderer.on('update-progress', subscription);
      return () => ipcRenderer.removeListener('update-progress', subscription);
    }
  },

  // Application lifecycle and window management
  app: {
    // Minimize window
    minimize: () => ipcRenderer.invoke('window-minimize'),
    
    // Maximize window
    maximize: () => ipcRenderer.invoke('window-maximize'),
    
    // Close window
    close: () => ipcRenderer.invoke('window-close'),
    
    // Is window maximized
    isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
    
    // Get app version
    getVersion: () => ipcRenderer.invoke('app-version'),
    
    // Get app name
    getName: () => ipcRenderer.invoke('app-name'),
    
    // Restart application
    restart: () => ipcRenderer.invoke('app-restart'),
    
    // Quit application
    quit: () => ipcRenderer.invoke('app-quit')
  },
  
  // Settings management
  settings: {
    // Get all settings
    getAll: () => ipcRenderer.invoke('settings-get-all'),
    
    // Get setting by key
    get: (key) => {
      if (typeof key !== 'string') {
        return Promise.reject(new Error('Invalid setting key'));
      }
      return ipcRenderer.invoke('settings-get', key);
    },
    
    // Set setting
    set: (key, value) => {
      if (typeof key !== 'string') {
        return Promise.reject(new Error('Invalid setting key'));
      }
      return ipcRenderer.invoke('settings-set', key, value);
    },
    
    // Delete setting
    delete: (key) => {
      if (typeof key !== 'string') {
        return Promise.reject(new Error('Invalid setting key'));
      }
      return ipcRenderer.invoke('settings-delete', key);
    }
  },
  
  // Event listeners for IPC events
  on: (channel, callback) => {
    // Whitelist of allowed channels for security
    const validChannels = [
      'server-status',
      'server-ready',
      'server-error',
      'database-connected',
      'database-error',
      'app-ready',
      'update-status',
      'splash-status'
    ];
    
    if (validChannels.includes(channel)) {
      const subscription = (_event, ...args) => callback(...args);
      ipcRenderer.on(channel, subscription);
      return () => ipcRenderer.removeListener(channel, subscription);
    }
    
    return null;
  }
});

/**
 * Helper function to get OS name
 * @returns {string} OS name
 */
function getOSName() {
  const platform = process.platform;
  
  if (platform === 'win32') {
    return 'Windows';
  } else if (platform === 'darwin') {
    return 'macOS';
  } else if (platform === 'linux') {
    return 'Linux';
  } else {
    return 'Unknown';
  }
}

/**
 * Helper function to validate URLs for security
 * @param {string} url - URL to validate
 * @returns {boolean} Whether URL is valid
 */
function isValidUrl(url) {
  try {
    const parsedUrl = new URL(url);
    return ['http:', 'https:'].includes(parsedUrl.protocol);
  } catch (error) {
    return false;
  }
}

/**
 * Helper function to sanitize dialog options for security
 * @param {object} options - Dialog options to sanitize
 * @returns {object} Sanitized dialog options
 */
function sanitizeDialogOptions(options) {
  if (!options || typeof options !== 'object') {
    return {};
  }
  
  const safeOptions = {};
  
  // Whitelist of allowed properties
  const allowedProps = [
    'title',
    'defaultPath',
    'buttonLabel',
    'filters',
    'properties',
    'message',
    'nameFieldLabel',
    'showsTagField',
    'securityScopedBookmarks'
  ];
  
  for (const prop of allowedProps) {
    if (options[prop] !== undefined) {
      safeOptions[prop] = options[prop];
    }
  }
  
  return safeOptions;
}
