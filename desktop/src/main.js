import { createApp } from 'vue';
import { createRouter, createWebHashHistory } from 'vue-router';
import './assets/styles/main.css';

// Create basic app shell
const App = {
  template: `
    <div class="app-container">
      <header v-if="!isFullscreenMode" class="app-header">
        <div class="window-controls" v-if="!isFullscreenMode">
          <button @click="minimizeWindow" class="control minimize" title="Minimize">
            <span>─</span>
          </button>
          <button @click="toggleMaximize" class="control maximize" title="Maximize">
            <span>□</span>
          </button>
          <button @click="closeWindow" class="control close" title="Close">
            <span>×</span>
          </button>
        </div>
        <div class="app-title">ERPNext Desktop</div>
        <nav class="app-nav">
          <router-link to="/">Dashboard</router-link>
          <router-link to="/settings">Settings</router-link>
        </nav>
        <div class="server-status" :class="{ online: serverStatus.online }">
          Server: {{ serverStatus.online ? 'Online' : 'Starting...' }}
        </div>
      </header>
      <main class="app-content">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
      <footer v-if="!isFullscreenMode" class="app-footer">
        <div class="app-version">v{{ appVersion }}</div>
        <div class="app-status">{{ statusMessage }}</div>
      </footer>
    </div>
  `,
  data() {
    return {
      appVersion: '0.1.0',
      serverStatus: {
        online: false,
        port: 8000
      },
      statusMessage: 'Ready',
      isFullscreenMode: false
    };
  },
  mounted() {
    // Check if we're running in Electron
    if (window.erpnextAPI) {
      // Get app version
      window.erpnextAPI.app.getVersion().then(version => {
        this.appVersion = version;
      });

      // Check server status
      window.erpnextAPI.server.checkStatus().then(status => {
        this.serverStatus.online = status;
        if (status) {
          this.statusMessage = 'Server is running';
        } else {
          this.statusMessage = 'Starting server...';
        }
      });

      // Get server port
      window.erpnextAPI.server.getPort().then(port => {
        this.serverStatus.port = port;
      });

      // Listen for server status changes
      window.erpnextAPI.on('server-status', (status) => {
        this.serverStatus.online = status.status === 'ready';
        if (this.serverStatus.online) {
          this.statusMessage = 'Server is running';
          this.serverStatus.port = status.port;
        } else {
          this.statusMessage = `Server ${status.status}...`;
        }
      });
    }
  },
  methods: {
    minimizeWindow() {
      if (window.erpnextAPI) {
        window.erpnextAPI.app.minimize();
      }
    },
    toggleMaximize() {
      if (window.erpnextAPI) {
        window.erpnextAPI.app.maximize();
      }
    },
    closeWindow() {
      if (window.erpnextAPI) {
        window.erpnextAPI.app.close();
      }
    },
    toggleFullscreen() {
      this.isFullscreenMode = !this.isFullscreenMode;
    }
  }
};

// Create simple components for routes
const Dashboard = {
  template: `
    <div class="dashboard">
      <h1>ERPNext Dashboard</h1>
      <div v-if="serverStatus.online" class="server-ready">
        <p>ERPNext server is running on port {{ serverStatus.port }}</p>
        <button @click="openERPNext" class="primary-button">Open ERPNext</button>
      </div>
      <div v-else class="server-starting">
        <p>Starting ERPNext server...</p>
        <div class="loading-spinner"></div>
      </div>
    </div>
  `,
  data() {
    return {
      serverStatus: {
        online: false,
        port: 8000
      }
    };
  },
  mounted() {
    // Check if we're running in Electron
    if (window.erpnextAPI) {
      // Check server status
      window.erpnextAPI.server.checkStatus().then(status => {
        this.serverStatus.online = status;
      });

      // Get server port
      window.erpnextAPI.server.getPort().then(port => {
        this.serverStatus.port = port;
      });

      // Listen for server status changes
      window.erpnextAPI.on('server-status', (status) => {
        this.serverStatus.online = status.status === 'ready';
        if (this.serverStatus.online) {
          this.serverStatus.port = status.port;
        }
      });
    }
  },
  methods: {
    openERPNext() {
      this.$router.push('/erpnext');
    }
  }
};

