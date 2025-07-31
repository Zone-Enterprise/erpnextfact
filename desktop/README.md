# ERPNext Desktop

![ERPNext Desktop Logo](./assets/logo.png)

## Overview

ERPNext Desktop is an Electron-based wrapper for ERPNext that provides a native desktop application experience across Windows, macOS, and Linux platforms. It allows users to run ERPNext locally without complex server setup, making it accessible for small businesses and individual users.

### Key Features

- **Offline Capability**: Run ERPNext without an internet connection
- **Embedded Database**: Built-in MariaDB or SQLite database options
- **Simple Installation**: User-friendly installers for all major platforms
- **Auto-updates**: Seamless application updates
- **Native Experience**: Feels like a native application rather than a web app
- **Cross-Platform**: Works on Windows, macOS, and Linux
- **Zero Configuration**: No need for complex server setup
- **Data Portability**: Export and import your data easily
- **Automatic Backups**: Scheduled backups to prevent data loss
- **Resource Efficient**: Optimized for desktop environments

## System Requirements

### Windows
- Windows 10 or later (64-bit)
- 4GB RAM (8GB recommended)
- 2GB free disk space (5GB recommended)
- Intel/AMD processor (2GHz or faster)

### macOS
- macOS 10.15 (Catalina) or later
- 4GB RAM (8GB recommended)
- 2GB free disk space (5GB recommended)
- Intel or Apple Silicon processor

### Linux
- Ubuntu 20.04, Fedora 34, or equivalent modern distributions
- 4GB RAM (8GB recommended)
- 2GB free disk space (5GB recommended)
- Intel/AMD processor (2GHz or faster)

## Development Setup

### Prerequisites

- Node.js v20.18.1 or later
- Yarn package manager
- Git

### Setting Up Development Environment

1. **Clone the repository**

```bash
git clone https://github.com/Zone-Enterprise/erpnextfact.git
cd erpnextfact
```

2. **Install dependencies**

```bash
cd desktop
yarn install
```

3. **Start the development server**

```bash
yarn dev
```

This will start the Electron application in development mode with hot reloading.

### Project Structure

```
desktop/
├── assets/            # Application assets (icons, images, etc.)
├── build/             # Build-related files and scripts
│   └── scripts/       # Build scripts
├── config/            # Configuration files
├── main/              # Main process code
├── src/               # Renderer process code (Vue.js)
├── main.ts            # Main entry point for Electron
├── package.json       # Project dependencies and scripts
├── tsconfig.json      # TypeScript configuration
└── vite.config.ts     # Vite configuration
```

## Building Instructions

### Building for All Platforms

From the repository root:

```bash
./build-desktop.sh --all
```

### Platform-Specific Builds

#### Windows

```bash
./build-desktop.sh --windows
# or
cd desktop && yarn build --win
```

#### macOS

```bash
./build-desktop.sh --mac
# or
cd desktop && yarn build --mac
```

#### Linux

```bash
./build-desktop.sh --linux
# or
cd desktop && yarn build --linux
```

### Build Options

- `--dir`: Build unpacked directory only (no installers)
- `--clean`: Clean build directories before building

## Architecture Overview

ERPNext Desktop is built on several key technologies:

1. **Electron**: Provides the cross-platform desktop application framework
2. **Vue.js**: Powers the frontend user interface
3. **TypeScript**: Ensures type safety throughout the application
4. **SQLite/MariaDB**: Database options for storing ERPNext data
5. **Node.js**: Runs the server-side components

The application architecture consists of:

- **Main Process**: Handles application lifecycle, window management, and native OS integration
- **Renderer Process**: Manages the user interface using Vue.js
- **Server Process**: Runs the ERPNext server in the background
- **Database Process**: Manages the embedded database (MariaDB or SQLite)

Communication between processes is handled via Electron's IPC (Inter-Process Communication) mechanism, with a secure preload script exposing only necessary APIs to the renderer process.

## Configuration Options

ERPNext Desktop can be configured through the application settings or by editing the configuration files directly.

### Application Settings

The following settings can be configured through the UI:

- **Database Type**: Choose between MariaDB or SQLite
- **Server Port**: Configure the port for the ERPNext server
- **Auto-start Server**: Whether to start the server automatically on application launch
- **Update Channel**: Choose between stable, beta, or alpha update channels
- **Auto-check Updates**: Enable/disable automatic update checking

### Advanced Configuration

Advanced users can modify configuration files located in:

- Windows: `%APPDATA%\erpnext-desktop\config\`
- macOS: `~/Library/Application Support/erpnext-desktop/config/`
- Linux: `~/.config/erpnext-desktop/config/`

## Troubleshooting Guide

### Common Issues

#### Application Won't Start

1. **Check logs**: 
   - Windows: `%APPDATA%\erpnext-desktop\logs\`
   - macOS: `~/Library/Application Support/erpnext-desktop/logs/`
   - Linux: `~/.config/erpnext-desktop/logs/`

2. **Verify database**: Ensure your database is not corrupted.

3. **Reset application**: 
   - Windows: Delete `%APPDATA%\erpnext-desktop\`
   - macOS: Delete `~/Library/Application Support/erpnext-desktop/`
   - Linux: Delete `~/.config/erpnext-desktop/`

#### Server Won't Start

1. Check if the port is already in use by another application
2. Verify that your system meets the minimum requirements
3. Check server logs for specific error messages

#### Database Connection Issues

1. For MariaDB, verify that the service is running
2. For SQLite, check file permissions on the database file
3. Try switching to a different database type in the settings

### Getting Help

If you encounter issues not covered in this guide:

1. Check the [GitHub Issues](https://github.com/Zone-Enterprise/erpnextfact/issues) for similar problems
2. Create a new issue with detailed information about your problem
3. Include logs and system information when reporting issues

## License

ERPNext Desktop is licensed under the GNU General Public License v3.0 (GPL-3.0).

## Contributing

Contributions are welcome! Please see our [Contributing Guidelines](../CONTRIBUTING.md) for more information.
