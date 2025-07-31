#!/bin/bash
# ============================================================================
# ERPNext Desktop Application Build Script
# ============================================================================
# This script builds the ERPNext desktop application for Windows, macOS, and Linux
# It should be run from the repository root directory
# ============================================================================

# Exit on error
set -e

# Script version
VERSION="1.0.0"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default build target (current platform)
TARGET=""

# Directory paths
REPO_ROOT="$(pwd)"
DESKTOP_DIR="$REPO_ROOT/desktop"

# Function to display usage information
show_usage() {
    echo -e "${BLUE}ERPNext Desktop Application Build Script v${VERSION}${NC}"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  -h, --help            Show this help message"
    echo "  -w, --windows         Build for Windows"
    echo "  -m, --mac             Build for macOS"
    echo "  -l, --linux           Build for Linux"
    echo "  -a, --all             Build for all platforms"
    echo "  -d, --dir             Build unpacked directory only (no installers)"
    echo "  --clean               Clean build directories before building"
    echo ""
    echo "Examples:"
    echo "  $0                    Build for current platform"
    echo "  $0 --windows          Build for Windows"
    echo "  $0 --mac --linux      Build for macOS and Linux"
    echo "  $0 --all              Build for all platforms"
    echo "  $0 --clean --windows  Clean and build for Windows"
    echo ""
}

# Function to log messages
log() {
    local level="$1"
    local message="$2"
    local color=""
    
    case "$level" in
        "info")
            color="${BLUE}"
            ;;
        "success")
            color="${GREEN}"
            ;;
        "warning")
            color="${YELLOW}"
            ;;
        "error")
            color="${RED}"
            ;;
        *)
            color="${NC}"
            ;;
    esac
    
    echo -e "${color}[$(date '+%Y-%m-%d %H:%M:%S')] $message${NC}"
}

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check dependencies
check_dependencies() {
    log "info" "Checking dependencies..."
    
    # Check for Node.js
    if ! command_exists node; then
        log "error" "Node.js is not installed. Please install Node.js v20.18.1 or later."
        exit 1
    fi
    
    # Check Node.js version
    NODE_VERSION=$(node -v | cut -d 'v' -f 2)
    NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d '.' -f 1)
    
    if [ "$NODE_MAJOR" -lt 20 ]; then
        log "error" "Node.js version $NODE_VERSION is not supported. Please use Node.js v20.18.1 or later."
        exit 1
    fi
    
    # Check for npm
    if ! command_exists npm; then
        log "error" "npm is not installed. Please install npm."
        exit 1
    fi
    
    # Check for yarn
    if ! command_exists yarn; then
        log "warning" "yarn is not installed. Installing yarn..."
        npm install -g yarn
    fi
    
    log "success" "All dependencies are satisfied."
}

# Function to clean build directories
clean_build() {
    log "info" "Cleaning build directories..."
    
    if [ -d "$DESKTOP_DIR/dist" ]; then
        rm -rf "$DESKTOP_DIR/dist"
    fi
    
    if [ -d "$DESKTOP_DIR/dist_electron" ]; then
        rm -rf "$DESKTOP_DIR/dist_electron"
    fi
    
    log "success" "Build directories cleaned."
}

# Function to install dependencies
install_dependencies() {
    log "info" "Installing dependencies..."
    
    cd "$DESKTOP_DIR" || {
        log "error" "Failed to navigate to desktop directory: $DESKTOP_DIR"
        exit 1
    }
    
    # Install dependencies using yarn
    yarn install || {
        log "error" "Failed to install dependencies."
        exit 1
    }
    
    log "success" "Dependencies installed successfully."
}

# Function to build the application
build_app() {
    local build_args=""
    
    # Set build arguments based on target
    case "$TARGET" in
        "windows")
            build_args="--win"
            ;;
        "mac")
            build_args="--mac"
            ;;
        "linux")
            build_args="--linux"
            ;;
        "all")
            build_args="--win --mac --linux"
            ;;
        "dir")
            build_args="--dir"
            ;;
        *)
            # Default to current platform
            build_args=""
            ;;
    esac
    
    log "info" "Building ERPNext Desktop Application${TARGET:+ for $TARGET}..."
    
    # Run build command
    cd "$DESKTOP_DIR" || {
        log "error" "Failed to navigate to desktop directory: $DESKTOP_DIR"
        exit 1
    }
    
    # Build with the specified arguments
    yarn build $build_args || {
        log "error" "Build failed."
        exit 1
    }
    
    log "success" "Build completed successfully."
}

# Function to detect platform
detect_platform() {
    if [ -z "$TARGET" ]; then
        case "$(uname -s)" in
            Darwin*)
                TARGET="mac"
                log "info" "Detected platform: macOS"
                ;;
            Linux*)
                TARGET="linux"
                log "info" "Detected platform: Linux"
                ;;
            CYGWIN*|MINGW*|MSYS*)
                TARGET="windows"
                log "info" "Detected platform: Windows"
                ;;
            *)
                log "warning" "Unknown platform. Building for all platforms."
                TARGET="all"
                ;;
        esac
    fi
}

# Parse command line arguments
while [ "$#" -gt 0 ]; do
    case "$1" in
        -h|--help)
            show_usage
            exit 0
            ;;
        -w|--windows)
            if [ -z "$TARGET" ]; then
                TARGET="windows"
            elif [ "$TARGET" != "all" ]; then
                TARGET="all"
            fi
            shift
            ;;
        -m|--mac)
            if [ -z "$TARGET" ]; then
                TARGET="mac"
            elif [ "$TARGET" != "all" ]; then
                TARGET="all"
            fi
            shift
            ;;
        -l|--linux)
            if [ -z "$TARGET" ]; then
                TARGET="linux"
            elif [ "$TARGET" != "all" ]; then
                TARGET="all"
            fi
            shift
            ;;
        -a|--all)
            TARGET="all"
            shift
            ;;
        -d|--dir)
            TARGET="dir"
            shift
            ;;
        --clean)
            CLEAN_BUILD=true
            shift
            ;;
        *)
            log "error" "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Main execution
log "info" "Starting ERPNext Desktop build process..."

# Check if we're in the repository root
if [ ! -d "./desktop" ]; then
    log "error" "Please run this script from the repository root directory."
    exit 1
fi

# Detect platform if not specified
detect_platform

# Check dependencies
check_dependencies

# Clean build if requested
if [ "$CLEAN_BUILD" = true ]; then
    clean_build
fi

# Install dependencies
install_dependencies

# Build the application
build_app

# Show output location
OUTPUT_DIR="$DESKTOP_DIR/dist_electron/bundled"
log "info" "Build output is available in: $OUTPUT_DIR"

# Final success message
log "success" "ERPNext Desktop build process completed successfully."
exit 0