const Settings = {
  template: `
    <div class="settings">
      <h1>Settings</h1>
      <div class="settings-group">
        <h2>Database Settings</h2>
        <div class="setting-item">
          <label for="db-type">Database Type:</label>
          <select id="db-type" v-model="settings.databaseType">
            <option value="mariadb">MariaDB</option>
            <option value="sqlite">SQLite</option>
          </select>
        </div>
        
        <div v-if="settings.databaseType === 'mariadb'" class="setting-item">
          <h3>MariaDB Settings</h3>
          <div class="form-group">
            <label for="db-host">Host:</label>
            <input id="db-host" v-model="settings.mariadbConfig.host" type="text">
          </div>
          <div class="form-group">
            <label for="db-port">Port:</label>
            <input id="db-port" v-model="settings.mariadbConfig.port" type="number">
          </div>
          <div class="form-group">
            <label for="db-user">User:</label>
            <input id="db-user" v-model="settings.mariadbConfig.user" type="text">
          </div>
          <div class="form-group">
            <label for="db-password">Password:</label>
            <input id="db-password" v-model="settings.mariadbConfig.password" type="password">
          </div>
        </div>
      </div>
      
      <div class="settings-group">
        <h2>Server Settings</h2>
        <div class="setting-item">
          <label for="server-port">Server Port:</label>
          <input id="server-port" v-model="settings.serverPort" type="number">
        </div>
        <div class="setting-item">
          <label for="site-name">Site Name:</label>
          <input id="site-name" v-model="settings.siteName" type="text">
        </div>
        <div class="setting-item">
          <label for="auto-start">Auto-start Server:</label>
          <input id="auto-start" v-model="settings.autoStart" type="checkbox">
        </div>
      </div>
      
      <div class="settings-group">
        <h2>Updates</h2>
        <div class="setting-item">
          <label for="update-channel">Update Channel:</label>
          <select id="update-channel" v-model="settings.updateChannel">
            <option value="stable">Stable</option>
            <option value="beta">Beta</option>
            <option value="alpha">Alpha</option>
          </select>
        </div>
        <div class="setting-item">
          <button @click="checkForUpdates" class="secondary-button">Check for Updates</button>
        </div>
      </div>
      
      <div class="settings-actions">
        <button @click="saveSettings" class="primary-button">Save Settings</button>
        <button @click="restartServer" class="warning-button">Restart Server</button>
      </div>
    </div>
  `,
  data() {
    return {
      settings: {
        serverPort: 8000,
        siteName: 'erpnext.localhost',
        databaseType: 'mariadb',
        mariadbConfig: {
          host: 'localhost',
          port: 3306,
          user: 'root',
          password: 'erpnext'
        },
        autoStart: true,
        updateChannel: 'stable'
      }
    };
  },
  mounted() {
    // Load settings if we're running in Electron
    if (window.erpnextAPI) {
      window.erpnextAPI.settings.getAll().then(settings => {
        // Only update properties that exist in our settings object
        for (const key in settings) {
          if (key in this.settings) {
            this.settings[key] = settings[key];
          }
        }
      });
    }
  },
  methods: {
    saveSettings() {
      if (window.erpnextAPI) {
        // Save each setting individually
        for (const key in this.settings) {
          window.erpnextAPI.settings.set(key, this.settings[key]);
        }
        
        // Show success message
        alert('Settings saved successfully');
      }
    },
    restartServer() {
      if (window.erpnextAPI) {
        window.erpnextAPI.server.restart().then(() => {
          alert('Server restarting...');
        }).catch(err => {
          alert('Error restarting server: ' + err);
        });
      }
    },
    checkForUpdates() {
      if (window.erpnextAPI) {
        window.erpnextAPI.updates.checkForUpdates().then(() => {
          // Update check initiated, results will come through events
          alert('Checking for updates...');
        }).catch(err => {
          alert('Error checking for updates: ' + err);
        });
      }
    }
  }
};

