// src/index.ts
import { log, error } from "./utils/logger";
import { NanopubDisplay } from "./modules/nanopubDisplay";
import { NanopubSearch } from "./modules/nanopubSearch";
import { MenuManager } from "./modules/menu";
import { ZoteroNanopubCreator } from './modules/nanopubCreator';
import { registerPrefsWindow } from './modules/preferenceWindow';
import { ReaderIntegration } from './modules/readerIntegration';

// Declare global types
declare global {
  var Zotero: any;
  var Services: any;
}

// Helper function for saving profile from preferences
// Must be defined before onStartup uses it
async function setupProfileFromPrefs() {
  try {
    const name = Zotero.Prefs.get('extensions.nanopub.profile.name', true);
    const orcid = Zotero.Prefs.get('extensions.nanopub.profile.orcid', true);
    
    if (!name || !orcid) {
      Services.prompt.alert(
        null, 
        'Incomplete Profile', 
        'Please fill in both Name and ORCID fields.'
      );
      return;
    }
    
    // Format ORCID
    const formattedOrcid = orcid.startsWith('https://orcid.org/') 
      ? orcid 
      : `https://orcid.org/${orcid}`;
    
    // Setup profile using the creator
    await Zotero.Nanopub.creator.setupProfile(name, formattedOrcid);
    
    Services.prompt.alert(
      null, 
      'Profile Saved', 
      `Profile saved successfully!\n\nName: ${name}\nORCID: ${formattedOrcid}`
    );
  } catch (err: any) {
    Services.prompt.alert(
      null, 
      'Error', 
      `Failed to save profile:\n${err.message}`
    );
  }
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
  let readerIntegration: ReaderIntegration | null = null;

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

      // Register preferences window
      registerPrefsWindow();
      log("Preferences window registered");

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
      
      // Initialize nanopub creator
      try {
        nanopubCreator = new ZoteroNanopubCreator();
        await nanopubCreator.init();
        Zotero.Nanopub.creator = nanopubCreator;
        
        // Add helper functions for preferences
        Zotero.Nanopub.setupProfileFromPrefs = setupProfileFromPrefs;
        Zotero.Nanopub.showProfileInfo = () => nanopubCreator?.showProfileInfo();
        
        log("✅ Nanopub creator initialized successfully");
      } catch (err: any) {
        error("⚠️ Failed to initialize nanopub creator:", err);
        // Don't throw - let plugin continue without creation features
      }

      // Initialize PDF reader integration
      try {
        readerIntegration = new ReaderIntegration();
        readerIntegration.register();
        Zotero.Nanopub.readerIntegration = readerIntegration;
        log("✅ PDF reader integration initialized successfully");
      } catch (err: any) {
        error("⚠️ Failed to initialize reader integration:", err);
        // Don't throw - let plugin continue without reader integration
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
      
      // Cleanup reader integration
      if (readerIntegration) {
        readerIntegration.unregister();
        readerIntegration = null;
      }
      
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