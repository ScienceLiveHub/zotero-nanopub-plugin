// src/modules/menu.ts
import { log, error } from "../utils/logger";
import { NanopubCreationDialog } from "./nanopubCreationDialog";
import { TemplateFormDialog } from "./templateFormDialog";
import { TemplateBrowser } from "./templateBrowser";
import { TemplateFormDialog } from "./templateFormDialog";


export class MenuManager {
  private addon: any;

  constructor(addon: any) {
    this.addon = addon;
  }

  /**
   * Register all menu items
   */
  async registerMenus() {
    try {
      log("Registering menu items...");

      // Wait a bit for UI to be fully ready
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Register File menu items
      this.registerFileMenu();

      // Register context menu items
      this.registerContextMenu();

      // Register nanopub creation menu items
      this.registerNanopubCreationMenus();

      log("Menu items registered successfully");
    } catch (err: any) {
      error("Failed to register menus:", err);
      throw err;
    }
  }

  /**
   * Register File menu items for importing nanopubs
   */
  private registerFileMenu() {
    try {
      const win = Zotero.getMainWindow();
      if (!win) {
        error("No main window available");
        return;
      }

      const doc = win.document;
      const fileMenu = doc.getElementById('menu_FilePopup');
      
      if (!fileMenu) {
        error("File menu popup not found");
        return;
      }

      log("Found file menu, creating menu items...");

      // Create separator
      const separator = doc.createXULElement ? 
        doc.createXULElement('menuseparator') : 
        doc.createElement('menuseparator');
      separator.id = 'nanopub-separator';
      
      // Create "Import as New Item" menu item
      const newItemMenuItem = doc.createXULElement ? 
        doc.createXULElement('menuitem') : 
        doc.createElement('menuitem');
      newItemMenuItem.id = 'nanopub-import-new-item';
      newItemMenuItem.setAttribute('label', 'Import Nanopublication as New Item...');
      
      const self = this;
      newItemMenuItem.addEventListener('command', function() {
        self.importNanopubAsNewItem();
      });

      // Create "Attach to Item" menu item
      const attachMenuItem = doc.createXULElement ? 
        doc.createXULElement('menuitem') : 
        doc.createElement('menuitem');
      attachMenuItem.id = 'nanopub-import-attach';
      attachMenuItem.setAttribute('label', 'Import Nanopublication (Attach to Item)...');
      
      attachMenuItem.addEventListener('command', function() {
        self.importNanopubByUrl();
      });
      
      fileMenu.appendChild(separator);
      fileMenu.appendChild(newItemMenuItem);
      fileMenu.appendChild(attachMenuItem);
      
      log("File menu items added successfully");
    } catch (err: any) {
      error("Error adding file menu:", err);
    }
  }

