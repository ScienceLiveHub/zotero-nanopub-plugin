#!/bin/bash

echo "🔨 Building dependencies..."

# Build nanopub-view
echo "📦 Building nanopub-view..."
cd node_modules/@sciencelivehub/nanopub-view

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

npx vite build --config vite.lib.config.js

cd ../../..

echo "✅ Dependencies built successfully"
ls -lah node_modules/@sciencelivehub/nanopub-view/dist/
