#!/usr/bin/env node

/**
 * Development script for ERPNext Desktop
 * 
 * This script sets up the development environment for the ERPNext Desktop application:
 * 1. Starts the Vite dev server for frontend development
 * 2. Compiles TypeScript files in watch mode
 * 3. Launches the Electron application pointing to the dev server
 * 4. Implements hot-reload for frontend changes
 * 5. Restarts Electron when main process files change
 * 
 * Usage:
 *   node dev.mjs [--port=<port>] [--host=<host>]
 */

import { execa } from 'execa';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import chokidar from 'chokidar';
import { createRequire } from 'module';
import { spawn } from 'child_process';
import dotenv from 'dotenv';

// Load environment variables from .env file if present
dotenv.config();

const require = createRequire(import.meta.url);

// Get directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../..');
const desktopDir = path.join(rootDir, 'desktop');
const srcDir = path.join(desktopDir, 'src');
const mainDir = path.join(desktopDir, 'main');

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .option('port', {
    type: 'number',
    description: 'Port for Vite dev server',
    default: 6969,
  })
  .option('host', {
    type: 'string',
    description: 'Host for Vite dev server',
    default: '0.0.0.0',
  })
  .option('inspect', {
    type: 'boolean',
    description: 'Enable Node.js inspector for debugging',
    default: true,
  })
  .help()
  .parse();

// Store process references for cleanup
let electronProcess = null;
let tscProcess = null;
let viteProcess = null;

/**
 * Logs a message with timestamp
 * @param {string} message - Message to log
 */
function log(message) {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  console.log(`[${timestamp}] ${message}`);
}

/**
 * Logs an error message with timestamp
 * @param {string} message - Error message to log
 * @param {Error} [error] - Optional error object
 */
function logError(message, error) {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  console.error(`[${timestamp}] ERROR: ${message}`);
  if (error) {
    console.error(error);
  }
}

/**
 * Starts the Vite development server
 * @returns {Promise<void>}
 */
async function startViteServer() {
  log('Starting Vite development server...');
  
  try {
    // Set environment variables for Vite
    process.env.VITE_PORT = argv.port;
    process.env.VITE_HOST = argv.host;
    
    // Start Vite server
    viteProcess = execa('npx', ['vite', '--port', argv.port, '--host', argv.host], {
      cwd: desktopDir,
      stdio: 'inherit',
    });
    
    // Wait for Vite server to start
    await new Promise(resolve => setTimeout(resolve, 2000));
    log(`Vite server started at http://${argv.host}:${argv.port}/`);
  } catch (error) {
    logError('Failed to start Vite server', error);
    throw error;
  }
}

/**
 * Compiles TypeScript files in watch mode
 * @returns {Promise<void>}
 */
async function watchTypeScript() {
  log('Starting TypeScript compiler in watch mode...');
  
  try {
    tscProcess = execa('npx', ['tsc', '--project', path.join(desktopDir, 'tsconfig.json'), '--watch'], {
      cwd: desktopDir,
      stdio: 'inherit',
    });
    
    log('TypeScript compiler started in watch mode');
  } catch (error) {
    logError('Failed to start TypeScript compiler', error);
    throw error;
  }
}

/**
 * Starts the Electron application in development mode
 * @returns {Promise<void>}
 */
async function startElectron() {
  log('Starting Electron application...');
  
  try {
    // Set environment variables for Electron
    const env = {
      ...process.env,
      NODE_ENV: 'development',
      VITE_PORT: argv.port,
      VITE_HOST: argv.host,
    };
    
    // Build command line arguments
    const args = [desktopDir];
    if (argv.inspect) {
      args.unshift('--inspect=5858');
    }
    
    // Start Electron
    electronProcess = spawn('electron', args, {
      cwd: rootDir,
      stdio: 'inherit',
      env,
    });
    
    // Handle Electron process events
    electronProcess.on('close', (code) => {
      if (code !== null && code !== 0) {
        logError(`Electron process exited with code ${code}`);
      }
    });
    
    log('Electron application started');
  } catch (error) {
    logError('Failed to start Electron application', error);
    throw error;
  }
}

/**
 * Restarts the Electron application
 * @returns {Promise<void>}
 */
async function restartElectron() {
  log('Restarting Electron application...');
  
  if (electronProcess) {
    // Kill the current Electron process
    electronProcess.kill();
    electronProcess = null;
    
    // Wait a bit before starting a new instance
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Start a new Electron instance
  await startElectron();
}

/**
 * Watches for changes in main process files
 * @returns {Promise<void>}
 */
async function watchMainProcess() {
  log('Watching main process files for changes...');
  
  try {
    // Watch for changes in main process files
    const watcher = chokidar.watch([
      path.join(desktopDir, 'main.ts'),
      path.join(desktopDir, 'main.js'),
      path.join(mainDir, '**/*.ts'),
      path.join(mainDir, '**/*.js'),
    ], {
      ignored: /(^|[/\\])\../, // Ignore dot files
      persistent: true,
    });
    
    // Debounce restart to avoid multiple restarts
    let restartTimeout = null;
    const debouncedRestart = () => {
      if (restartTimeout) {
        clearTimeout(restartTimeout);
      }
      restartTimeout = setTimeout(() => {
        restartElectron().catch(error => {
          logError('Failed to restart Electron', error);
        });
      }, 1000);
    };
    
    // Watch for file changes
    watcher.on('change', (path) => {
      log(`Main process file changed: ${path}`);
      debouncedRestart();
    });
    
    log('Main process file watcher started');
  } catch (error) {
    logError('Failed to start main process file watcher', error);
    throw error;
  }
}

/**
 * Sets up the development environment
 * @returns {Promise<void>}
 */
async function setupDevEnvironment() {
  log('Setting up development environment...');
  
  try {
    // Ensure directories exist
    await fs.ensureDir(desktopDir);
    await fs.ensureDir(srcDir);
    await fs.ensureDir(mainDir);
    
    // Create necessary files if they don't exist
    const mainTsPath = path.join(desktopDir, 'main.ts');
    if (!await fs.pathExists(mainTsPath)) {
      logError(`Main entry point not found: ${mainTsPath}`);
      throw new Error(`Main entry point not found: ${mainTsPath}`);
    }
    
    log('Development environment set up successfully');
  } catch (error) {
    logError('Failed to set up development environment', error);
    throw error;
  }
}

/**
 * Cleans up processes on exit
 */
function cleanup() {
  log('Cleaning up processes...');
  
  if (electronProcess) {
    electronProcess.kill();
    electronProcess = null;
  }
  
  if (tscProcess) {
    tscProcess.kill();
    tscProcess = null;
  }
  
  if (viteProcess) {
    viteProcess.kill();
    viteProcess = null;
  }
  
  log('All processes cleaned up');
}

/**
 * Main development process
 */
async function main() {
  try {
    log('Starting ERPNext Desktop development process...');
    
    // Set up development environment
    await setupDevEnvironment();
    
    // Start development servers
    await Promise.all([
      startViteServer(),
      watchTypeScript(),
    ]);
    
    // Start Electron and watch for changes
    await startElectron();
    await watchMainProcess();
    
    log('ERPNext Desktop development environment is ready!');
    log(`Frontend URL: http://${argv.host}:${argv.port}/`);
    
    // Register cleanup handlers
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('exit', cleanup);
    
  } catch (error) {
    logError('Development process failed', error);
    cleanup();
    process.exit(1);
  }
}

// Run the development process
main();
