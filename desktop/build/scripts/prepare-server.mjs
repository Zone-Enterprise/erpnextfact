#!/usr/bin/env node

/**
 * prepare-server.mjs
 * 
 * This script prepares ERPNext server assets for bundling with the desktop application.
 * It checks for dependencies, builds assets, and creates a minimal server bundle.
 */

import { exec, execSync, execFile } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import archiver from 'archiver';
import chalk from 'chalk';

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../..');
const desktopDir = path.resolve(rootDir, 'desktop');
const serverBundleDir = path.resolve(desktopDir, 'server-bundle');
const serverArchivePath = path.resolve(desktopDir, 'src', 'assets', 'server-bundle.zip');

/**
 * Main function to prepare the server bundle
 */
async function prepareServerBundle() {
  console.log(chalk.blue('🚀 Starting ERPNext server preparation for desktop bundling'));
  
  try {
    // Create server bundle directory if it doesn't exist
    await fs.ensureDir(serverBundleDir);
    
    // Check if bench command is available
    if (await checkBenchInstalled()) {
      console.log(chalk.green('✓ Bench is installed'));
      
      // Build ERPNext assets
      await buildERPNextAssets();
      
      // Create minimal server bundle
      await createMinimalServerBundle();
      
      // Compress the server bundle
      await compressServerBundle();
      
      console.log(chalk.green('✅ Server bundle preparation completed successfully!'));
    } else {
      console.log(chalk.yellow('⚠️ Bench is not installed or not in PATH. Skipping server preparation.'));
      console.log(chalk.yellow('   This is normal in CI environments where we use pre-built assets.'));
      
      // Check if we have pre-built assets
      if (await fs.pathExists(serverArchivePath)) {
        console.log(chalk.green('✓ Pre-built server bundle found at: ' + serverArchivePath));
      } else {
        console.log(chalk.yellow('⚠️ No pre-built server bundle found. Desktop app may not function correctly.'));
        console.log(chalk.yellow('   Consider building the server bundle locally and committing it.'));
      }
    }
  } catch (error) {
    console.error(chalk.red('❌ Error preparing server bundle:'));
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}

/**
 * Check if bench is installed
 */
async function checkBenchInstalled() {
  try {
    await execCommand('bench --version', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Build ERPNext assets using bench
 */
async function buildERPNextAssets() {
  console.log(chalk.blue('🔨 Building ERPNext assets...'));
  
  try {
    // Determine if we're in a bench directory
    const isBenchDir = await fs.pathExists(path.resolve(rootDir, 'apps'));
    
    if (isBenchDir) {
      // We're in a bench directory, build directly
      await execFileCommand('bench', ['build'], { cwd: rootDir, stdio: 'inherit' });
    } else {
      // We're not in a bench directory, try to find bench
      console.log(chalk.yellow('⚠️ Not in a bench directory. Trying to find ERPNext installation...'));
      
      // Check common locations for bench
      const possibleLocations = [
        path.resolve(rootDir, '..', 'frappe-bench'),
        path.resolve(rootDir, '..', '..', 'frappe-bench'),
        process.env.BENCH_PATH
      ];
      
      let benchFound = false;
      
      for (const location of possibleLocations) {
        if (location && await fs.pathExists(location)) {
          console.log(chalk.green('✓ Found bench at: ' + location));
          await execFileCommand('bench', ['build'], { cwd: location, stdio: 'inherit' });
          benchFound = true;
          break;
        }
      }
      
      if (!benchFound) {
        throw new Error('Could not find bench installation. Please run this script from a bench directory or set BENCH_PATH environment variable.');
      }
    }
    
    console.log(chalk.green('✓ ERPNext assets built successfully'));
  } catch (error) {
    console.error(chalk.red('❌ Failed to build ERPNext assets:'));
    console.error(chalk.red(error.message));
    throw error;
  }
}

/**
 * Create a minimal server bundle with required files
 */
async function createMinimalServerBundle() {
  console.log(chalk.blue('📦 Creating minimal server bundle...'));
  
  try {
    // Clear the server bundle directory
    await fs.emptyDir(serverBundleDir);
    
    // Determine the apps directory
    const appsDir = path.resolve(rootDir, 'apps');
    
    // Copy required apps (frappe and erpnext)
    const requiredApps = ['frappe', 'erpnext'];
    
    for (const app of requiredApps) {
      const appPath = path.resolve(appsDir, app);
      
      if (await fs.pathExists(appPath)) {
        console.log(chalk.blue(`Copying ${app} app...`));
        
        // Create app directory in bundle
        await fs.ensureDir(path.resolve(serverBundleDir, 'apps', app));
        
        // Copy Python files
        await fs.copy(
          path.resolve(appPath, app),
          path.resolve(serverBundleDir, 'apps', app, app)
        );
        
        // Copy built assets
        if (await fs.pathExists(path.resolve(appPath, app, 'public'))) {
          await fs.copy(
            path.resolve(appPath, app, 'public'),
            path.resolve(serverBundleDir, 'apps', app, app, 'public')
          );
        }
        
        // Copy templates
        if (await fs.pathExists(path.resolve(appPath, app, 'templates'))) {
          await fs.copy(
            path.resolve(appPath, app, 'templates'),
            path.resolve(serverBundleDir, 'apps', app, app, 'templates')
          );
        }
        
        // Copy package.json and setup.py
        for (const file of ['package.json', 'setup.py', 'requirements.txt']) {
          const filePath = path.resolve(appPath, file);
          if (await fs.pathExists(filePath)) {
            await fs.copy(
              filePath,
              path.resolve(serverBundleDir, 'apps', app, file)
            );
          }
        }
      } else {
        console.warn(chalk.yellow(`⚠️ App ${app} not found at ${appPath}`));
      }
    }
    
    // Copy configuration templates
    console.log(chalk.blue('Copying configuration templates...'));
    const configDir = path.resolve(serverBundleDir, 'config');
    await fs.ensureDir(configDir);
    
    // Create minimal configuration files
    await fs.writeFile(
      path.resolve(configDir, 'common_site_config.json'),
      JSON.stringify({
        db_type: 'mariadb',
        developer_mode: 0,
        disable_async: 0,
        serve_default_site: true,
        auto_update: false,
        desktop_app: true
      }, null, 2)
    );
    
    // Create sites directory structure
    await fs.ensureDir(path.resolve(serverBundleDir, 'sites', 'assets'));
    await fs.ensureDir(path.resolve(serverBundleDir, 'sites', 'localhost'));
    
    console.log(chalk.green('✓ Minimal server bundle created successfully'));
  } catch (error) {
    console.error(chalk.red('❌ Failed to create minimal server bundle:'));
    console.error(chalk.red(error.message));
    throw error;
  }
}

/**
 * Compress the server bundle for inclusion in the desktop app
 */
async function compressServerBundle() {
  console.log(chalk.blue('📦 Compressing server bundle...'));
  
  try {
    // Ensure the assets directory exists
    await fs.ensureDir(path.resolve(desktopDir, 'src', 'assets'));
    
    // Create a file to stream archive data to
    const output = fs.createWriteStream(serverArchivePath);
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });
    
    // Listen for all archive data to be written
    const archiveComplete = new Promise((resolve, reject) => {
      output.on('close', () => {
        console.log(chalk.green(`✓ Server bundle compressed successfully (${archive.pointer()} bytes)`));
        resolve();
      });
      
      archive.on('error', (err) => {
        reject(err);
      });
    });
    
    // Pipe archive data to the file
    archive.pipe(output);
    
    // Append files from the server bundle directory
    archive.directory(serverBundleDir, false);
    
    // Finalize the archive
    await archive.finalize();
    
    // Wait for the archive to complete
    await archiveComplete;
  } catch (error) {
    console.error(chalk.red('❌ Failed to compress server bundle:'));
    console.error(chalk.red(error.message));
    throw error;
  }
}

/**
 * Execute a command and return a promise
 */
function execCommand(command, options = {}) {
  return new Promise((resolve, reject) => {
    exec(command, options, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

/**
 * Execute a file with arguments and return a promise
 */
function execFileCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, args, options, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

// Run the main function
prepareServerBundle().catch(error => {
  console.error(chalk.red('❌ Unhandled error:'));
  console.error(chalk.red(error));
  process.exit(1);
});
