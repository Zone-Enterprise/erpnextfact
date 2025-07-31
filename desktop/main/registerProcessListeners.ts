import { app, dialog } from 'electron';
import { Main } from '../main';
import { log } from './logger';

/**
 * Registers all Node.js process event listeners
 * @param main - The main application instance
 */
export default function registerProcessListeners(main: Main): void {
  log.info('Registering process event listeners');

  // ==============================
  // 1. Uncaught Exceptions
  // ==============================
  process.on('uncaughtException', (error: Error) => {
    log.error('Uncaught exception in main process:', error);
    
    // Show error dialog if app is ready
    if (app.isReady()) {
      dialog.showErrorBox(
        'Unexpected Error',
        `An unexpected error occurred: ${error.message}\n\nThe application may not function correctly.`
      );
    }
    
    // Attempt to perform cleanup before potential crash
    try {
      main.cleanup().catch(cleanupError => {
        log.error('Error during cleanup after uncaught exception:', cleanupError);
      });
    } catch (cleanupError) {
      log.error('Error during synchronous cleanup after uncaught exception:', cleanupError);
    }
    
    // For non-critical errors, we might want to continue running
    // For critical errors, exit the process
    if (isCriticalError(error)) {
      log.error('Critical error detected, exiting application');
      process.exit(1);
    }
  });

  // ==============================
  // 2. Unhandled Promise Rejections
  // ==============================
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    log.error('Unhandled promise rejection:', reason);
    
    // Log additional context about the promise if available
    if (promise && typeof promise === 'object') {
      log.debug('Rejected promise details:', {
        promise: String(promise),
        stack: reason?.stack || 'No stack trace available'
      });
    }
    
    // In Node.js, unhandled rejections will soon terminate the process by default
    // For now, we'll just log them, but we might want to exit for critical errors
    if (isCriticalRejection(reason)) {
      log.error('Critical unhandled rejection, exiting application');
      
      // Perform cleanup before exit
      main.cleanup()
        .catch(cleanupError => {
          log.error('Error during cleanup after unhandled rejection:', cleanupError);
        })
        .finally(() => {
          process.exit(1);
        });
    }
  });

  // ==============================
  // 3. Process Warnings
  // ==============================
  process.on('warning', (warning: Error) => {
    log.warn('Process warning:', {
      name: warning.name,
      message: warning.message,
      stack: warning.stack
    });
    
    // For certain types of warnings, we might want to take specific actions
    if (warning.name === 'DeprecationWarning') {
      log.debug('Deprecation warning detected, consider updating affected code');
    } else if (warning.name === 'ExperimentalWarning') {
      log.debug('Experimental feature being used');
    } else if (warning.name === 'MaxListenersExceededWarning') {
      log.warn('Possible memory leak: too many event listeners');
    }
  });

  // ==============================
  // 4. Process Exit
  // ==============================
  process.on('exit', (code: number) => {
    // This handler must only use synchronous operations
    // as the event loop is no longer running at this point
    log.info(`Process is about to exit with code: ${code}`);
    
    // Perform any synchronous cleanup here
    try {
      // Synchronous cleanup operations only
      log.info('Performing synchronous cleanup before exit');
      
      // We can't use async operations here, so we're limited in what we can do
      // Most cleanup should be done in the 'beforeExit' event or app.on('will-quit')
    } catch (error) {
      // Can't use log.error here as it might be async
      console.error('Error during synchronous exit cleanup:', error);
    }
  });
  
  // beforeExit is emitted when Node.js empties its event loop and has no additional work to schedule
  // It will not be emitted if the process is explicitly terminated (e.g., process.exit())
  process.on('beforeExit', (code: number) => {
    log.info(`Process beforeExit event with code: ${code}`);
    
    // This can still use async operations as the event loop is still active
    main.cleanup().catch(error => {
      log.error('Error during cleanup in beforeExit handler:', error);
    });
  });

  // ==============================
  // 5. Signal Handlers
  // ==============================
  
  // SIGINT - Typically sent by Ctrl+C in terminal
  process.on('SIGINT', async () => {
    log.info('Received SIGINT signal (Ctrl+C)');
    
    try {
      // Perform cleanup
      await main.cleanup();
      log.info('Cleanup completed, exiting application');
      process.exit(0);
    } catch (error) {
      log.error('Error during cleanup after SIGINT:', error);
      process.exit(1);
    }
  });
  
  // SIGTERM - Termination signal sent by system (e.g., kill command)
  process.on('SIGTERM', async () => {
    log.info('Received SIGTERM signal');
    
    try {
      // Perform cleanup
      await main.cleanup();
      log.info('Cleanup completed, exiting application');
      process.exit(0);
    } catch (error) {
      log.error('Error during cleanup after SIGTERM:', error);
      process.exit(1);
    }
  });
  
  // SIGHUP - Terminal closed or session disconnected
  // Common in Unix-like systems
  if (process.platform !== 'win32') {
    process.on('SIGHUP', async () => {
      log.info('Received SIGHUP signal (terminal closed)');
      
      try {
        // Perform cleanup
        await main.cleanup();
        log.info('Cleanup completed, exiting application');
        process.exit(0);
      } catch (error) {
        log.error('Error during cleanup after SIGHUP:', error);
        process.exit(1);
      }
    });
  }

  log.info('Process event listeners registered successfully');
}

/**
 * Determines if an error is critical enough to warrant terminating the application
 * @param error - The error to check
 * @returns Whether the error is critical
 */
function isCriticalError(error: Error): boolean {
  // Implement logic to determine if an error is critical
  // This is application-specific and depends on what errors you consider fatal
  
  // Examples of potentially critical errors:
  // - Out of memory errors
  // - Errors related to core functionality
  
  if (error.message.includes('ENOMEM') || // Out of memory
      error.message.includes('ENOSPC') || // No space left on device
      error.message.includes('ERR_WORKER_OUT_OF_MEMORY') ||
      error.message.includes('JavaScript heap out of memory')) {
    return true;
  }
  
  // Check for specific error types that might indicate corruption
  if (error instanceof TypeError && 
      error.message.includes('Cannot read property') && 
      error.stack?.includes('Main.createWindow')) {
    // Critical error in window creation
    return true;
  }
  
  // By default, consider errors non-critical to keep the app running
  return false;
}

/**
 * Determines if an unhandled rejection is critical enough to warrant terminating the application
 * @param reason - The rejection reason to check
 * @returns Whether the rejection is critical
 */
function isCriticalRejection(reason: any): boolean {
  // Similar to isCriticalError, but for promise rejections
  
  // If reason is an Error, use the isCriticalError function
  if (reason instanceof Error) {
    return isCriticalError(reason);
  }
  
  // For non-Error rejections, check if they contain critical information
  if (typeof reason === 'string') {
    if (reason.includes('database corruption') ||
        reason.includes('critical failure') ||
        reason.includes('security breach')) {
      return true;
    }
  }
  
  // By default, consider rejections non-critical
  return false;
}
