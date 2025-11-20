#!/bin/bash

echo "🔨 Building dependencies..."

# Build nanopub-view
echo "📦 Building nanopub-view..."
cd node_modules/@sciencelivehub/nanopub-view

# Install its dependencies
npm install

# Create temporary library-only vite config
cat > vite.lib.config.js << 'VITE_EOF'
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.js'),
      name: 'NanopubViewer',
      formats: ['es', 'umd'],
      fileName: (format) => {
        if (format === 'es') return 'nanopub-viewer.esm.js';
        if (format === 'umd') return 'nanopub-viewer.js';
      }
    },
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'style.css') return 'nanopub-viewer.css';
          return assetInfo.name;
        }
      }
    }
  }
});
VITE_EOF

# Build it
npx vite build --config vite.lib.config.js

cd ../../..

echo "✅ nanopub-view built"
ls -lah node_modules/@sciencelivehub/nanopub-view/dist/

# Build nanopub-create
echo "📦 Building nanopub-create with WASM inlining..."
cd node_modules/@sciencelivehub/nanopub-create

# Install its dependencies
npm install

echo "🔍 Checking for WASM files before build..."
find node_modules/@nanopub/sign -name "*.wasm" 2>/dev/null || echo "No WASM files found"

# Build it (now with WASM inlining)
echo "🔨 Building with vite.lib.config.js..."
npx vite build --config vite.lib.config.js

echo "✅ nanopub-create built"
echo "📊 Build output:"
ls -lah dist/

echo "📏 Bundle sizes:"
du -h dist/nanopub-creator.esm.js
du -h dist/nanopub-creator.js

echo "🔍 Checking for WASM files in output (should be none)..."
find dist/ -name "*.wasm" 2>/dev/null || echo "✅ No separate WASM files (good - it's inlined!)"

cd ../../..

echo "✅ All dependencies built successfully"