// ERPNext iframe component
const ERPNextFrame = {
  template: `
    <div class="erpnext-container" :class="{ 'loading': !serverReady }">
      <div v-if="!serverReady" class="loading-overlay">
        <div class="loading-spinner"></div>
        <div class="loading-message">{{ loadingMessage }}</div>
      </div>
      <iframe 
        v-if="serverUrl" 
        :src="serverUrl" 
        class="erpnext-frame"
        @load="iframeLoaded"
        ref="erpnextFrame"
      ></iframe>
      <div v-else class="error-message">
        <h2>Server Not Available</h2>
        <p>The ERPNext server is not running. Please check your settings or restart the server.</p>
        <button @click="goToDashboard" class="primary-button">Back to Dashboard</button>
      </div>
    </div>
  `,
  data() {
    return {
      serverReady: false,
      serverUrl: null,
      loadingMessage: 'Starting ERPNext server...',
      loadAttempts: 0
    };
  },
  mounted() {
    // Check if server is running
    this.checkServerStatus();
    
    // Listen for server status changes
    if (window.erpnextAPI) {
      window.erpnextAPI.on('server-status', (status) => {
        this.serverReady = status.status === 'ready';
        if (this.serverReady) {
          this.serverUrl = `http://localhost:${status.port}`;
        }
      });
    }
    
    // Set up periodic checks
    this.checkInterval = setInterval(() => {
      if (!this.serverReady) {
        this.checkServerStatus();
        this.loadAttempts++;
        
        if (this.loadAttempts > 10) {
          this.loadingMessage = 'Server is taking longer than expected to start...';
        }
        
        if (this.loadAttempts > 20) {
          this.loadingMessage = 'There might be an issue with the server. Consider restarting the application.';
          clearInterval(this.checkInterval);
        }
      }
    }, 3000);
  },
  beforeUnmount() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  },
  methods: {
    checkServerStatus() {
      if (window.erpnextAPI) {
        window.erpnextAPI.server.checkStatus().then(status => {
          this.serverReady = status;
          if (status) {
            window.erpnextAPI.server.getPort().then(port => {
              this.serverUrl = `http://localhost:${port}`;
            });
          }
        });
      }
    },
    iframeLoaded() {
      this.serverReady = true;
      if (this.checkInterval) {
        clearInterval(this.checkInterval);
      }
      
      // Try to access the iframe content
      // Note: This might fail due to same-origin policy if the server is not on the same origin
      try {
        const frame = this.$refs.erpnextFrame;
        if (frame && frame.contentWindow) {
          // We could potentially interact with the ERPNext iframe here
          console.log('ERPNext iframe loaded');
        }
      } catch (error) {
        console.error('Could not access iframe content:', error);
      }
    },
    goToDashboard() {
      this.$router.push('/');
    }
  }
};

// Create router
const routes = [
  { path: '/', component: Dashboard },
  { path: '/settings', component: Settings },
  { path: '/erpnext', component: ERPNextFrame },
  // Fallback route
  { path: '/:pathMatch(.*)*', redirect: '/' }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes
});

// Create and mount the app
const app = createApp(App);
app.use(router);

// Add global error handler
app.config.errorHandler = (err, vm, info) => {
  console.error('Vue Error:', err);
  console.error('Error Info:', info);
  
  // Report to main process if running in Electron
  if (window.erpnextAPI) {
    window.erpnextAPI.on('renderer-error', {
      error: err.message,
      stack: err.stack,
      info,
      component: vm?.$options?.name || 'Unknown'
    });
  }
};

