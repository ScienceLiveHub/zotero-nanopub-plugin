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

    // Create form container div
    const formContainer = win.document.createElement('div');
    formContainer.id = 'nanopub-form-container';
    formContainer.style.cssText = `
      padding: 20px;
      width: 100%;
      height: 100%;
      overflow: auto;
      background: #ffffff;
      color: #000000;
    `;
    
    // Add a style element to the container itself (not to head which may not exist in XUL)
    const styleElement = win.document.createElement('style');
    styleElement.textContent = `
      #nanopub-form-container * {
        color: #000000 !important;
      }
      #nanopub-form-container button,
      #nanopub-form-container input[type="button"],
      #nanopub-form-container input[type="submit"] {
        background-color: #0a84ff !important;
        color: #ffffff !important;
        border: none !important;
        padding: 8px 16px !important;
        border-radius: 4px !important;
        cursor: pointer !important;
        font-size: 14px !important;
      }
      #nanopub-form-container button:hover,
      #nanopub-form-container input[type="button"]:hover,
      #nanopub-form-container input[type="submit"]:hover {
        background-color: #0060df !important;
      }
      #nanopub-form-container input[type="text"],
      #nanopub-form-container input[type="url"],
      #nanopub-form-container textarea,
      #nanopub-form-container select {
        background-color: #ffffff !important;
        color: #000000 !important;
        border: 1px solid #cccccc !important;
        padding: 6px !important;
        border-radius: 3px !important;
      }
      #nanopub-form-container label {
        color: #000000 !important;
        font-weight: 500 !important;
        display: block !important;
        margin-bottom: 4px !important;
      }
    `;
    
    // Try to append to head if it exists, otherwise append to container
    if (win.document.head) {
      win.document.head.appendChild(styleElement);
    } else {
      // In XUL, just prepend the style element to the container
      formContainer.appendChild(styleElement);
    }

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

      // Show success
      const viewUrl = `https://nanodash.knowledgepixels.com/explore?id=${encodeURIComponent(result.uri)}`;
      
      const message = 
        `Successfully created and published!\n\n` +
        `URI: ${result.uri}\n\n` +
        `View at Nanodash:\n${viewUrl}\n\n` +
        (preSelectedItem ? `Attach to selected item?` : 'Done!');

      if (preSelectedItem) {
        const attach = Services.prompt.confirm(
          null,
          'Success',
          message
        );

        if (attach) {
          await Zotero.Attachments.linkFromURL({
            url: result.uri,
            parentItemID: preSelectedItem.id,
            title: 'Nanopublication',
            contentType: 'application/x-research-info-systems'
          });

          console.log('[nanopub-view] Attached nanopub to item');
        }
      } else {
        Services.prompt.alert(null, 'Success', message);
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