 /**
 * Register context menu items (called once at startup)
 */
private registerContextMenu() {
  try {
    const win = Zotero.getMainWindow();
    if (!win) {
      error("No main window for context menu");
      return;
    }

    const doc = win.document;
    
    // Find the Zotero item context menu
    const itemMenu = doc.getElementById('zotero-itemmenu');
    if (!itemMenu) {
      error("Item menu not found");
      return;
    }

    log("Found item menu, adding context menu items...");

    // Add separator
    const separator = doc.createXULElement ? 
      doc.createXULElement('menuseparator') : 
      doc.createElement('menuseparator');
    separator.id = 'nanopub-context-separator';
    itemMenu.appendChild(separator);

    // Add "Create Nanopublication" menu with template submenu
    const createNanopubMenu = doc.createXULElement ? 
      doc.createXULElement('menu') : 
      doc.createElement('menu');
    createNanopubMenu.id = 'nanopub-context-create-menu';
    createNanopubMenu.setAttribute('label', '✨ Create Nanopublication');

    // Create submenu popup for templates
    const createNanopubPopup = doc.createXULElement ? 
      doc.createXULElement('menupopup') : 
      doc.createElement('menupopup');
    createNanopubPopup.id = 'nanopub-context-create-popup';

    // Add menu items for each template
    const templates = TemplateBrowser.getPopularTemplates();
    
    templates.forEach((template, index) => {
      const menuItem = doc.createXULElement ? 
        doc.createXULElement('menuitem') : 
        doc.createElement('menuitem');
      
      menuItem.id = `nanopub-context-template-${index}`;
      menuItem.setAttribute('label', `${template.icon} ${template.name}`);
      
      // Capture template URI in closure
      const templateUri = template.uri;
      menuItem.addEventListener('command', function() {
        // Get selected item at the time of click
        const pane = Zotero.getActiveZoteroPane();
        const selectedItems = pane ? pane.getSelectedItems() : [];
        const selectedItem = selectedItems.length > 0 && selectedItems[0].isRegularItem() ? selectedItems[0] : null;
        
        TemplateFormDialog.showTemplateWorkflow(selectedItem, templateUri);
      });
      
      createNanopubPopup.appendChild(menuItem);
    });

    createNanopubMenu.appendChild(createNanopubPopup);
    itemMenu.appendChild(createNanopubMenu);

    // Add "Attach Nanopublication..." menu item
    const importItem = doc.createXULElement ? 
      doc.createXULElement('menuitem') : 
      doc.createElement('menuitem');
    importItem.id = 'nanopub-context-import';
    importItem.setAttribute('label', '📎 Attach Nanopublication...');
    
    const self = this;
    importItem.addEventListener('command', function() {
      self.importNanopubByUrl();
    });
    itemMenu.appendChild(importItem);

    // Add "Search Related Nanopublications" menu item
    const searchItem = doc.createXULElement ? 
      doc.createXULElement('menuitem') : 
      doc.createElement('menuitem');
    searchItem.id = 'nanopub-context-search';
    searchItem.setAttribute('label', '🔍 Search Related Nanopublications');
    
    searchItem.addEventListener('command', function() {
      self.searchRelatedNanopubs();
    });
    itemMenu.appendChild(searchItem);

    // Listen for menu showing to update enabled/disabled state
    itemMenu.addEventListener('popupshowing', function() {
      self.updateContextMenuState();
    });
    
    log("Context menu items registered successfully");
  } catch (err: any) {
    error("Error setting up context menu:", err);
  }
}

/**
 * Update context menu item states when menu opens
 */
private updateContextMenuState() {
  try {
    const win = Zotero.getMainWindow();
    if (!win) return;

    const doc = win.document;
    
    // Get selected item
    const pane = Zotero.getActiveZoteroPane();
    const selectedItems = pane ? pane.getSelectedItems() : [];
    const hasValidItem = selectedItems.length > 0 && selectedItems[0].isRegularItem();

    // Update "Create Nanopublication" menu state
    const createMenu = doc.getElementById('nanopub-context-create-menu');
    if (createMenu) {
      if (hasValidItem) {
        createMenu.removeAttribute('disabled');
      } else {
        createMenu.setAttribute('disabled', 'true');
      }
    }
  } catch (err: any) {
    error("Error updating context menu state:", err);
  }
}

  /**
   * Register nanopub creation menu items with dynamic template submenu
   */
  private registerNanopubCreationMenus() {
    try {
      const win = Zotero.getMainWindow();
      if (!win) {
        error("No main window available");
        return;
      }

      const doc = win.document;
      const fileMenu = doc.getElementById('menu_FilePopup');
      
      if (!fileMenu) {
        error("File menu popup not found");
        return;
      }

      log("Adding nanopub creation menu items...");

      // Create separator for nanopub items
      const creationSeparator = doc.createXULElement ? 
        doc.createXULElement('menuseparator') : 
        doc.createElement('menuseparator');
      creationSeparator.id = 'nanopub-creation-separator';

      // Create main "Create Nanopublication" menu with submenu
      const createNanopubMenu = doc.createXULElement ? 
        doc.createXULElement('menu') : 
        doc.createElement('menu');
      createNanopubMenu.id = 'nanopub-create-menu';
      createNanopubMenu.setAttribute('label', 'Create Nanopublication');

      // Create submenu popup
      const createNanopubPopup = doc.createXULElement ? 
        doc.createXULElement('menupopup') : 
        doc.createElement('menupopup');
      createNanopubPopup.id = 'nanopub-create-popup';

      // Dynamically add menu items for each template
      const templates = TemplateBrowser.getPopularTemplates();
      
      templates.forEach((template, index) => {
        const menuItem = doc.createXULElement ? 
          doc.createXULElement('menuitem') : 
          doc.createElement('menuitem');
        
        menuItem.id = `nanopub-template-${index}`;
        menuItem.setAttribute('label', `${template.icon} ${template.name}`);
        
        // Capture template URI in closure
        const templateUri = template.uri;
        menuItem.addEventListener('command', function() {
          const activePane = Zotero.getActiveZoteroPane();
          const selectedItems = activePane ? activePane.getSelectedItems() : [];
          const selectedItem = selectedItems.length > 0 && selectedItems[0].isRegularItem() ? selectedItems[0] : null;
          TemplateFormDialog.showTemplateWorkflow(selectedItem, templateUri);
        });
        
        createNanopubPopup.appendChild(menuItem);
      });

      createNanopubMenu.appendChild(createNanopubPopup);

      // Add all items to file menu
      fileMenu.appendChild(creationSeparator);
      fileMenu.appendChild(createNanopubMenu);
      
      log("Nanopub creation menu items added successfully");
    } catch (err: any) {
      error("Error adding nanopub creation menu:", err);
    }
  }


