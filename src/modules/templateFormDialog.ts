// src/modules/templateFormDialog.ts
// Template form dialog - creates a proper Zotero tab with the form

export class TemplateFormDialog {
  
  /**
   * Show template workflow by creating a new tab
   */
  static async showTemplateWorkflow(preSelectedItem?: Zotero.Item, preSelectedTemplateUri?: string) {
    try {
      // Step 1: Check profile
      const creator = Zotero.Nanopub.creator;
      
      if (!creator.hasProfile()) {
        Services.prompt.alert(
          null,
          'No Profile',
          'Please setup your nanopub profile first.\n\n' +
          'Go to: File → Setup Nanopub Profile'
        );
        return;
      }

      // Step 2: Get template URI
      let templateUri = preSelectedTemplateUri;
      
      if (!templateUri) {
        const { TemplateBrowser } = await import("./templateBrowser");
        templateUri = await TemplateBrowser.showBrowser();
        
        if (!templateUri) {
          return; // User cancelled
        }
      }

      // Step 3: Create a new tab with the form
      await this.createFormTab(templateUri, preSelectedItem);

    } catch (error: any) {
      console.error('[nanopub-view ERROR] Template workflow failed:', error);
      
      Services.prompt.alert(
        null,
        'Error',
        `Failed to create nanopublication:\n${error.message}`
      );
    }
  }

  /**
   * Create a new tab in Zotero with the template form
   */
  private static async createFormTab(templateUri: string, preSelectedItem?: Zotero.Item) {
    const win = Zotero.getMainWindow();
    
    // Create a new tab - this returns a tab object, not a string ID
    const tab = win.Zotero_Tabs.add({
      type: 'library',
      title: 'Create Nanopublication',
      select: true, // Switch to this tab
      data: {
        templateUri,
        preSelectedItem
      }
    });

    console.log('[nanopub-view] Created tab:', tab);
    console.log('[nanopub-view] Tab ID:', tab.id);
    console.log('[nanopub-view] Tab object keys:', Object.keys(tab));
    
    // Wait a bit for the tab to be fully initialized
    await Zotero.Promise.delay(200);

    // Try different approaches to get the container
    let container = null;
    
    // Approach 1: Check if tab has a container property
    if (tab.container) {
      console.log('[nanopub-view] Using tab.container');
      container = tab.container;
    }
    // Approach 2: Check for deck/panel
    else if (tab.deck) {
      console.log('[nanopub-view] Using tab.deck');
      container = tab.deck;
    }
    // Approach 3: Query the tab element itself
    else {
      const tabElement = win.document.getElementById(tab.id);
      console.log('[nanopub-view] Tab element:', tabElement);
      
      if (tabElement) {
        // The tab might be the container itself, or we need its content area
        container = tabElement.querySelector('.tab-content') || 
                   tabElement.querySelector('[role="tabpanel"]') ||
                   tabElement;
        console.log('[nanopub-view] Found container via query:', container);
      }
    }
    
    if (!container) {
      console.error('[nanopub-view ERROR] Could not find tab container');
      console.error('[nanopub-view ERROR] Tab properties:', tab);
      console.error('[nanopub-view ERROR] Available elements with tab ID:', 
        Array.from(win.document.querySelectorAll(`[id*="${tab.id}"]`))
          .map((el: Element) => `${el.tagName}#${el.id}`)
      );
      throw new Error('Could not find tab container');
    }

    console.log('[nanopub-view] Tab container found:', container);

    // Create form container div with minimal styling
    // Let the nanopub-create library handle its own styles
    const formContainer = win.document.createElement('div');
    formContainer.id = 'nanopub-form-container';
    formContainer.style.cssText = `
      padding: 20px;
      width: 100%;
      height: 100%;
      overflow: auto;
    `;

    // Clear any existing content and add our container
    container.innerHTML = '';
    container.appendChild(formContainer);

    try {
      const creator = Zotero.Nanopub.creator;
      
      console.log('[nanopub-view] Rendering form in tab...');

      // Store generated TriG content
      let generatedTrigContent: string | null = null;

      // Listen for submit event
      const submitHandler = (data: any) => {
        console.log('[nanopub-view] Submit event received');
        generatedTrigContent = data.trigContent;
        
        // Show publish button or handle automatically
        this.handleFormSubmit(generatedTrigContent, preSelectedItem, tab.id);
      };

      creator.on('submit', submitHandler);

      // Render the form
      await creator.renderFromTemplateUri(templateUri, formContainer);
      
      console.log('[nanopub-view] Form rendered in tab');

    } catch (error: any) {
      console.error('[nanopub-view ERROR] Failed to render form:', error);
      
      formContainer.innerHTML = `
        <div style="padding: 40px;">
          <h2 style="color: #d32f2f;">Error Loading Template</h2>
          <p>Failed to load the template form:</p>
          <pre style="background: #f5f5f5; padding: 15px; border-radius: 4px; overflow: auto;">${error.message}</pre>
        </div>
      `;
    }
  }

  /**
   * Handle form submission
   */
  private static async handleFormSubmit(trigContent: string, preSelectedItem?: Zotero.Item, tabId?: string) {
    try {
      const progressWin = new Zotero.ProgressWindow();
      progressWin.changeHeadline('Publishing Nanopublication');
      progressWin.addLines(['Signing and publishing...']);
      progressWin.show();
      progressWin.startCloseTimer(10000);

      const creator = Zotero.Nanopub.creator;
      const result = await creator.signAndPublish(trigContent);

      progressWin.close();

      // Ensure we have the w3id.org format
      let displayUri = result.uri;
      if (!displayUri.includes('w3id.org')) {
        // Extract the nanopub ID and convert to w3id.org format
        const idMatch = displayUri.match(/\/np\/([A-Za-z0-9_-]+)/);
        if (idMatch) {
          displayUri = `https://w3id.org/np/${idMatch[1]}`;
        }
      }

      // Show success with Nanodash link
      const nanodashUrl = `https://nanodash.knowledgepixels.com/explore?id=${encodeURIComponent(displayUri)}`;
      
      const message = 
        `Successfully created and published!\n\n` +
        `Nanopublication URI:\n${displayUri}\n\n` +
        `View at Nanodash:\n${nanodashUrl}\n\n` +
        (preSelectedItem ? `Would you like to attach this nanopublication to the selected item as a note?` : 'Done!');

      if (preSelectedItem) {
        const attachAsNote = Services.prompt.confirm(
          null,
          'Success - Nanopublication Published',
          message
        );

        if (attachAsNote) {
          // Create a note with the nanopub information
          const noteContent = `
            <h2>Nanopublication</h2>
            <p><strong>URI:</strong> <a href="${displayUri}">${displayUri}</a></p>
            <p><strong>View:</strong> <a href="${nanodashUrl}">Open in Nanodash</a></p>
            <p><em>Created: ${new Date().toLocaleString()}</em></p>
          `;

          const note = new Zotero.Item('note');
          note.parentID = preSelectedItem.id;
          note.setNote(noteContent);
          await note.saveTx();

          console.log('[nanopub-view] Attached nanopub as note to item');
        }
      } else {
        Services.prompt.alert(null, 'Success - Nanopublication Published', message);
      }

      // Close the tab
      if (tabId) {
        const win = Zotero.getMainWindow();
        win.Zotero_Tabs.close(tabId);
      }

    } catch (error: any) {
      console.error('[nanopub-view ERROR] Failed to publish:', error);
      
      Services.prompt.alert(
        null,
        'Error',
        `Failed to publish nanopublication:\n${error.message}`
      );
    }
  }
}
