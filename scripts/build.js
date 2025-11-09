const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

async function build() {
  console.log('🔨 Starting build process...');
  
  // Clean build directory
  const buildDir = path.join(__dirname, '..', 'build');
  if (fs.existsSync(buildDir)) {
    fs.rmSync(buildDir, { recursive: true });
  }
  fs.mkdirSync(buildDir, { recursive: true });

  // Copy addon files
  const addonDir = path.join(__dirname, '..', 'addon');
  const buildAddonDir = path.join(buildDir, 'addon');
  
  if (fs.existsSync(addonDir)) {
    copyRecursive(addonDir, buildAddonDir);
  } else {
    fs.mkdirSync(buildAddonDir, { recursive: true });
  }

  // Create necessary directories
  const scriptsDir = path.join(buildAddonDir, 'content', 'scripts');
  const stylesDir = path.join(buildAddonDir, 'content', 'styles');
  const iconsDir = path.join(buildAddonDir, 'content', 'icons');
  
  fs.mkdirSync(scriptsDir, { recursive: true });
  fs.mkdirSync(stylesDir, { recursive: true });
  fs.mkdirSync(iconsDir, { recursive: true });

  console.log('📦 Building TypeScript with nanopub-view...');
  
  // Build TypeScript with comprehensive polyfills
  await esbuild.build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    outfile: path.join(scriptsDir, 'index.js'),
    platform: 'browser',
    target: 'firefox102',
    format: 'iife',
    globalName: 'ZoteroNanopub',
    external: ['zotero-plugin-toolkit'],
    // Comprehensive polyfill for browser APIs
    banner: {
      js: `
        // Comprehensive browser API polyfill for Zotero environment
        (function() {
          // Polyfill window
          if (typeof window === 'undefined') {
            globalThis.window = globalThis;
          }
          
          // Polyfill document
          if (typeof document === 'undefined' && typeof Zotero !== 'undefined') {
            try {
              globalThis.document = Zotero.getMainWindow().document;
            } catch (e) {
              // Will be set later when window is available
            }
          }
          
          // Polyfill console with Zotero logging
          if (typeof console === 'undefined') {
            globalThis.console = {
              log: function() {
                try {
                  var args = Array.prototype.slice.call(arguments);
                  if (typeof Services !== 'undefined' && Services.console) {
                    Services.console.logStringMessage('[nanopub-view] ' + args.join(' '));
                  }
                } catch (e) {}
              },
              warn: function() {
                try {
                  var args = Array.prototype.slice.call(arguments);
                  if (typeof Services !== 'undefined' && Services.console) {
                    Services.console.logStringMessage('[nanopub-view WARN] ' + args.join(' '));
                  }
                } catch (e) {}
              },
              error: function() {
                try {
                  var args = Array.prototype.slice.call(arguments);
                  if (typeof Services !== 'undefined' && Services.console) {
                    Services.console.logStringMessage('[nanopub-view ERROR] ' + args.join(' '));
                  }
                } catch (e) {}
              },
              info: function() {
                try {
                  var args = Array.prototype.slice.call(arguments);
                  if (typeof Services !== 'undefined' && Services.console) {
                    Services.console.logStringMessage('[nanopub-view INFO] ' + args.join(' '));
                  }
                } catch (e) {}
              },
              debug: function() {
                // Silent for debug
              }
            };
          }
          
          // Polyfill fetch if not available 
          if (typeof fetch === 'undefined') {
            globalThis.fetch = async function(url, options) {
              // Use Zotero's HTTP request
              return new Promise((resolve, reject) => {
                try {
                  var xhr = new XMLHttpRequest();
                  xhr.open(options && options.method || 'GET', url);
                  
                  // Add Accept header for RDF formats
                  xhr.setRequestHeader('Accept', 'application/trig, text/turtle, application/ld+json, application/json');
                  
                  if (options && options.headers) {
                    for (var key in options.headers) {
                      xhr.setRequestHeader(key, options.headers[key]);
                    }
                  }
                  
                  xhr.onload = function() {
                    var isSuccess = xhr.status >= 200 && xhr.status < 300;
                    
                    // Log the response for debugging
                    if (typeof console !== 'undefined') {
                      console.log('[fetch] ' + url + ' -> ' + xhr.status);
                      if (!isSuccess || xhr.responseText.length < 500) {
                        console.log('[fetch] Response preview:', xhr.responseText.substring(0, 200));
                      }
                    }
                    
                    resolve({
                      ok: isSuccess,
                      status: xhr.status,
                      statusText: xhr.statusText,
                      headers: {
                        get: function(name) {
                          return xhr.getResponseHeader(name);
                        }
                      },
                      text: function() { 
                        return Promise.resolve(xhr.responseText); 
                      },
                      json: function() { 
                        return new Promise(function(resolveJson, rejectJson) {
                          try {
                            // Validate JSON before parsing
                            var text = xhr.responseText.trim();
                            if (!text) {
                              console.error('[fetch] Empty response body from:', url);
                              rejectJson(new Error('Empty response body'));
                              return;
                            }
                            
                            // Check if it starts with JSON markers
                            if (!text.startsWith('{') && !text.startsWith('[')) {
                              console.error('[fetch] Response is not JSON from:', url);
                              console.error('[fetch] Response starts with:', text.substring(0, 100));
                              rejectJson(new Error('Response is not JSON: ' + text.substring(0, 50)));
                              return;
                            }
                            
                            var parsed = JSON.parse(text);
                            resolveJson(parsed);
                          } catch (e) {
                            console.error('[fetch] JSON parse error from:', url);
                            console.error('[fetch] Error:', e.message);
                            console.error('[fetch] Response text:', xhr.responseText.substring(0, 200));
                            rejectJson(new Error('JSON parse failed: ' + e.message));
                          }
                        });
                      }
                    });
                  };
                  
                  xhr.onerror = function() {
                    console.error('[fetch] Network error for:', url);
                    reject(new Error('Network error'));
                  };
                  
                  xhr.ontimeout = function() {
                    console.error('[fetch] Timeout for:', url);
                    reject(new Error('Request timeout'));
                  };
                  
                  // Set timeout (30 seconds)
                  xhr.timeout = 30000;
                  
                  xhr.send(options && options.body);
                } catch (e) {
                  console.error('[fetch] Exception:', e);
                  reject(e);
                }
              });
            };
          }
        })();
      `
    }
  });

  console.log('🎨 Copying CSS files...');
  
  // Copy nanopub-view CSS
  const nanopubViewCss = path.join(__dirname, '..', 'node_modules', '@sciencelivehub', 'nanopub-view', 'dist', 'nanopub-view.css');
  const nanopubViewDest = path.join(stylesDir, 'nanopub-view.css');
  
  if (fs.existsSync(nanopubViewCss)) {
    fs.copyFileSync(nanopubViewCss, nanopubViewDest);
    console.log('✅ Copied nanopub-view.css');
  } else {
    console.warn('⚠️  Warning: nanopub-viewer.css not found');
  }

  // Copy nanopub-create CSS (NEW)
  const nanopubCreateCss = path.join(__dirname, '..', 'node_modules', '@sciencelivehub', 'nanopub-create', 'dist', 'nanopub-creator.css');
  const nanopubCreateDest = path.join(stylesDir, 'nanopub-creator.css');

  if (fs.existsSync(nanopubCreateCss)) {
    fs.copyFileSync(nanopubCreateCss, nanopubCreateDest);
    console.log('✅ Copied nanopub-creator.css');
  } else {
    console.warn('⚠️  Warning: nanopub-creator.css not found');
  }

  console.log('📝 Creating manifest...');
  
  // Create manifest
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const manifest = {
    "manifest_version": 2,
    "name": pkg.config.addonName,
    "version": pkg.version,
    "description": pkg.description,
    "author": pkg.author,
    "homepage_url": pkg.homepage,
    "applications": {
      "zotero": {
        "id": pkg.config.addonID,
        "update_url": `${pkg.homepage}/releases/latest/download/updates.json`,
        "strict_min_version": "6.999",
        "strict_max_version": "8.0.*"
      }
    },
    "icons": {
      "48": "content/icons/icon.png",
      "96": "content/icons/icon@2x.png"
    }
  };
  
  fs.writeFileSync(
    path.join(buildAddonDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  console.log('📦 Creating XPI package...');
  
  // Create XPI
  const archiver = require('archiver');
  const output = fs.createWriteStream(path.join(buildDir, 'nanopub.xpi'));
  const archive = archiver('zip', { zlib: { level: 9 } });

  output.on('close', () => {
    console.log(`✅ Build complete: build/nanopub.xpi (${archive.pointer()} bytes)`);
  });

  archive.on('error', (err) => {
    throw err;
  });

  archive.pipe(output);
  archive.directory(buildAddonDir, false);
  await archive.finalize();
}

function copyRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

build().catch((error) => {
  console.error('❌ Build failed:', error);
  process.exit(1);
});
