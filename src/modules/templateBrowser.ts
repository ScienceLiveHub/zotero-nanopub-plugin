// src/modules/templateBrowser.ts
// Template browser for selecting nanopub templates

export class TemplateBrowser {
  
  /**
   * Popular nanopub templates
   * These are well-tested, widely-used templates
   */
  static POPULAR_TEMPLATES = [
    {
      uri: 'https://w3id.org/np/RAX_4tWTyjFpO6nz63s14ucuejd64t2mK3IBlkwZ7jjLo',
      name: 'Citation with CiTO',
      description: 'Declare citations between papers using Citation Typing Ontology',
      category: 'Citation',
      icon: '📚'
    },
    {
      uri: 'https://w3id.org/np/RAVEpTdLrX5XrhNl_gnvTaBcjRRSDu_hhZix8gu2HO7jI',
      name: 'Comment on Paper',
      description: 'Add comments, quotes, or evaluations to papers',
      category: 'Annotation',
      icon: '💬'
    },
    {
      uri: 'https://w3id.org/np/RA4fmfVFULMP50FqDFX8fEMn66uDF07vXKFXh_L9aoQKE',
      name: 'AIDA Sentence',
      description: 'Make structured scientific claims following the AIDA model',
      category: 'Scientific',
      icon: '🔬'
    },
    {
      uri: 'https://w3id.org/np/RAfM-b6K5SBdRcK














3OiQzCHAuPe0AjGH8-7PuoOvY',
      name: 'General Statement',
      description: 'Make any general RDF statement',
      category: 'General',
      icon: '📝'
    }
  ];

  /**
   * Show template browser dialog
   * Returns selected template URI or null if cancelled
   */
  static async showBrowser(): Promise<string | null> {
    try {
      const templates = this.POPULAR_TEMPLATES;
      
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
  static getTemplateInfo(uri: string) {
    return this.POPULAR_TEMPLATES.find(t => t.uri === uri);
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
