// addon/bootstrap.js - Minimal bootstrap that loads TypeScript
var Zotero;
var Services;

function install(data, reason) {}
function uninstall(data, reason) {}

async function startup({ id, version, resourceURI, rootURI = resourceURI.spec } = {}, reason) {
  // Get Zotero and Services FIRST
  if (!Zotero) {
    Zotero = Components.classes["@zotero.org/Zotero;1"]
      .getService(Components.interfaces.nsISupports)
      .wrappedJSObject;
  }
  
  if (!Services) {
    Services = globalThis.Services;
  }
  
  // Make them globally available for the loaded script
  globalThis.Zotero = Zotero;
  globalThis.Services = Services;
  
  await Zotero.initializationPromise;
  await Zotero.uiReadyPromise;
  
  // Now load the compiled TypeScript bundle
  try {
    Services.scriptloader.loadSubScript(
      rootURI + 'content/scripts/index.js'
    );
    
    // Call the startup function from TypeScript
    if (Zotero.Nanopub && Zotero.Nanopub.onStartup) {
      await Zotero.Nanopub.onStartup({ id, version, rootURI });
    }
  } catch (e) {
    Services.console.logStringMessage('Nanopub Plugin startup error: ' + e.message);
    throw e;
  }
}

function shutdown(data, reason) {
  if (reason !== APP_SHUTDOWN) {
    try {
      if (Zotero.Nanopub && Zotero.Nanopub.onShutdown) {
        Zotero.Nanopub.onShutdown();
      }
    } catch (e) {
      if (typeof Services !== 'undefined' && Services.console) {
        Services.console.logStringMessage('Nanopub Plugin shutdown error: ' + e.message);
      }
    }
  }
}
