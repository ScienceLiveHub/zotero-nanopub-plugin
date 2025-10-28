// src/index.ts
import { log, error } from "./utils/logger";
import { NanopubDisplay } from "./modules/nanopubDisplay";
import { NanopubSearch } from "./modules/nanopubSearch";
import { MenuManager } from "./modules/menu";
import { ZoteroNanopubCreator } from './modules/nanopubCreator';

// Declare global types
declare global {
  var Zotero: any;
  var Services: any;
}

// Initialize plugin namespace
const initPlugin = () => {
  if (typeof Zotero === 'undefined') {
    return;
  }
  
  if (!Zotero.Nanopub) {
    Zotero.Nanopub = {};
  }

  let displayModule: NanopubDisplay | null = null;
  let searchModule: NanopubSearch | null = null;
  let menuManager: MenuManager | null = null;
  let nanopubCreator: ZoteroNanopubCreator | null = null;

  Zotero.Nanopub.onStartup = async function({
    id,
    version,
    rootURI,
  }: {
    id: string;
    version: string;
    rootURI: string;
  }) {
    try {
      log("=================================");
      log("Nanopub Plugin starting...");
      log("Version: " + version);
      log("Root URI: " + rootURI);
      
      // Wait for Zotero to be ready
      if (Zotero.uiReadyPromise) {
        await Zotero.uiReadyPromise;
        log("Zotero UI is ready");
      }

      // Initialize display module
      displayModule = new NanopubDisplay();
      Zotero.Nanopub.displayModule = displayModule;
      log("Display module initialized successfully");

      // Initialize search module
      searchModule = new NanopubSearch();
      Zotero.Nanopub.searchModule = searchModule;
      log("Search module initialized successfully");

      // Initialize menu manager
      menuManager = new MenuManager({ id, version, rootURI });
      await menuManager.registerMenus();
      Zotero.Nanopub.menuManager = menuManager;
      log("Menu manager initialized successfully");
      
      // Initialize nanopub creator (NEW)
      try {
        nanopubCreator = new ZoteroNanopubCreator();
        await nanopubCreator.init();
        Zotero.Nanopub.creator = nanopubCreator;
        log("✅ Nanopub creator initialized successfully");
      } catch (err: any) {
        error("⚠️ Failed to initialize nanopub creator:", err);
        // Don't throw - let plugin continue without creation features
      }
      
      log("Nanopub Plugin started successfully!");
      log("=================================");
      
    } catch (err: any) {
      error("Failed to start Nanopub Plugin:", err);
      throw err;
    }
  };

  Zotero.Nanopub.onShutdown = function() {
    try {
      log("Nanopub Plugin shutting down...");
      
      if (menuManager) {
        menuManager.cleanup();
      }
      
      displayModule = null;
      searchModule = null;
      menuManager = null;
      nanopubCreator = null;
    } catch (err: any) {
      error("Failed to shutdown properly:", err);
    }
  };
};

// Initialize when script loads
initPlugin();