  /**
   * Search for and attach related nanopublications
   */
  private async searchRelatedNanopubs() {
    try {
      log("Search related nanopubs triggered");

      // Get selected item
      const pane = Zotero.getActiveZoteroPane();
      if (!pane) {
        throw new Error("No active Zotero pane");
      }

      const items = pane.getSelectedItems();
      
      if (items.length === 0 || !items[0].isRegularItem()) {
        Services.prompt.alert(
          null,
          'No Item Selected',
          'Please select an item in your library first.'
        );
        return;
      }

      const targetItem = items[0];
      const itemTitle = targetItem.getField('title');
      
      log("Searching for nanopubs related to: " + itemTitle);

      // Show progress
      const progressWin = new Zotero.ProgressWindow();
      progressWin.changeHeadline('Searching for Nanopublications');
      progressWin.addLines(['Searching for related nanopublications...']);
      progressWin.show();

      // Search using the search module
      const searchModule = Zotero.Nanopub.searchModule;
      const nanopubUris = await searchModule.searchForItem(targetItem);

      progressWin.close();

      if (nanopubUris.length === 0) {
        Services.prompt.alert(
          null,
          'No Results',
          'No nanopublications found related to this item.'
        );
        return;
      }

      // Ask user if they want to import all or select
      const prompts = Services.prompt;
      const result = prompts.confirm(
        null,
        'Nanopublications Found',
        `Found ${nanopubUris.length} related nanopublication(s).\n\nDo you want to attach all of them to this item?`
      );

      if (!result) {
        log("User cancelled import");
        return;
      }

      // Import all found nanopubs
      progressWin.changeHeadline('Importing Nanopublications');
      progressWin.addLines([`Importing ${nanopubUris.length} nanopublications...`]);
      progressWin.show();

      let successCount = 0;
      let failCount = 0;

      for (const uri of nanopubUris) {
        try {
          await Zotero.Nanopub.displayModule.displayFromUri(targetItem, uri);
          successCount++;
          progressWin.addLines([`✓ Imported ${successCount}/${nanopubUris.length}`]);
        } catch (err: any) {
          error("Failed to import nanopub: " + uri, err);
          failCount++;
        }
      }

      progressWin.close();

      Services.prompt.alert(
        null,
        'Import Complete',
        `Successfully imported ${successCount} nanopublication(s).\n` +
        (failCount > 0 ? `Failed to import ${failCount} nanopublication(s).` : '')
      );

    } catch (err: any) {
      error("Search related nanopubs failed:", err);
      Services.prompt.alert(
        null,
        'Error',
        'Failed to search for nanopublications: ' + err.message
      );
    }
  }

