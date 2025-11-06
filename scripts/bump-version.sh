#!/bin/bash

# Script to bump version and create release

set -e

if [ $# -eq 0 ]; then
    echo "Usage: $0 <version>"
    echo "Example: $0 1.0.3"
    exit 1
fi

NEW_VERSION=$1

# Validate version format
if ! [[ $NEW_VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Error: Version must be in format X.Y.Z (e.g., 1.0.3)"
    exit 1
fi

echo "Bumping version to $NEW_VERSION..."

# Use npm to update the version (this handles both package.json and package-lock.json correctly)
npm version $NEW_VERSION --no-git-tag-version

echo ""
echo "✅ Updated version to $NEW_VERSION"
echo ""
echo "Note: manifest.json will be automatically generated during build from package.json"

# Show changes
echo ""
echo "Changes made:"
git diff package.json package-lock.json | head -50

# Commit changes
echo ""
read -p "Commit changes and create tag? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    git add package.json package-lock.json
    git commit -m "Bump version to $NEW_VERSION"
    git tag "v$NEW_VERSION"
    
    echo ""
    echo "✅ Created commit and tag v$NEW_VERSION"
    echo ""
    echo "To trigger release, run:"
    echo "  git push origin main --tags"
else
    echo ""
    echo "Changes not committed. Run 'git checkout .' to revert."
fi
