// src/modules/templateFormDialog.ts
// Template form dialog - FIXED VERSION with aggressive collapsible header styling

export class TemplateFormDialog {
  
  static async showTemplateWorkflow(preSelectedItem?: Zotero.Item, preSelectedTemplateUri?: string) {
    try {
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

      let templateUri = preSelectedTemplateUri;
      
      if (!templateUri) {
        const { TemplateBrowser } = await import("./templateBrowser");
        templateUri = await TemplateBrowser.showBrowser();
        
        if (!templateUri) {
          return;
        }
      }

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
   * Pre-fill form fields with metadata from the selected Zotero item
   */
  private static prefillFormFromItem(formContainer: HTMLElement, item: Zotero.Item) {
    try {
      // Extract metadata from Zotero item
      const doi = item.getField('DOI');
      const title = item.getField('title');
      const url = item.getField('url');
      const abstractText = item.getField('abstractNote');
      
      // Get authors
      const creators = item.getCreators();
      const authors = creators
        .filter((c: any) => c.creatorType === 'author')
        .map((c: any) => c.firstName ? `${c.firstName} ${c.lastName}` : c.lastName)
        .join(', ');
      
      // Get year
      const date = item.getField('date');
      const year = date ? new Date(date).getFullYear().toString() : '';

      console.log('[nanopub-view] Pre-filling form with:', { doi, title, authors, year });

      // Small delay to ensure form is fully rendered
      setTimeout(() => {
        // Find and fill DOI fields
        if (doi) {
          const doiValue = doi.startsWith('http') ? doi : `https://doi.org/${doi}`;
          this.fillFieldsByPattern(formContainer, ['doi', 'article', 'paper', 'publication', 'work'], doiValue);
        }

        // Find and fill title fields
        if (title) {
          this.fillFieldsByPattern(formContainer, ['title', 'label'], title, 'text');
        }

        // Find and fill URL fields (if no DOI, use URL)
        if (url && !doi) {
          this.fillFieldsByPattern(formContainer, ['url', 'uri', 'link'], url);
        }

        // Find and fill author fields
        if (authors) {
          this.fillFieldsByPattern(formContainer, ['author', 'creator'], authors, 'text');
        }

        // Find and fill year fields
        if (year) {
          this.fillFieldsByPattern(formContainer, ['year', 'date'], year, 'text');
        }

        console.log('[nanopub-view] ✅ Form pre-filled successfully');
      }, 300);

    } catch (error: any) {
      console.error('[nanopub-view] Error pre-filling form:', error);
    }
  }

  /**
 * Find and fill form fields matching patterns
 */
private static fillFieldsByPattern(
  container: HTMLElement, 
  patterns: string[], 
  value: string, 
  inputType: 'url' | 'text' = 'url'
) {
  console.log(`[nanopub-view] fillFieldsByPattern: patterns=${patterns.join(',')} value=${value.substring(0, 30)}...`);
  
  // Find all input and textarea elements
  const inputs = container.querySelectorAll('input, textarea');
  let filled = false;
  
  inputs.forEach((input: Element) => {
    const inputEl = input as HTMLInputElement | HTMLTextAreaElement;
    
    // Skip if already has a value
    if (inputEl.value && inputEl.value.trim() !== '') {
      console.log(`[nanopub-view] Skipping field (has value): ${inputEl.id || inputEl.name}`);
      return;
    }
    
    // Check input attributes for pattern matches
    const id = (inputEl.id || '').toLowerCase();
    const name = (inputEl.name || '').toLowerCase();
    const placeholder = (inputEl.placeholder || '').toLowerCase();
    const type = inputEl.type?.toLowerCase() || '';
    
    // Check label text
    const formField = inputEl.closest('.form-field') || inputEl.parentElement;
    const label = formField?.querySelector('label');
    const labelText = (label?.textContent || '').toLowerCase();
    
    // Match against patterns
    const matchesPattern = patterns.some(pattern => {
      const p = pattern.toLowerCase();
      return id.includes(p) || 
             name.includes(p) || 
             placeholder.includes(p) ||
             labelText.includes(p);
    });
    
    // For URL type, check input type; for text, accept text inputs and textareas
    const matchesType = inputType === 'url' 
      ? (type === 'url' || type === 'text')
      : (type === 'text' || type === '' || inputEl.tagName === 'TEXTAREA');
    
    if (matchesPattern && matchesType) {
      console.log(`[nanopub-view] ✅ Matched field: id="${id}" name="${name}" label="${labelText.substring(0, 30)}"`);
      inputEl.value = value;
      filled = true;
      
      // Trigger change event - use Zotero-compatible method
      try {
        const doc = inputEl.ownerDocument;
        const inputEvent = doc.createEvent('Event');
        inputEvent.initEvent('input', true, true);
        inputEl.dispatchEvent(inputEvent);
        
        const changeEvent = doc.createEvent('Event');
        changeEvent.initEvent('change', true, true);
        inputEl.dispatchEvent(changeEvent);
      } catch (e) {
        console.log('[nanopub-view] Event dispatch fallback for:', id || name);
      }
    }
  });
  
  if (!filled) {
    console.log(`[nanopub-view] ⚠️ No field matched patterns: ${patterns.join(', ')}`);
  }
}

  private static async createFormTab(templateUri: string, preSelectedItem?: Zotero.Item) {
    const win = Zotero.getMainWindow();
    
    const tab = win.Zotero_Tabs.add({
      type: 'library',
      title: 'Create Nanopublication',
      select: true,
      data: {
        templateUri,
        preSelectedItem
      }
    });

    console.log('[nanopub-view] Created tab:', tab.id);
    
    await Zotero.Promise.delay(200);

    let container = tab.container || tab.deck;
    if (!container) {
      const tabElement = win.document.getElementById(tab.id);
      if (tabElement) {
        container = tabElement.querySelector('.tab-content') || 
                   tabElement.querySelector('[role="tabpanel"]') ||
                   tabElement;
      }
    }
    
    if (!container) {
      throw new Error('Could not find tab container');
    }

    const formContainer = win.document.createElement('div');
    formContainer.id = 'nanopub-form-container';
    
    // CRITICAL: Detect and apply dark mode classes
    const isDarkMode = this.isZoteroDarkMode(win);
    console.log('[nanopub-view] 🌙 Dark mode detected:', isDarkMode);
    
    if (isDarkMode) {
      formContainer.setAttribute('data-theme', 'dark');
      formContainer.classList.add('dark-mode');
      formContainer.classList.add('dark');
    }
    
    formContainer.style.cssText = `
      padding: 20px;
      width: 100%;
      height: 100%;
      overflow: auto;
    `;

    container.innerHTML = '';
    container.appendChild(formContainer);

    try {
      const creator = Zotero.Nanopub.creator;
      
      console.log('[nanopub-view] Rendering form...');

      let generatedTrigContent: string | null = null;

      const submitHandler = (data: any) => {
        generatedTrigContent = data.trigContent;
        this.handleFormSubmit(generatedTrigContent, preSelectedItem, tab.id);
      };

      creator.on('submit', submitHandler);
      await creator.renderFromTemplateUri(templateUri, formContainer);
      
      console.log('[nanopub-view] ✅ Form rendered successfully');
      
      // PRE-FILL FORM WITH ITEM METADATA
      if (preSelectedItem) {
        this.prefillFormFromItem(formContainer, preSelectedItem);
      }     

      // APPLY DARK MODE STYLES AFTER RENDERING
      if (isDarkMode) {
        console.log('[nanopub-view] Applying dark mode styles AFTER render...');
        this.applyDarkModeStyles(formContainer);
      }

      // Inject styles into the container
      this.injectStyles(formContainer, isDarkMode);

    } catch (error: any) {
      console.error('[nanopub-view ERROR] Failed to render form:', error);
      
      formContainer.innerHTML = `
        <div style="padding: 40px; color: ${isDarkMode ? '#fff' : '#000'};">
          <h2 style="color: #d32f2f;">Error Loading Template</h2>
          <p>Failed to load the template form:</p>
          <pre style="background: ${isDarkMode ? '#2d2d2d' : '#f5f5f5'}; padding: 15px; border-radius: 4px; overflow: auto;">${error.message}</pre>
        </div>
      `;
    }
  }

  /**
   * Show template workflow with annotation data pre-filled
   */
  static async showTemplateWorkflowWithAnnotation(
    item: Zotero.Item,
    templateUri: string,
    annotationData: {
      quoteText: string;
      quoteEnd: string;
      comment: string;
      pageLabel: string;
    }
  ) {
    try {
      const creator = Zotero.Nanopub.creator;
      
      if (!creator.hasProfile()) {
        Services.prompt.alert(
          null,
          'No Profile',
          'Please setup your nanopub profile first.\n\n' +
          'Go to Zotero Settings → Science Live'
        );
        return;
      }

      await this.createFormTabWithAnnotation(templateUri, item, annotationData);

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
   * Create form tab with annotation data
   */
  private static async createFormTabWithAnnotation(
    templateUri: string,
    preSelectedItem: Zotero.Item,
    annotationData: {
      quoteText: string;
      quoteEnd: string;
      comment: string;
      pageLabel: string;
    }
  ) {
    const win = Zotero.getMainWindow();
    
    const tab = win.Zotero_Tabs.add({
      type: 'library',
      title: 'Create Nanopublication from Annotation',
      select: true,
      data: {}  // Add empty data object to prevent "tab.data is undefined" error
    });

    console.log('[nanopub-view] Created tab:', tab.id);

    await Zotero.Promise.delay(200);

    let container = tab.container || tab.deck;
    if (!container) {
      const tabElement = win.document.getElementById(tab.id);
      if (tabElement) {
        container = tabElement.querySelector('.tab-content') || 
                   tabElement.querySelector('[role="tabpanel"]') ||
                   tabElement;
      }
    }
    
    if (!container) {
      throw new Error('Could not find tab container');
    }

    const formContainer = win.document.createElement('div');
    formContainer.id = 'nanopub-form-container';
    
    const isDarkMode = this.isZoteroDarkMode(win);
    console.log('[nanopub-view] 🌙 Dark mode detected:', isDarkMode);
    
    if (isDarkMode) {
      formContainer.setAttribute('data-theme', 'dark');
      formContainer.classList.add('dark-mode');
      formContainer.classList.add('dark');
    }
    
    formContainer.style.cssText = `
      padding: 20px;
      width: 100%;
      height: 100%;
      overflow: auto;
    `;

    container.innerHTML = '';
    container.appendChild(formContainer);

    try {
      const creator = Zotero.Nanopub.creator;
      
      console.log('[nanopub-view] Rendering form for annotation...');

      let generatedTrigContent: string | null = null;

      const submitHandler = (data: any) => {
        generatedTrigContent = data.trigContent;
        this.handleFormSubmit(generatedTrigContent, preSelectedItem, tab.id);
      };

      creator.on('submit', submitHandler);
      await creator.renderFromTemplateUri(templateUri, formContainer);
      
      console.log('[nanopub-view] ✅ Form rendered successfully');

      // Apply dark mode styles
      if (isDarkMode) {
        console.log('[nanopub-view] Applying dark mode styles AFTER render...');
        this.applyDarkModeStyles(formContainer);
      }

      // Inject styles
      this.injectStyles(formContainer, isDarkMode);

      // Pre-fill form with item metadata AND annotation data
      this.prefillFormFromItemAndAnnotation(formContainer, preSelectedItem, annotationData);

    } catch (error: any) {
      console.error('[nanopub-view ERROR] Failed to render form:', error);
      
      formContainer.innerHTML = `
        <div style="padding: 40px; color: ${isDarkMode ? '#fff' : '#000'};">
          <h2 style="color: #d32f2f;">Error Loading Template</h2>
          <p>Failed to load the template form:</p>
          <pre style="background: ${isDarkMode ? '#333' : '#f5f5f5'}; padding: 10px; border-radius: 4px;">${error.message}</pre>
        </div>
      `;
    }
  }

 /**
 * Pre-fill form fields with item metadata AND annotation data
 */
private static prefillFormFromItemAndAnnotation(
  formContainer: HTMLElement, 
  item: Zotero.Item,
  annotationData: {
    quoteText: string;
    quoteEnd: string;
    comment: string;
    pageLabel: string;
  }
) {
  try {
    const doi = item.getField('DOI');
    const url = item.getField('url');

    console.log('[nanopub-view] Pre-filling form with item and annotation data');
    console.log('[nanopub-view] DOI:', doi);
    console.log('[nanopub-view] Quote text:', annotationData.quoteText?.substring(0, 50));
    console.log('[nanopub-view] Comment:', annotationData.comment?.substring(0, 50));

    // Delay to ensure form is fully rendered
    setTimeout(() => {
      // Direct field targeting by name attribute
      
      // st01_object = DOI field ("quotes from")
      if (doi) {
        const doiValue = doi.startsWith('http') ? doi : `https://doi.org/${doi}`;
        this.fillFieldByName(formContainer, 'st01_object', doiValue);
      } else if (url) {
        this.fillFieldByName(formContainer, 'st01_object', url);
      }

      // st02_object = Quotation field ("has quoted text")
      if (annotationData.quoteText) {
        this.fillFieldByName(formContainer, 'st02_object', annotationData.quoteText);
      }

      // st03_object = Quote end field ("has quoted text end")
      if (annotationData.quoteEnd) {
        this.fillFieldByName(formContainer, 'st03_object', annotationData.quoteEnd);
      }

      // st04_object = Comment field ("has comment")
      if (annotationData.comment) {
        this.fillFieldByName(formContainer, 'st04_object', annotationData.comment);
      }

      console.log('[nanopub-view] ✅ Form pre-fill complete');
    }, 600);

  } catch (error: any) {
    console.error('[nanopub-view] Error pre-filling form:', error);
  }
}

/**
 * Fill a specific field by its name attribute
 */
private static fillFieldByName(container: HTMLElement, fieldName: string, value: string) {
  console.log(`[nanopub-view] Looking for field with name="${fieldName}"`);
  
  // Try multiple selectors
  let field: HTMLInputElement | HTMLTextAreaElement | null = null;
  
  // Try by name
  field = container.querySelector(`[name="${fieldName}"]`) as HTMLInputElement | HTMLTextAreaElement;
  
  // Try by id
  if (!field) {
    field = container.querySelector(`#field_${fieldName}`) as HTMLInputElement | HTMLTextAreaElement;
  }
  
  // Try partial match on name
  if (!field) {
    field = container.querySelector(`[name*="${fieldName}"]`) as HTMLInputElement | HTMLTextAreaElement;
  }
  
  if (field) {
    console.log(`[nanopub-view] ✅ Found field: name="${field.name}" id="${field.id}" tag="${field.tagName}"`);
    
    // Only fill if empty
    if (!field.value || field.value.trim() === '') {
      field.value = value;
      
      // Trigger events
      try {
        const doc = field.ownerDocument;
        const inputEvent = doc.createEvent('Event');
        inputEvent.initEvent('input', true, true);
        field.dispatchEvent(inputEvent);
        
        const changeEvent = doc.createEvent('Event');
        changeEvent.initEvent('change', true, true);
        field.dispatchEvent(changeEvent);
        
        console.log(`[nanopub-view] ✅ Filled field "${fieldName}" with: ${value.substring(0, 50)}...`);
      } catch (e) {
        console.log(`[nanopub-view] Event dispatch error for ${fieldName}:`, e);
      }
    } else {
      console.log(`[nanopub-view] Skipping field "${fieldName}" (already has value)`);
    }
  } else {
    console.log(`[nanopub-view] ⚠️ Field not found: ${fieldName}`);
    
    // Debug: list all available fields
    const allFields = container.querySelectorAll('input, textarea');
    console.log(`[nanopub-view] Available fields in container:`);
    allFields.forEach((f: Element) => {
      const el = f as HTMLInputElement | HTMLTextAreaElement;
      console.log(`  - name="${el.name}" id="${el.id}" tag="${el.tagName}"`);
    });
  }
}

  /**
   * Apply dark mode styles directly to elements using JavaScript
   */
  private static applyDarkModeStyles(container: HTMLElement): void {
    console.log('[nanopub-view] 🎨 Applying dark mode styles directly to elements...');
    
    const applyStyles = () => {
      console.log('[nanopub-view] --- Running applyStyles ---');
      console.log('[nanopub-view] Container children count:', container.children.length);
      
      // Container itself
      container.style.backgroundColor = '#111827';
      container.style.color = '#e5e5e5';
      
      // Subject groups (the pink boxes)
      const subjectGroups = container.querySelectorAll('.subject-group');
      console.log('[nanopub-view] Found', subjectGroups.length, '.subject-group elements');
      subjectGroups.forEach((el: Element) => {
        (el as any).style.backgroundColor = '#3d2432';
        (el as any).style.borderColor = '#ff3d8f';
        (el as any).style.color = '#e5e5e5';
        (el as any).style.width = '100%';
        (el as any).style.maxWidth = '100%';
        (el as any).style.boxSizing = 'border-box';
        (el as any).style.overflow = 'hidden';
      });
      
      // All labels
      const labels = container.querySelectorAll('label, .field-label, .subject-label');
      console.log('[nanopub-view] Found', labels.length, 'label elements');
      labels.forEach((el: Element) => {
        (el as any).style.color = '#e5e5e5';
        (el as any).style.fontWeight = '600';
      });
      
      // Find collapsible elements
      const allElements = container.querySelectorAll('*');
      let collapsibleCount = 0;
      allElements.forEach((el: Element) => {
        const tagName = el.tagName ? el.tagName.toLowerCase() : '';
        if (tagName === 'style' || tagName === 'script' || tagName === 'link' || tagName === 'meta' ||
            tagName === 'input' || tagName === 'textarea' || tagName === 'select' || tagName === 'button') {
          return;
        }
        
        const text = (el as any).textContent || '';
        const style = (el as any).style;
        
        if (text.length > 300) return;
        if (text.trim().length < 15) return;
        if (text.includes('===') || text.includes('--bg-') || text.includes('--text-') || 
            text.includes('{') || text.includes('/*') || text.includes('var(') || 
            text.includes('#nanopub-form') || text.includes('.subject-group')) {
          return;
        }
        
        const children = (el as any).children;
        if (children && children.length > 5) return;
        
        const hasCursorPointer = style.cursor === 'pointer' || (el as any).onclick;
        if (!hasCursorPointer) return;
        
        const hasOptionalText = text.includes('OPTIONAL');
        const hasGeometryIcon = text.includes('📍');
        const hasRelevantText = hasOptionalText || hasGeometryIcon || 
                               text.includes('details') || text.includes('bounding');
        
        if (hasRelevantText) {
          collapsibleCount++;
          (el as any).style.backgroundColor = '#2d2d2d';
          (el as any).style.color = '#e5e5e5';
          (el as any).style.padding = '10px 12px';
          (el as any).style.borderRadius = '6px';
          (el as any).style.cursor = 'pointer';
          (el as any).style.fontWeight = '600';
          (el as any).style.marginBottom = '8px';
          (el as any).style.width = '100%';
          (el as any).style.maxWidth = '100%';
          (el as any).style.boxSizing = 'border-box';
          (el as any).style.display = 'flex';
          (el as any).style.justifyContent = 'space-between';
          (el as any).style.alignItems = 'center';
          (el as any).style.flexWrap = 'nowrap';
          
          if (children) {
            for (let i = 0; i < children.length; i++) {
              const child = children[i];
              if (child.textContent && child.textContent.includes('OPTIONAL')) {
                child.style.flexShrink = '0';
                child.style.marginLeft = '8px';
              }
            }
          }
        }
      });
      console.log('[nanopub-view] Found', collapsibleCount, 'potential collapsible elements');
      
      // All text elements
      const textElements = container.querySelectorAll('p, span, div:not(.form-input):not(input):not(textarea), legend, h1, h2, h3, h4, h5, h6');
      console.log('[nanopub-view] Found', textElements.length, 'text elements');
      textElements.forEach((el: Element) => {
        if (!el.matches || !el.matches('input, textarea, select, button')) {
          (el as any).style.color = '#e5e5e5';
        }
      });
      
      // Help text and hints
      const helpText = container.querySelectorAll('.field-help, .field-hint, small');
      console.log('[nanopub-view] Found', helpText.length, 'help text elements');
      helpText.forEach((el: Element) => {
        (el as any).style.color = '#a0a0a0';
      });
      
      // All inputs, textareas, selects
      const inputs = container.querySelectorAll('input:not([type="submit"]):not([type="button"]), textarea, select, .form-input, .form-textarea, .form-select');
      console.log('[nanopub-view] Found', inputs.length, 'input elements');
      inputs.forEach((el: Element) => {
        (el as any).style.backgroundColor = '#1e1e1e';
        (el as any).style.color = '#e5e5e5';
        (el as any).style.borderColor = '#525252';
        (el as any).style.borderWidth = '2px';
        (el as any).style.borderStyle = 'solid';
        (el as any).style.boxSizing = 'border-box';
        (el as any).style.maxWidth = '100%';
        (el as any).style.width = '100%';
      });
      
      // Select options
      const selects = container.querySelectorAll('select');
      console.log('[nanopub-view] Found', selects.length, 'select elements');
      selects.forEach((select: Element) => {
        const options = (select as any).querySelectorAll('option');
        options.forEach((option: any) => {
          option.style.backgroundColor = '#1e1e1e';
          option.style.color = '#e5e5e5';
        });
      });
      
      // OPTIONAL badges
      const optionalBadges = container.querySelectorAll('.optional-badge, [class*="optional"]');
      console.log('[nanopub-view] Found', optionalBadges.length, 'optional badge elements');
      optionalBadges.forEach((el: Element) => {
        const text = (el as any).textContent || '';
        if (text.includes('OPTIONAL')) {
          (el as any).style.backgroundColor = '#1e3a5f';
          (el as any).style.color = '#ffffff';
          (el as any).style.padding = '3px 8px';
          (el as any).style.borderRadius = '4px';
          (el as any).style.fontSize = '0.75em';
          (el as any).style.fontWeight = '600';
          (el as any).style.display = 'inline-block';
          (el as any).style.marginLeft = '8px';
        }
      });
      
      // Buttons
      const buttons = container.querySelectorAll('button, .btn-primary, [type="submit"]');
      console.log('[nanopub-view] Found', buttons.length, 'button elements');
      buttons.forEach((el: Element) => {
        (el as any).style.backgroundColor = '#ff3d8f';
        (el as any).style.color = '#ffffff';
        (el as any).style.padding = '12px 24px';
        (el as any).style.minHeight = '44px';
        (el as any).style.display = 'inline-flex';
        (el as any).style.alignItems = 'center';
        (el as any).style.justifyContent = 'center';
        (el as any).style.fontWeight = '600';
        (el as any).style.fontSize = '1em';
        (el as any).style.lineHeight = '1.5';
      });
      
      console.log('[nanopub-view] --- applyStyles complete ---');
    };
    
    // Apply immediately and multiple times to catch delayed rendering
    applyStyles();
    setTimeout(() => applyStyles(), 100);
    setTimeout(() => applyStyles(), 300);
    setTimeout(() => applyStyles(), 500);
    setTimeout(() => applyStyles(), 1000);
    setTimeout(() => applyStyles(), 2000);
    
    console.log('[nanopub-view] ✅ Dark mode style application scheduled');
  }

  private static injectStyles(container: HTMLElement, isDarkMode: boolean): void {
    const styleEl = container.ownerDocument.createElement('style');
    styleEl.id = 'nanopub-form-styles';
    
    styleEl.textContent = `
      /* ===== CSS VARIABLES ===== */
      
      #nanopub-form-container {
        --bg-main: #ffffff;
        --bg-subtle: #f5f5f5;
        --bg-subject: #fef0f7;
        --border-main: #e5e7eb;
        --border-subject: #BE2E78;
        --text-dark: #1f2937;
        --text-light: #6b7280;
        --input-bg: #ffffff;
        --input-border: #d1d5db;
        --input-text: #1f2937;
        --button-bg: #BE2E78;
        --button-text: #ffffff;
      }

      #nanopub-form-container[data-theme="dark"],
      #nanopub-form-container.dark-mode,
      #nanopub-form-container.dark {
        --bg-main: #111827;
        --bg-subtle: #1f2937;
        --bg-subject: #3d2432;
        --border-main: #374151;
        --border-subject: #ff3d8f;
        --text-dark: #e5e5e5;
        --text-light: #a0a0a0;
        --input-bg: #1e1e1e;
        --input-border: #525252;
        --input-text: #e5e5e5;
        --button-bg: #ff3d8f;
        --button-text: #ffffff;
      }

      #nanopub-form-container {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: var(--bg-main);
        color: var(--text-dark);
        line-height: 1.6;
        overflow-x: hidden;
        max-width: 100%;
      }
      
      #nanopub-form-container * {
        box-sizing: border-box;
        max-width: 100%;
      }

      .form-input,
      input:not([type="submit"]):not([type="button"]),
      textarea,
      select {
        width: 100%;
        max-width: 100%;
        padding: 10px 12px;
        background: var(--input-bg);
        color: var(--input-text);
        border: 2px solid var(--input-border);
        border-radius: 6px;
        font-size: 0.95em;
        font-family: inherit;
        transition: border-color 0.2s, background-color 0.2s;
        box-sizing: border-box;
      }

      .form-input:focus,
      input:focus,
      textarea:focus,
      select:focus {
        outline: none;
        border-color: var(--border-subject);
      }
      
      select option {
        background: var(--input-bg);
        color: var(--input-text);
      }

      button,
      .btn-primary,
      input[type="submit"],
      input[type="button"] {
        padding: 12px 24px;
        min-height: 44px;
        background: var(--button-bg);
        color: var(--button-text);
        border: 2px solid var(--button-bg);
        border-radius: 6px;
        font-weight: 600;
        font-size: 1em;
        line-height: 1.5;
        cursor: pointer;
        transition: all 0.2s;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      button:hover,
      .btn-primary:hover {
        opacity: 0.9;
        transform: translateY(-1px);
      }

      .subject-group {
        background: var(--bg-subject);
        border: 2px solid var(--border-subject);
        border-radius: 8px;
        padding: 1.5rem;
        margin-bottom: 1.5rem;
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
      }
      
      #nanopub-form-container[data-theme="dark"] .subject-group,
      #nanopub-form-container.dark-mode .subject-group,
      #nanopub-form-container.dark .subject-group {
        background: #3d2432 !important;
        border-color: #ff3d8f !important;
      }

      .subject-field {
        margin-bottom: 1.5rem;
        padding-bottom: 1rem;
        border-bottom: 2px solid rgba(190, 46, 120, 0.2);
      }

      .subject-label {
        font-weight: 600;
        font-size: 1.15em;
        color: var(--text-dark);
        margin-bottom: 0.75rem;
        display: block;
      }
      
      #nanopub-form-container[data-theme="dark"] [style*="cursor: pointer"],
      #nanopub-form-container.dark-mode [style*="cursor: pointer"],
      #nanopub-form-container.dark [style*="cursor: pointer"],
      #nanopub-form-container[data-theme="dark"] [style*="cursor:pointer"],
      #nanopub-form-container.dark-mode [style*="cursor:pointer"],
      #nanopub-form-container.dark [style*="cursor:pointer"] {
        background: #2d2d2d !important;
        color: #e5e5e5 !important;
        width: 100% !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        flex-wrap: nowrap !important;
      }
      
      #nanopub-form-container[data-theme="dark"] .subject-label,
      #nanopub-form-container.dark-mode .subject-label,
      #nanopub-form-container.dark .subject-label,
      #nanopub-form-container[data-theme="dark"] .field-label,
      #nanopub-form-container.dark-mode .field-label,
      #nanopub-form-container.dark .field-label,
      #nanopub-form-container[data-theme="dark"] label,
      #nanopub-form-container.dark-mode label,
      #nanopub-form-container.dark label,
      #nanopub-form-container[data-theme="dark"] p,
      #nanopub-form-container.dark-mode p,
      #nanopub-form-container.dark p,
      #nanopub-form-container[data-theme="dark"] span,
      #nanopub-form-container.dark-mode span,
      #nanopub-form-container.dark span,
      #nanopub-form-container[data-theme="dark"] div,
      #nanopub-form-container.dark-mode div,
      #nanopub-form-container.dark div {
        color: #e5e5e5 !important;
      }

      #nanopub-form-container[data-theme="dark"] input,
      #nanopub-form-container.dark-mode input,
      #nanopub-form-container.dark input,
      #nanopub-form-container[data-theme="dark"] textarea,
      #nanopub-form-container.dark-mode textarea,
      #nanopub-form-container.dark textarea,
      #nanopub-form-container[data-theme="dark"] select,
      #nanopub-form-container.dark-mode select,
      #nanopub-form-container.dark select {
        background: #1e1e1e !important;
        color: #e5e5e5 !important;
        border-color: #525252 !important;
      }
      
      #nanopub-form-container[data-theme="dark"] select option,
      #nanopub-form-container.dark-mode select option,
      #nanopub-form-container.dark select option {
        background: #1e1e1e !important;
        color: #e5e5e5 !important;
      }
      
      #nanopub-form-container[data-theme="dark"] input::placeholder,
      #nanopub-form-container.dark-mode input::placeholder,
      #nanopub-form-container.dark input::placeholder,
      #nanopub-form-container[data-theme="dark"] textarea::placeholder,
      #nanopub-form-container.dark-mode textarea::placeholder,
      #nanopub-form-container.dark textarea::placeholder {
        color: #a0a0a0 !important;
        opacity: 0.7 !important;
      }
      
      #nanopub-form-container[data-theme="dark"] .field-help,
      #nanopub-form-container.dark-mode .field-help,
      #nanopub-form-container.dark .field-help,
      #nanopub-form-container[data-theme="dark"] .field-hint,
      #nanopub-form-container.dark-mode .field-hint,
      #nanopub-form-container.dark .field-hint,
      #nanopub-form-container[data-theme="dark"] small,
      #nanopub-form-container.dark-mode small,
      #nanopub-form-container.dark small {
        color: #a0a0a0 !important;
      }

      p, span, div, label, legend, h1, h2, h3, h4, h5, h6 {
        color: var(--text-dark);
      }

      small, .text-muted, .description {
        color: var(--text-light);
      }

      .optional-badge {
        display: inline-block;
        margin-left: 0.5rem;
        padding: 3px 8px;
        background: #1e3a5f;
        color: #ffffff;
        font-size: 0.75em;
        font-weight: 600;
        border-radius: 4px;
        text-transform: uppercase;
      }
      
      #nanopub-form-container[data-theme="dark"] .optional-badge,
      #nanopub-form-container.dark-mode .optional-badge,
      #nanopub-form-container.dark .optional-badge {
        background: #1e3a5f !important;
        color: #ffffff !important;
      }

      .form-header {
        margin-bottom: 2rem;
      }

      .form-header h2 {
        color: var(--text-dark);
        margin-bottom: 0.5rem;
      }

      .form-description {
        color: var(--text-light);
        font-size: 0.95em;
      }
    `;
    
    container.insertBefore(styleEl, container.firstChild);
    console.log('[nanopub-view] ✅ Styles injected into form container');
  }

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

      let displayUri = result.uri;
      if (!displayUri.includes('w3id.org')) {
        const idMatch = displayUri.match(/\/np\/([A-Za-z0-9_-]+)/);
        if (idMatch) {
          displayUri = `https://w3id.org/np/${idMatch[1]}`;
        }
      }

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
          const { NanopubDisplay } = await import("./nanopubDisplay");
          const display = new NanopubDisplay();
          await display.displayFromUri(preSelectedItem, displayUri, true);
          
          Services.prompt.alert(
            null,
            'Success',
            'Nanopublication attached successfully! Check the notes attached to your selected item.'
          );
        }
      } else {
        Services.prompt.alert(null, 'Success - Nanopublication Published', message);
      }

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

  private static isZoteroDarkMode(win: Window): boolean {
    try {
      const doc = win.document;
      const body = doc.body || doc.documentElement;
      
      if (body.classList.contains('dark') || 
          body.classList.contains('dark-mode') ||
          body.getAttribute('data-theme') === 'dark') {
        return true;
      }
      
      const bgColor = win.getComputedStyle(body).backgroundColor;
      if (bgColor) {
        const match = bgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (match) {
          const brightness = (parseInt(match[1]) + parseInt(match[2]) + parseInt(match[3])) / 3;
          if (brightness < 128) {
            return true;
          }
        }
      }
      
      if (win.matchMedia && win.matchMedia('(prefers-color-scheme: dark)').matches) {
        return true;
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }
}