// Add CSS for the application
const style = document.createElement('style');
style.textContent = `
  /* Basic reset and variables */
  :root {
    --primary-color: #4299e1;
    --secondary-color: #2c5282;
    --background-color: #f9fafb;
    --text-color: #1a202c;
    --border-color: #e2e8f0;
    --header-height: 48px;
    --footer-height: 30px;
  }
  
  /* App layout */
  .app-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background-color: var(--background-color);
    color: var(--text-color);
  }
  
  .app-header {
    display: flex;
    align-items: center;
    height: var(--header-height);
    padding: 0 16px;
    background-color: var(--primary-color);
    color: white;
    -webkit-app-region: drag;
  }
  
  .window-controls {
    display: flex;
    margin-right: 16px;
    -webkit-app-region: no-drag;
  }
  
  .control {
    width: 24px;
    height: 24px;
    border: none;
    background: transparent;
    color: white;
    font-size: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 8px;
    cursor: pointer;
    border-radius: 50%;
  }
  
  .control:hover {
    background-color: rgba(255, 255, 255, 0.2);
  }
  
  .control.close:hover {
    background-color: #e53e3e;
  }
  
  .app-title {
    font-weight: bold;
    margin-right: 16px;
  }
  
  .app-nav {
    display: flex;
    flex-grow: 1;
    -webkit-app-region: no-drag;
  }
  
  .app-nav a {
    color: white;
    text-decoration: none;
    padding: 0 16px;
    height: var(--header-height);
    display: flex;
    align-items: center;
  }
  
  .app-nav a:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }
  
  .app-nav a.router-link-active {
    background-color: rgba(255, 255, 255, 0.2);
    font-weight: bold;
  }
  
  .server-status {
    padding: 4px 8px;
    background-color: #e53e3e;
    border-radius: 4px;
    font-size: 12px;
    -webkit-app-region: no-drag;
  }
  
  .server-status.online {
    background-color: #48bb78;
  }
  
  .app-content {
    flex-grow: 1;
    overflow-y: auto;
    padding: 16px;
  }
  
  .app-footer {
    height: var(--footer-height);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    background-color: var(--border-color);
    font-size: 12px;
  }
  
  /* Dashboard */
  .dashboard {
    max-width: 800px;
    margin: 0 auto;
    padding: 24px;
  }
  
  .server-ready, .server-starting {
    margin-top: 24px;
    padding: 24px;
    border-radius: 8px;
    background-color: white;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    text-align: center;
  }
  
  /* Settings */
  .settings {
    max-width: 800px;
    margin: 0 auto;
    padding: 24px;
  }
  
  .settings-group {
    margin-bottom: 24px;
    padding: 16px;
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  .setting-item {
    margin-bottom: 16px;
  }
  
  .form-group {
    margin-bottom: 8px;
  }
  
  label {
    display: block;
    margin-bottom: 4px;
    font-weight: 500;
  }
  
  input, select {
    width: 100%;
    padding: 8px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
  }
  
  input[type="checkbox"] {
    width: auto;
  }
  
  .settings-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
  
  /* ERPNext iframe */
  .erpnext-container {
    position: relative;
    height: calc(100vh - var(--header-height) - var(--footer-height));
    width: 100%;
    overflow: hidden;
  }
  
  .erpnext-frame {
    width: 100%;
    height: 100%;
    border: none;
  }
  
  .loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(255, 255, 255, 0.9);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 10;
  }
  
  .error-message {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
  }
  
  /* Buttons */
  button {
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 500;
  }
  
  .primary-button {
    background-color: var(--primary-color);
    color: white;
  }
  
  .primary-button:hover {
    background-color: var(--secondary-color);
  }
  
  .secondary-button {
    background-color: var(--border-color);
    color: var(--text-color);
  }
  
  .secondary-button:hover {
    background-color: #cbd5e0;
  }
  
  .warning-button {
    background-color: #ed8936;
    color: white;
  }
  
  .warning-button:hover {
    background-color: #dd6b20;
  }
  
  /* Loading spinner */
  .loading-spinner {
    display: inline-block;
    width: 40px;
    height: 40px;
    margin-bottom: 16px;
  }
  
  .loading-spinner:after {
    content: " ";
    display: block;
    width: 32px;
    height: 32px;
    margin: 4px;
    border-radius: 50%;
    border: 4px solid var(--primary-color);
    border-color: var(--primary-color) transparent var(--primary-color) transparent;
    animation: spinner 1.2s linear infinite;
  }
  
  .loading-message {
    margin-top: 16px;
    font-size: 14px;
    color: var(--text-color);
  }
  
  @keyframes spinner {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  /* Transitions */
  .fade-enter-active, .fade-leave-active {
    transition: opacity 0.2s ease;
  }
  
  .fade-enter-from, .fade-leave-to {
    opacity: 0;
  }
`;

document.head.appendChild(style);

// Mount the app
app.mount('#app');
