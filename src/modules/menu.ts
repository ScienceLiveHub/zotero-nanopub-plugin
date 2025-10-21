// src/modules/menu.ts
import { log, error } from "../utils/logger";

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
   * Register context menu items
   */
  private registerContextMenu() {
    try {
      const win = Zotero.getMainWindow();
      if (!win) {
        error("No main window for context menu");
        return;
      }

      const doc = win.document;
      
      // Find the items tree
      const itemsTree = doc.getElementById('zotero-items-tree');
      if (!itemsTree) {
        error("Items tree not found");
        return;
      }

      log("Found items tree, adding context menu listener...");

      const self = this;
      itemsTree.addEventListener('contextmenu', function(event: any) {
        // Small delay to ensure menu is created
        setTimeout(function() {
          self.addContextMenuItems();
        }, 50);
      });
      
      log("Context menu listener added successfully");
    } catch (err: any) {
      error("Error setting up context menu:", err);
    }
  }

  /**
   * Add items to context menu when it opens
   */
  private addContextMenuItems() {
    try {
      const win = Zotero.getMainWindow();
      if (!win) return;

      const doc = win.document;
      
      // Find the open popup/menu
      const popup = doc.querySelector('menupopup[open="true"]');
      
      if (!popup) {
        log("No open popup found");
        return;
      }

      log("Found open popup, adding menu items...");

      // Remove old items if they exist
      const oldSeparator = doc.getElementById('nanopub-context-separator');
      if (oldSeparator) oldSeparator.remove();
      
      const oldImportItem = doc.getElementById('nanopub-context-import');
      if (oldImportItem) oldImportItem.remove();

      // Add separator
      const separator = doc.createXULElement ? 
        doc.createXULElement('menuseparator') : 
        doc.createElement('menuseparator');
      separator.id = 'nanopub-context-separator';

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

      popup.appendChild(separator);
      popup.appendChild(importItem);
      
      log("Context menu items added");
    } catch (err: any) {
      error("Error adding context menu items:", err);
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
      
      // Remove File menu items
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

      log("Menu items cleaned up");
    } catch (err: any) {
      error("Failed to cleanup menus:", err);
    }
  }
}
