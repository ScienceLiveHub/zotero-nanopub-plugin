// src/modules/templateFormDialog.ts
// Simple form dialog for creating nanopubs from templates

import { TemplateBrowser } from "./templateBrowser";

export class TemplateFormDialog {
  
  /**
   * Show the complete workflow:
   * 1. Select template
   * 2. Show form
   * 3. Create and publish nanopub
   */
  static async showTemplateWorkflow(preSelectedItem?: Zotero.Item) {
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

      // Step 2: Select template
      const templateUri = await TemplateBrowser.showBrowser();
      
      if (!templateUri) {
        return; // User cancelled
      }

      // Step 3: Get selected item if not provided
      let item = preSelectedItem;
      
      if (!item) {
        const pane = Zotero.getActiveZoteroPane();
        const items = pane?.getSelectedItems();
        
        if (items && items.length > 0) {
          item = items[0];
        }
      }

      // Step 4: Load template info
      console.log('Loading template:', templateUri);
      
      const progressWin = new Zotero.ProgressWindow();
      progressWin.changeHeadline('Loading Template');
      progressWin.addLines(['Loading template information...']);
      progressWin.show();
      
      const info = await creator.loadTemplateInfo(templateUri);
      
      progressWin.close();
      
      console.log('Template loaded:', info.label);
      console.log('Placeholders:', info.placeholders.length);

      // Step 5: Show form
      const formData = await this.showSimpleForm(info, item);
      
      if (!formData) {
        return; // User cancelled
      }

      // Step 6: Create and publish
      progressWin.changeHeadline('Creating Nanopublication');
      progressWin.addLines(['Signing and publishing...']);
      progressWin.show();
      
      const result = await creator.createAndPublishFromTemplate(templateUri, formData);
      
      progressWin.close();

      // Step 7: Success!
      const viewUrl = `https://nanodash.knowledgepixels.com/explore?id=${encodeURIComponent(result.uri)}`;
      
      const message = `Successfully created and published!\n\n` +
        `Template: ${info.label}\n\n` +
        `URI: ${result.uri}\n\n` +
        `View at Nanodash:\n${viewUrl}\n\n` +
        (item ? `Attach to selected item?` : 'Done!');

      if (item) {
        const attach = Services.prompt.confirm(
          null,
          'Success',
          message
        );

        if (attach) {
          await Zotero.Nanopub.displayModule.displayFromUri(item, result.uri);
          Services.prompt.alert(
            null,
            'Success',
            'Nanopublication attached to item!'
          );
        }
      } else {
        Services.prompt.alert(
          null,
          'Success',
          message
        );
      }

    } catch (e) {
      console.error('Template workflow failed:', e);
      Services.prompt.alert(
        null,
        'Error',
        `Failed to create nanopublication:\n${e.message}`
      );
    }
  }

  /**
   * Show a simple form for collecting field values
   * This is a basic implementation using sequential prompts
   * 
   * TODO: Replace with proper XUL dialog in Phase 2
   */
  private static async showSimpleForm(
    info: any,
    item?: Zotero.Item
  ): Promise<Record<string, any> | null> {
    
    const formData: Record<string, any> = {};
    
    // Show template info first
    const proceed = Services.prompt.confirm(
      null,
      info.label,
      `${info.description}\n\n` +
      `This template has ${info.placeholders.length} field(s).\n\n` +
      'Continue to fill in the fields?'
    );
    
    if (!proceed) {
      return null;
    }

    // Try to pre-fill from Zotero item if available
    if (item) {
      this.preFillFromItem(formData, info, item);
    }

    // Collect value for each placeholder
    for (const placeholder of info.placeholders) {
      const value = await this.promptForField(placeholder, formData[placeholder.id]);
      
      if (value === null && placeholder.required) {
        // Required field cancelled
        return null;
      }
      
      if (value !== null) {
        formData[placeholder.id] = value;
      }
    }

    // Show summary
    const summary = Object.entries(formData)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
    
    const confirm = Services.prompt.confirm(
      null,
      'Confirm Values',
      `Please confirm your entries:\n\n${summary}\n\nCreate nanopublication?`
    );

    if (!confirm) {
      return null;
    }

    return formData;
  }

  /**
   * Prompt for a single field value
   */
  private static async promptForField(
    placeholder: any,
    prefillValue?: string
  ): Promise<string | null> {
    
    const input = { value: prefillValue || '' };
    
    const label = placeholder.label || placeholder.id;
    const required = placeholder.required ? ' (required)' : ' (optional)';
    
    const ok = Services.prompt.prompt(
      null,
      'Enter Field Value',
      `${label}${required}:`,
      input,
      null,
      { value: false }
    );

    if (!ok) {
      return null;
    }

    const value = input.value.trim();
    
    // Return null if empty and optional
    if (!value && !placeholder.required) {
      return null;
    }

    return value || null;
  }

  /**
   * Pre-fill form data from Zotero item
   */
  private static preFillFromItem(
    formData: Record<string, any>,
    info: any,
    item: Zotero.Item
  ): void {
    
    for (const placeholder of info.placeholders) {
      const value = this.getValueForPlaceholder(item, placeholder);
      if (value) {
        formData[placeholder.id] = value;
        console.log(`Pre-filled ${placeholder.id}: ${value}`);
      }
    }
  }

  /**
   * Get value from Zotero item for a placeholder
   * Smart matching based on placeholder ID and label
   */
  private static getValueForPlaceholder(
    item: Zotero.Item,
    placeholder: any
  ): string | null {
    
    const id = placeholder.id?.toLowerCase() || '';
    const label = placeholder.label?.toLowerCase() || '';
    
    try {
      // DOI fields
      if (id.includes('doi') || label.includes('doi')) {
        const doi = item.getField('DOI');
        if (doi) {
          return doi.startsWith('http') ? doi : `https://doi.org/${doi}`;
        }
      }
      
      // Title fields
      if (id.includes('title') || label.includes('title')) {
        return item.getField('title');
      }
      
      // URL fields
      if (id.includes('url') || label.includes('url') || label.includes('link')) {
        const url = item.getField('url');
        if (url) return url;
        
        // Fallback to DOI URL
        const doi = item.getField('DOI');
        if (doi) {
          return doi.startsWith('http') ? doi : `https://doi.org/${doi}`;
        }
      }
      
      // Author fields
      if (id.includes('author') || label.includes('author') || label.includes('creator')) {
        const creators = item.getCreators();
        if (creators.length > 0) {
          return `${creators[0].firstName} ${creators[0].lastName}`;
        }
      }
      
      // Date fields
      if (id.includes('date') || label.includes('date') || label.includes('year')) {
        return item.getField('date');
      }
      
      // Abstract/description fields
      if (id.includes('abstract') || id.includes('description') || 
          label.includes('abstract') || label.includes('description')) {
        return item.getField('abstractNote');
      }
      
      // Publication fields
      if (id.includes('publication') || label.includes('publication') || label.includes('journal')) {
        return item.getField('publicationTitle');
      }
      
    } catch (e) {
      // Field doesn't exist for this item type
      console.log(`Could not get field for ${placeholder.id}:`, e.message);
    }
    
    return null;
  }
}
