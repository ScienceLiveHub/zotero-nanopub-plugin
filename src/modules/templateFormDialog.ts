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
    const formContainer = win.document.createElement('div');
    formContainer.id = 'nanopub-form-container';
    
    // Detect and apply dark mode
    console.log('[nanopub-view] Detecting dark mode for Zotero...');
    const isDarkMode = this.isZoteroDarkMode(win);
    console.log('[nanopub-view] Dark mode result:', isDarkMode);
    
    if (isDarkMode) {
      formContainer.setAttribute('data-theme', 'dark');
      // Also add as a class for CSS targeting
      formContainer.classList.add('dark-mode');
      console.log('[nanopub-view] ✅ Applied dark mode to container');
    }
    
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

      // CRITICAL: Apply dark mode to all relevant elements after rendering
      const isDarkMode = this.isZoteroDarkMode(win);
      console.log('[nanopub-view] Applying dark mode:', isDarkMode);
      
      if (isDarkMode) {
        // Apply to the container
        formContainer.setAttribute('data-theme', 'dark');
        formContainer.classList.add('dark-mode');
        
        // Apply to the nanopub-form element
        const nanopubForm = formContainer.querySelector('.nanopub-form');
        if (nanopubForm) {
          nanopubForm.setAttribute('data-theme', 'dark');
          nanopubForm.classList.add('dark-mode');
          console.log('[nanopub-view] ✅ Applied dark mode to .nanopub-form');
        }
        
        // Inject dark mode CSS variables directly as a style element
        // Use better color combinations for readability
        const mainDoc = win.document;
        const styleEl = mainDoc.createElement('style');
        styleEl.id = 'nanopub-dark-mode-override';
        styleEl.textContent = `
          /* Dark mode CSS variables */
          #nanopub-form-container,
          #nanopub-form-container .nanopub-form {
            --primary: #ec4899 !important;
            --primary-hover: #f472b6 !important;
            --secondary: #9ca3af !important;
            --secondary-dark: #6b7280 !important;
            --text-dark: #f3f4f6 !important;
            --text-light: #d1d5db !important;
            --bg-white: #1f2937 !important;
            --bg-light: #111827 !important;
            --bg-subtle: #374151 !important;
            --border: #4b5563 !important;
            --border-light: #374151 !important;
            --pink-light: #312e37 !important;
            --pink-border: #ec4899 !important;
          }
          
          /* Text colors - be specific, not everything */
          #nanopub-form-container .field-label,
          #nanopub-form-container .subject-label,
          #nanopub-form-container .field-help,
          #nanopub-form-container .field-hint,
          #nanopub-form-container .toggle-label {
            color: #f3f4f6 !important;
          }
          
          /* Form inputs */
          #nanopub-form-container .form-input,
          #nanopub-form-container .form-select,
          #nanopub-form-container .form-textarea {
            background: #374151 !important;
            color: #f3f4f6 !important;
            border: 2px solid #6b7280 !important;
          }
          
          /* Focus states - clean pink glow */
          #nanopub-form-container .form-input:focus,
          #nanopub-form-container .form-select:focus,
          #nanopub-form-container .form-textarea:focus {
            outline: none !important;
            border-color: #ec4899 !important;
            box-shadow: 0 0 0 2px rgba(236, 72, 153, 0.3) !important;
          }
          
          /* CRITICAL: Remove dotted outline from select in Firefox */
          #nanopub-form-container select:-moz-focusring {
            color: transparent !important;
            text-shadow: 0 0 0 #f3f4f6 !important;
          }
          
          #nanopub-form-container select::-moz-focus-inner {
            border: 0 !important;
          }
          
          /* Remove any focus ring */
          #nanopub-form-container select:focus-visible {
            outline: none !important;
          }
          
          /* Placeholder text */
          #nanopub-form-container .form-input::placeholder,
          #nanopub-form-container .form-textarea::placeholder {
            color: #9ca3af !important;
          }
          
          /* Subject group */
          #nanopub-form-container .subject-group {
            background: #1f2937 !important;
            border: 2px solid #ec4899 !important;
          }
          
          /* Links */
          #nanopub-form-container a {
            color: #ec4899 !important;
          }
          
          #nanopub-form-container a:hover {
            color: #f472b6 !important;
          }
          
          /* Buttons */
          #nanopub-form-container .btn-primary {
            background: #ec4899 !important;
            color: #ffffff !important;
            border: none !important;
          }
          
          #nanopub-form-container .btn-secondary,
          #nanopub-form-container .btn-add,
          #nanopub-form-container .btn-add-field {
            background: #6b7280 !important;
            color: #ffffff !important;
            border: none !important;
          }
          
          /* Dropdown select - remove native styling */
          #nanopub-form-container .form-select {
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23d1d5db' d='M6 9L1 4h10z'/%3E%3C/svg%3E") !important;
            background-repeat: no-repeat !important;
            background-position: right 12px center !important;
            background-size: 12px !important;
            -moz-appearance: none !important;
            -webkit-appearance: none !important;
            appearance: none !important;
            width: 100% !important;
            max-width: 400px !important;
            padding-right: 36px !important;
            box-sizing: border-box !important;
          }
          
          /* Select options */
          #nanopub-form-container .form-select option {
            background: #374151 !important;
            color: #f3f4f6 !important;
          }
        `;
        
        // Append to head if it exists, otherwise to documentElement
        if (mainDoc.head) {
          mainDoc.head.appendChild(styleEl);
          console.log('[nanopub-view] ✅ Injected dark mode CSS override into head');
        } else if (mainDoc.documentElement) {
          mainDoc.documentElement.appendChild(styleEl);
          console.log('[nanopub-view] ✅ Injected dark mode CSS override into documentElement');
        } else {
          console.warn('[nanopub-view] ⚠️ Could not inject dark mode CSS - no head or documentElement');
        }
      }

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

  /**
   * Detect if Zotero is in dark mode
   * Uses multiple detection methods since Zotero's dark mode implementation may vary
   */
  private static isZoteroDarkMode(win: Window): boolean {
    try {
      const doc = win.document;
      const body = doc.body || doc.documentElement;
      
      console.log('[nanopub-view] === Dark Mode Detection Debug ===');
      
      // Check 1: Explicit dark mode indicators
      const hasExplicitDark = body.classList.contains('dark') || 
                              body.classList.contains('dark-mode') ||
                              body.getAttribute('data-theme') === 'dark';
      console.log('[nanopub-view] Body classes:', Array.from(body.classList));
      console.log('[nanopub-view] data-theme attribute:', body.getAttribute('data-theme'));
      console.log('[nanopub-view] Has explicit dark indicator:', hasExplicitDark);
      
      if (hasExplicitDark) {
        return true;
      }
      
      // Check 2: Background color analysis
      const bgColor = win.getComputedStyle(body).backgroundColor;
      console.log('[nanopub-view] Body background color:', bgColor);
      
      if (bgColor) {
        const match = bgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (match) {
          const r = parseInt(match[1]);
          const g = parseInt(match[2]);
          const b = parseInt(match[3]);
          const brightness = (r + g + b) / 3;
          
          console.log('[nanopub-view] RGB values:', { r, g, b });
          console.log('[nanopub-view] Brightness:', brightness);
          console.log('[nanopub-view] Is dark (< 128)?:', brightness < 128);
          
          if (brightness < 128) {
            return true;
          }
        }
      }
      
      // Check 3: System preference
      const systemPrefersDark = win.matchMedia && win.matchMedia('(prefers-color-scheme: dark)').matches;
      console.log('[nanopub-view] System prefers dark:', systemPrefersDark);
      
      if (systemPrefersDark) {
        return true;
      }
      
      // Check 4: Look for dark colors in parent containers
      let element: any = body;
      for (let i = 0; i < 5 && element; i++) {
        const color = win.getComputedStyle(element).backgroundColor;
        console.log(`[nanopub-view] Checking element ${i} (${element.tagName}):`, color);
        element = element.parentElement;
      }
      
      console.log('[nanopub-view] === End Dark Mode Detection ===');
      return false;
    } catch (error) {
      console.error('[nanopub-view] Error detecting dark mode:', error);
      return false;
    }
  }
}
