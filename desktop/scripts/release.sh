#!/bin/bash
# ERPNext Desktop Release Script
# This script facilitates creating new releases for the ERPNext desktop application

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Function to print error message and exit
error_exit() {
    echo -e "${RED}ERROR: $1${NC}" >&2
    exit 1
}

# Function to print success message
success_msg() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Function to print info message
info_msg() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Function to print warning message
warning_msg() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Print banner
echo -e "${BOLD}ERPNext Desktop Release Script${NC}"
echo "==============================="
echo ""

# Check if version argument is provided
if [ $# -ne 1 ]; then
    error_exit "Version number is required. Usage: $0 <version>"
fi

VERSION=$1

# Validate version format (should be semver: x.y.z or x.y.z-suffix)
if ! [[ $VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.-]+)?$ ]]; then
    error_exit "Invalid version format. Please use semantic versioning (e.g., 1.0.0 or 1.0.0-beta.1)"
fi

# Store the root directory of the project
ROOT_DIR=$(git rev-parse --show-toplevel)
if [ $? -ne 0 ]; then
    error_exit "Not in a git repository"
fi

# Change to the root directory
cd "$ROOT_DIR" || error_exit "Could not change to repository root directory"

# Check if we're on the correct branch
CURRENT_BRANCH=$(git symbolic-ref --short HEAD)
if [ "$CURRENT_BRANCH" != "droid/erpnext-desktop-installer" ]; then
    error_exit "Not on 'droid/erpnext-desktop-installer' branch. Current branch: $CURRENT_BRANCH"
fi

# Check if the working directory is clean
if [ -n "$(git status --porcelain)" ]; then
    error_exit "Working directory is not clean. Please commit or stash your changes first."
fi

info_msg "Preparing release for ERPNext Desktop v${VERSION}..."

# Check if desktop directory exists
if [ ! -d "$ROOT_DIR/desktop" ]; then
    error_exit "Desktop directory not found. Are you in the correct repository?"
fi

# Update version in package.json
info_msg "Updating version in package.json..."
cd "$ROOT_DIR/desktop" || error_exit "Could not change to desktop directory"
npm version "$VERSION" --no-git-tag-version --allow-same-version > /dev/null
if [ $? -ne 0 ]; then
    error_exit "Failed to update version in package.json"
fi
success_msg "Updated package.json version to $VERSION"

# Commit the version change
info_msg "Committing version change..."
git add "$ROOT_DIR/desktop/package.json"
git commit -m "chore: bump desktop version to $VERSION"
if [ $? -ne 0 ]; then
    error_exit "Failed to commit version change"
fi
success_msg "Committed version change"

# Create a git tag
TAG_NAME="desktop-v$VERSION"
info_msg "Creating git tag: $TAG_NAME..."
git tag -a "$TAG_NAME" -m "ERPNext Desktop v$VERSION"
if [ $? -ne 0 ]; then
    error_exit "Failed to create git tag"
fi
success_msg "Created git tag: $TAG_NAME"

# Push changes and tag to remote
info_msg "Pushing changes and tag to remote..."
git push origin "$CURRENT_BRANCH" "$TAG_NAME"
PUSH_STATUS=$?

if [ $PUSH_STATUS -ne 0 ]; then
    warning_msg "Failed to push changes to remote. You'll need to push manually:"
    echo -e "  ${BOLD}git push origin $CURRENT_BRANCH $TAG_NAME${NC}"
    exit 1
fi

success_msg "Successfully pushed changes and tag to remote"

# Display success message and next steps
echo ""
echo -e "${GREEN}${BOLD}Release preparation complete!${NC}"
echo -e "Version: ${BOLD}$VERSION${NC}"
echo -e "Tag: ${BOLD}$TAG_NAME${NC}"
echo ""
echo -e "${BLUE}${BOLD}Next steps:${NC}"
echo -e "1. The GitHub Actions workflow should start automatically to build the desktop application."
echo -e "2. You can monitor the progress at: ${BOLD}https://github.com/Zone-Enterprise/erpnextfact/actions${NC}"
echo -e "3. If the workflow doesn't start automatically, you can trigger it manually:"
echo -e "   - Go to: ${BOLD}https://github.com/Zone-Enterprise/erpnextfact/actions/workflows/desktop-release.yml${NC}"
echo -e "   - Click 'Run workflow'"
echo -e "   - Select branch: ${BOLD}$CURRENT_BRANCH${NC}"
echo -e "   - Enter version: ${BOLD}$VERSION${NC}"
echo -e "   - Click 'Run workflow'"
echo ""
echo -e "${GREEN}${BOLD}Done!${NC}"

exit 0
