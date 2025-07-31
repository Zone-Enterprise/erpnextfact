#!/usr/bin/env node

/**
 * Build script for ERPNext Desktop
 * 
 * This script handles the build process for the ERPNext Desktop application:
 * 1. Compiles TypeScript files
 * 2. Builds the Vue.js frontend using Vite
 * 3. Packages the Electron application using electron-builder
 * 4. Handles different platform builds (Windows, macOS, Linux)
 * 
 * Usage:
 *   node build.mjs [--win] [--mac] [--linux] [--dir] [--publish=always|never|onTag]
 */

import { execa } from 'execa';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import electronBuilder from 'electron-builder';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { build } = electronBuilder;

// Get directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../..');
const desktopDir = path.join(rootDir, 'desktop');
const distDir = path.join(desktopDir, 'dist');
const distElectronDir = path.join(desktopDir, 'dist_electron');
const buildDir = path.join(distElectronDir, 'build');
const srcDir = path.join(desktopDir, 'src');
const mainDir = path.join(desktopDir, 'main');
const assetsDir = path.join(desktopDir, 'assets');
const configDir = path.join(desktopDir, 'config');

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .option('win', {
    type: 'boolean',
    description: 'Build for Windows',
    default: false,
  })
  .option('mac', {
    type: 'boolean',
    description: 'Build for macOS',
    default: false,
  })
  .option('linux', {
    type: 'boolean',
    description: 'Build for Linux',
    default: false,
  })
  .option('dir', {
    type: 'boolean',
    description: 'Build unpacked directory only',
    default: false,
  })
  .option('publish', {
    type: 'string',
    description: 'Publish options: "onTag", "always", "never"',
    default: 'never',
  })
  .option('x64', {
    type: 'boolean',
    description: 'Build for x64 architecture',
    default: true,
  })
  .option('arm64', {
    type: 'boolean',
    description: 'Build for arm64 architecture',
    default: false,
  })
  .option('ia32', {
    type: 'boolean',
    description: 'Build for ia32 architecture (Windows only)',
    default: false,
  })
  .help()
  .parse();

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
 * Cleans build directories
 */
async function cleanDirectories() {
  log('Cleaning build directories...');
  try {
    await fs.emptyDir(distDir);
    await fs.emptyDir(distElectronDir);
    await fs.ensureDir(buildDir);
    log('Build directories cleaned successfully');
  } catch (error) {
    logError('Failed to clean build directories', error);
    throw error;
  }
}

/**
 * Builds the frontend using Vite
 */
async function buildFrontend() {
  log('Building frontend with Vite...');
  try {
    await execa('npx', ['vite', 'build'], {
      cwd: desktopDir,
      stdio: 'inherit',
    });
    log('Frontend build completed successfully');
  } catch (error) {
    logError('Frontend build failed', error);
    throw error;
  }
}

/**
 * Compiles TypeScript files
 */
async function compileTypeScript() {
  log('Compiling TypeScript files...');
  try {
    await execa('npx', ['tsc', '--project', path.join(desktopDir, 'tsconfig.json')], {
      cwd: desktopDir,
      stdio: 'inherit',
    });
    log('TypeScript compilation completed successfully');
  } catch (error) {
    logError('TypeScript compilation failed', error);
    throw error;
  }
}

/**
 * Copies necessary files to the build directory
 */
async function copyFiles() {
  log('Copying files to build directory...');
  try {
    // Copy Vite build output
    await fs.copy(distDir, path.join(buildDir, 'src'));
    
    // Copy compiled main process files
    const mainOutputDir = path.join(desktopDir, 'dist', 'main');
    if (await fs.pathExists(mainOutputDir)) {
      await fs.copy(mainOutputDir, path.join(buildDir, 'main'));
    }
    
    // Copy package.json and modify it for production
    const packageJson = require(path.join(desktopDir, 'package.json'));
    // Remove development dependencies and scripts for production
    delete packageJson.devDependencies;
    delete packageJson.scripts;
    packageJson.main = 'main.js';
    await fs.writeJson(path.join(buildDir, 'package.json'), packageJson, { spaces: 2 });
    
    // Copy main.js
    await fs.copy(path.join(desktopDir, 'main.js'), path.join(buildDir, 'main.js'));
    
    // Copy assets and config directories
    await fs.copy(assetsDir, path.join(buildDir, 'assets'));
    await fs.copy(configDir, path.join(buildDir, 'config'));
    
    // Copy license and other necessary files
    await fs.copy(path.join(rootDir, 'license.txt'), path.join(buildDir, 'license.txt'));
    
    log('Files copied to build directory successfully');
  } catch (error) {
    logError('Failed to copy files to build directory', error);
    throw error;
  }
}

/**
 * Builds the Electron application using electron-builder
 */
async function buildElectronApp() {
  log('Building Electron application...');
  
  // Determine target platforms
  const platforms = [];
  if (argv.win) platforms.push('win');
  if (argv.mac) platforms.push('mac');
  if (argv.linux) platforms.push('linux');
  
  // If no platform is specified, build for the current platform
  if (platforms.length === 0) {
    if (process.platform === 'win32') platforms.push('win');
    else if (process.platform === 'darwin') platforms.push('mac');
    else platforms.push('linux');
  }
  
  // Determine architectures
  const archs = [];
  if (argv.x64) archs.push('x64');
  if (argv.arm64) archs.push('arm64');
  if (argv.ia32 && platforms.includes('win')) archs.push('ia32');
  
  // Build configuration
  const config = {
    config: path.join(desktopDir, 'electron-builder-config.mjs'),
    dir: argv.dir,
    publish: argv.publish,
  };
  
  try {
    // Build for each platform
    for (const platform of platforms) {
      log(`Building for ${platform}...`);
      await build({
        targets: electronBuilder.Platform[platform].createTarget(null, archs),
        ...config,
      });
    }
    
    log('Electron application build completed successfully');
  } catch (error) {
    logError('Electron application build failed', error);
    throw error;
  }
}

/**
 * Main build process
 */
async function main() {
  try {
    log('Starting ERPNext Desktop build process...');
    
    // Set environment variables
    process.env.NODE_ENV = 'production';
    
    // Clean directories
    await cleanDirectories();
    
    // Build frontend and compile TypeScript
    await buildFrontend();
    await compileTypeScript();
    
    // Copy files to build directory
    await copyFiles();
    
    // Build Electron application
    await buildElectronApp();
    
    log('ERPNext Desktop build process completed successfully!');
  } catch (error) {
    logError('Build process failed', error);
    process.exit(1);
  }
}

// Run the build process
main();
