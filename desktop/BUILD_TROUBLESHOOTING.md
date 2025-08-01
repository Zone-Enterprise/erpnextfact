# Desktop Build Troubleshooting Guide

This guide helps resolve common issues with the ERPNext Desktop build process.

## Common Issues and Solutions

### 1. Icon File Errors

**Problem**: Build fails with "Invalid icon file" or similar errors.

**Solution**: 
- Icons have been replaced with proper binary files. If you encounter this issue:
  ```bash
  cd desktop
  python3 build/scripts/create-icons.py
  ```

### 2. Missing Dependencies

**Problem**: `npm install` fails or dependencies are missing.

**Solution**:
- Use `npm ci` instead of `npm install` in CI environments
- Clear cache: `npm cache clean --force`
- Delete `node_modules` and `package-lock.json`, then reinstall:
  ```bash
  rm -rf node_modules package-lock.json
  npm install
  ```

### 3. TypeScript Compilation Errors

**Problem**: Build fails due to TypeScript errors.

**Solution**: The build is configured to continue even with TypeScript errors, but if you want to fix them:
- Update dependencies: `npm update`
- Add `--skipLibCheck` flag in `tsconfig.json`
- Fix type errors in your code

### 4. Electron Builder Errors

**Problem**: Electron packaging fails with platform-specific errors.

**Solution**:
- Ensure all required platform tools are installed:
  - **Windows**: Windows SDK, Visual Studio Build Tools
  - **macOS**: Xcode Command Line Tools
  - **Linux**: `libgtk-3-dev`, `libappindicator3-dev`, `librsvg2-dev`, `patchelf`

### 5. Server Bundle Preparation Fails

**Problem**: `prepare-server.mjs` fails or bench is not found.

**Solution**: This step is marked as `continue-on-error`, so the build should proceed. The desktop app will work without an embedded server.

### 6. Architecture Mismatch Errors

**Problem**: "Unsupported arch" errors from electron-builder.

**Solution**: The workflows now explicitly specify architectures. Ensure your build command includes proper arch flags.

## Build Environment Setup

### Local Development

1. Install Node.js 20 or later
2. Install Python 3.10 or later
3. Install platform-specific dependencies (see above)
4. Run:
   ```bash
   cd desktop
   npm install
   npm run build
   ```

### CI/CD Environment

The workflows are configured with:
- Node.js 20 with npm caching
- Python 3.10
- Platform-specific dependency installation
- Robust error handling

## Debugging Build Issues

### Enable Debug Output

Set environment variables:
```bash
export DEBUG=electron-builder
export NODE_ENV=production
```

### Check Build Artifacts

After a build, check these directories:
- `desktop/dist/` - Vite build output
- `desktop/dist_electron/` - Electron packaging output
- `desktop/dist_electron/bundled/` - Final packaged apps

### Common File Locations

- Icons: `desktop/build/icon.*` and `desktop/build/icons/`
- Main process: `desktop/main.ts` → `desktop/dist/main.js`
- Renderer process: `desktop/src/` → `desktop/dist/`
- Configuration: `desktop/electron-builder.json`

## Workflow-Specific Issues

### GitHub Actions Failures

Check these common issues:
1. **Dependencies not cached**: Workflows now use npm caching
2. **Icon files missing**: Icons are automatically generated
3. **Version conflicts**: Node.js and Python versions are pinned
4. **Build environment**: Required directories are created automatically

### Tag-based Releases

- Production releases: Use tags like `desktop-v1.0.0`
- Development releases: Use tags like `desktop-dev-v1.0.0-beta`

## Getting Help

If issues persist:
1. Check the full build logs for specific error messages
2. Verify all dependencies are correctly installed
3. Try building locally first to isolate CI-specific issues
4. Ensure your environment matches the workflow specifications

## Recent Fixes Applied

- ✅ Replaced placeholder icon files with valid binary files
- ✅ Added npm caching to speed up builds
- ✅ Improved dependency installation robustness
- ✅ Added build environment preparation
- ✅ Enhanced error handling and debugging output
- ✅ Fixed workflow trigger patterns for consistency
- ✅ Made TypeScript compilation more resilient