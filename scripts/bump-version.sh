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

# Update manifest.json
sed -i.bak "s/\"version\": \"[^\"]*\"/\"version\": \"$NEW_VERSION\"/" manifest.json
rm manifest.json.bak

# Update package.json if it exists
if [ -f package.json ]; then
    sed -i.bak "s/\"version\": \"[^\"]*\"/\"version\": \"$NEW_VERSION\"/" package.json
    rm package.json.bak
fi

echo "Updated version to $NEW_VERSION"

# Show changes
echo "Changes made:"
git diff manifest.json

# Commit changes
read -p "Commit changes and create tag? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    git add manifest.json
    [ -f package.json ] && git add package.json
    git commit -m "Bump version to $NEW_VERSION"
    git tag "v$NEW_VERSION"
    
    echo "Created commit and tag v$NEW_VERSION"
    echo "To trigger release, run: git push origin main --tags"
else
    echo "Changes not committed. Run 'git checkout .' to revert."
fi
