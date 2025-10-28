// src/modules/templateBrowser.ts
// Template browser for selecting nanopub templates

import { POPULAR_TEMPLATES, type NanopubTemplate } from '../config/templates';

export class TemplateBrowser {
  
  /**
   * Get the list of popular templates for menu generation
   */
  static getPopularTemplates(): NanopubTemplate[] {
    return POPULAR_TEMPLATES;
  }
  
  /**
   * Show template browser dialog
   * Returns selected template URI or null if cancelled
   */
  static async showBrowser(): Promise<string | null> {
    try {
      const templates = POPULAR_TEMPLATES;
      
      // Create choices array with icons
      const choices = templates.map(t => `${t.icon} ${t.name} - ${t.description}`);
      const selected = { value: 0 };
      
      const ok = Services.prompt.select(
        null,
        'Select Nanopub Template',
        'Choose a template for your nanopublication:',
        choices.length,
        choices,
        selected
      );
      
      if (!ok) {
        return null;
      }
      
      const selectedTemplate = templates[selected.value];
      
      console.log('Selected template:', selectedTemplate.name);
      console.log('URI:', selectedTemplate.uri);
      
      return selectedTemplate.uri;
      
    } catch (e) {
      console.error('Template browser error:', e);
      Services.prompt.alert(
        null,
        'Error',
        `Failed to show template browser: ${e.message}`
      );
      return null;
    }
  }

  /**
   * Get template info by URI
   */
  static getTemplateInfo(uri: string): NanopubTemplate | undefined {
    return POPULAR_TEMPLATES.find(t => t.uri === uri);
  }

  /**
   * Show template details
   */
  static async showTemplateDetails(uri: string) {
    try {
      const creator = Zotero.Nanopub.creator;
      
      // Load template info from the creator
      const info = await creator.loadTemplateInfo(uri);
      
      // Format placeholder info
      const fieldsList = info.placeholders.map(p => 
        `  - ${p.label}${p.required ? ' (required)' : ' (optional)'}`
      ).join('\n');
      
      const message = `${info.label}\n\n` +
        `${info.description}\n\n` +
        `Fields:\n${fieldsList}\n\n` +
        `Types: ${info.types.join(', ')}`;
      
      Services.prompt.alert(
        null,
        'Template Details',
        message
      );
      
    } catch (e) {
      console.error('Failed to load template details:', e);
      Services.prompt.alert(
        null,
        'Error',
        `Failed to load template: ${e.message}`
      );
    }
  }
}