  /**
   * Import nanopublication as a new standalone item
   */
  private async importNanopubAsNewItem() {
    try {
      log("Import nanopub as new item triggered");

      const prompts = Services.prompt;
      const input = { value: 'https://w3id.org/np/' };
      
      const result = prompts.prompt(
        null,
        'Import Nanopublication as New Item',
        'Enter the nanopublication URL:',
        input,
        null,
        { value: false }
      );

      if (!result || !input.value) {
        log("Import cancelled");
        return;
      }

      const url = input.value.trim();
      log("Importing nanopub as new item from URL: " + url);

      // Get current collection if one is selected
      const pane = Zotero.getActiveZoteroPane();
      let collectionID;
      
      if (pane) {
        const collection = pane.getSelectedCollection();
        if (collection) {
          collectionID = collection.id;
          log("Adding to collection: " + collection.name);
        }
      }

      // Use display module to create standalone item
      await Zotero.Nanopub.displayModule.importAsStandaloneItem(url, collectionID);

      Services.prompt.alert(
        null,
        'Success',
        'Nanopublication imported as a new item! Check your library.'
      );
    } catch (err: any) {
      error("Import as new item failed:", err);
      Services.prompt.alert(
        null,
        'Error',
        'Failed to import nanopublication: ' + err.message
      );
    }
  }

  /**
   * Import nanopublication by URL (attach to existing item)
   */
  private async importNanopubByUrl() {
    try {
      log("Import nanopub by URL triggered");

      const prompts = Services.prompt;
      const input = { value: 'https://w3id.org/np/' };
      
      const result = prompts.prompt(
        null,
        'Attach Nanopublication to Item',
        'Enter the nanopublication URL:',
        input,
        null,
        { value: false }
      );

      if (!result || !input.value) {
        log("Import cancelled");
        return;
      }

      const url = input.value.trim();
      log("Importing nanopub from URL: " + url);

      // Get selected item
      const pane = Zotero.getActiveZoteroPane();
      if (!pane) {
        throw new Error("No active Zotero pane");
      }

      const items = pane.getSelectedItems();
      
      if (items.length === 0 || !items[0].isRegularItem()) {
        Services.prompt.alert(
          null,
          'No Item Selected',
          'Please select an item in your library first, then try again.'
        );
        return;
      }

      const targetItem = items[0];
      log("Target item: " + targetItem.getField('title'));

      // Use display module
      await Zotero.Nanopub.displayModule.displayFromUri(targetItem, url);

      Services.prompt.alert(
        null,
        'Success',
        'Nanopublication attached successfully! Check the notes attached to your selected item.'
      );
    } catch (err: any) {
      error("Import failed:", err);
      Services.prompt.alert(
        null,
        'Error',
        'Failed to import nanopublication: ' + err.message
      );
    }
  }

  /**
   * Cleanup menu items on shutdown
   */
  cleanup() {
    try {
      const win = Zotero.getMainWindow();
      if (!win) return;

      const doc = win.document;
      
      // Remove File menu items for import
      const newItemMenuItem = doc.getElementById('nanopub-import-new-item');
      if (newItemMenuItem) {
        newItemMenuItem.remove();
      }

      const attachMenuItem = doc.getElementById('nanopub-import-attach');
      if (attachMenuItem) {
        attachMenuItem.remove();
      }
      
      const separator = doc.getElementById('nanopub-separator');
      if (separator) {
        separator.remove();
      }

      const createNanopubMenu = doc.getElementById('nanopub-create-menu');
      if (createNanopubMenu) {
        createNanopubMenu.remove();
      }

      const creationSeparator = doc.getElementById('nanopub-creation-separator');
      if (creationSeparator) {
        creationSeparator.remove();
      }

      // Remove context menu items
      const contextSeparator = doc.getElementById('nanopub-context-separator');
      if (contextSeparator) {
        contextSeparator.remove();
      }

      const contextCreateMenu = doc.getElementById('nanopub-context-create-menu');
      if (contextCreateMenu) {
        contextCreateMenu.remove();
      }

      const contextImportItem = doc.getElementById('nanopub-context-import');
      if (contextImportItem) {
        contextImportItem.remove();
      }

      const contextSearchItem = doc.getElementById('nanopub-context-search');
      if (contextSearchItem) {
        contextSearchItem.remove();
      }

      log("Menu items cleaned up");
    } catch (err: any) {
      error("Failed to cleanup menus:", err);
    }
  }
}
