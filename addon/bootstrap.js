// addon/bootstrap.js - Bootstrap with chrome protocol registration
var Zotero;
var Services;
var chromeHandle;

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
  
  // Register chrome protocol - CRITICAL for preferences and resources
  var aomStartup = Components.classes[
    "@mozilla.org/addons/addon-manager-startup;1"
  ].getService(Components.interfaces.amIAddonManagerStartup);
  var manifestURI = Services.io.newURI(rootURI + "manifest.json");
  chromeHandle = aomStartup.registerChrome(manifestURI, [
    ["content", "nanopub", rootURI + "chrome/content/"],
  ]);
  
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
    
    // Cleanup chrome registration
    if (chromeHandle) {
      chromeHandle.destruct();
      chromeHandle = null;
    }
  }
}
