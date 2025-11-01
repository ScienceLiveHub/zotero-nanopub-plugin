// src/modules/nanopubDisplay.ts
import { log, error } from "../utils/logger";
import { NanopubViewer } from '@sciencelivehub/nanopub-view';

/**
 * Module for displaying nanopublications using nanopub-view library
 */
export class NanopubDisplay {
  constructor() {
    log("NanopubDisplay: Display module created");
  }

  /**
   * Display a nanopublication from URI in a Zotero note attached to an item
   * @param item - The Zotero item to attach the note to
   * @param nanopubUri - The URI of the nanopublication
   * @param isCreated - If true, tag as 'nanopub:created', otherwise 'nanopub:imported'
   */
  async displayFromUri(item: any, nanopubUri: string, isCreated: boolean = false): Promise<void> {
    try {
      log("Displaying nanopub from URI: " + nanopubUri);

      // Create viewer instance
      const viewer = new NanopubViewer({
        theme: 'default',
        showMetadata: true
      });

      // Create a temporary container
      const doc = Zotero.getMainWindow().document;
      const tempDiv = doc.createElement('div');
      
      // Render the nanopub
      const parsedData = await viewer.renderFromUri(tempDiv, nanopubUri);

      // Extract label/type from parsed data or rendered HTML
      const nanopubLabel = this.extractLabelFromParsedData(parsedData, tempDiv);
      
      log("Extracted nanopub label: " + nanopubLabel);

      // Get the HTML content
      let htmlContent = tempDiv.innerHTML;
      
      // Remove interactive elements and text labels
      htmlContent = this.cleanHtmlForNote(htmlContent);

      // Create note with the cleaned content
      const note = new Zotero.Item('note');
      
      // Include CSS and content with a direct link
      const noteContent = `
        <div style="font-size: 16px; font-weight: bold; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 2px solid currentColor;">
          Science Live: ${nanopubLabel}
        </div>
        <link rel="stylesheet" href="chrome://nanopub-plugin/content/styles/nanopub-viewer.css">
        <style>
          button, .action-bar, .actions, .nanopub-actions, 
          [class*="action"], [class*="button"], .copy-button, 
          .download-buttons, .format-buttons {
            display: none !important;
          }
        </style>
        <div class="nanopub-container">
          ${htmlContent}
        </div>
        <div style="margin-top: 20px; padding: 15px; border: 2px solid currentColor; border-radius: 6px; opacity: 0.8;">
          <div style="font-size: 13px; margin-bottom: 8px;">
            <strong>📎 Nanopublication Source:</strong>
          </div>
          <div style="font-size: 12px; margin-bottom: 10px; word-break: break-all;">
            <a href="${nanopubUri}" target="_blank" style="color: inherit; text-decoration: underline;">${nanopubUri}</a>
          </div>
          <div style="font-size: 11px;">
            <a href="https://nanodash.knowledgepixels.com/explore?id=${encodeURIComponent(nanopubUri)}" target="_blank" style="color: inherit; text-decoration: underline;">🔍 Explore this nanopublication</a>
          </div>
        </div>
      `;
      
      note.setNote(noteContent);
      note.parentItemID = item.id;

      // Add tags
      note.addTag('nanopublication');
      note.addTag(isCreated ? 'nanopub:created' : 'nanopub:imported');
      
      // Add type-based tag
      const typeTag = nanopubLabel.toLowerCase().replace(/[^\w]+/g, '-');
      note.addTag(`nanopub:${typeTag}`);

      await note.saveTx();

      log("Successfully created note for nanopub: " + nanopubUri);
    } catch (err: any) {
      error("Failed to display nanopub from URI: " + nanopubUri, err);
      throw err;
    }
  }

/**
   * Import a nanopublication as a standalone Zotero item
   */
  async importAsStandaloneItem(nanopubUri: string, collectionID?: number): Promise<any> {
    try {
      log("Importing nanopub as standalone item from URI: " + nanopubUri);

      // Create viewer instance
      const viewer = new NanopubViewer({
        theme: 'default',
        showMetadata: true
      });

      // Create a temporary container
      const doc = Zotero.getMainWindow().document;
      const tempDiv = doc.createElement('div');
      
      // Render the nanopub
      const parsedData = await viewer.renderFromUri(tempDiv, nanopubUri);

      // Extract label/type from parsed data or rendered HTML
      const nanopubLabel = this.extractLabelFromParsedData(parsedData, tempDiv);
      
      log("Extracted nanopub label: " + nanopubLabel);

      // Get the HTML content
      let htmlContent = tempDiv.innerHTML;
      
      // Remove interactive elements and text labels
      htmlContent = this.cleanHtmlForNote(htmlContent);

      // Create a new item (using 'document' type as closest match)
      const item = new Zotero.Item('document');
      
      // Set basic metadata
      item.setField('title', `Science Live: ${nanopubLabel}`);
      item.setField('url', nanopubUri);
      item.setField('accessDate', new Date().toISOString().split('T')[0]);
      
      // Try to extract author/date from parsed data if available
      if (parsedData) {
        if (parsedData.creator || parsedData.author) {
          const creatorName = parsedData.creator || parsedData.author;
          item.setCreator(0, Zotero.Utilities.cleanAuthor(creatorName, 'author'));
        }
        
        if (parsedData.date || parsedData.created) {
          const date = parsedData.date || parsedData.created;
          item.setField('date', date);
        }
      }
      
      // Add to collection if specified
      if (collectionID) {
        item.setCollections([collectionID]);
      }

      // Save the item first
      await item.saveTx();

      // Add tags
      item.addTag('nanopublication');
      item.addTag('nanopub:imported');
      
      // Add type-based tag
      const typeTag = nanopubLabel.toLowerCase().replace(/[^\w]+/g, '-');
      item.addTag(`nanopub:${typeTag}`);

      await item.saveTx();

      // Now create a note with the full content and attach it
      const note = new Zotero.Item('note');
      
      const noteContent = `
        <div style="font-size: 16px; font-weight: bold; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 2px solid currentColor;">
          Nanopublication Content
        </div>
        <link rel="stylesheet" href="chrome://nanopub-plugin/content/styles/nanopub-viewer.css">
        <style>
          button, .action-bar, .actions, .nanopub-actions, 
          [class*="action"], [class*="button"], .copy-button, 
          .download-buttons, .format-buttons {
            display: none !important;
          }
        </style>
        <div class="nanopub-container">
          ${htmlContent}
        </div>
        <div style="margin-top: 20px; padding: 15px; border: 2px solid currentColor; border-radius: 6px; opacity: 0.8;">
          <div style="font-size: 13px; margin-bottom: 8px;">
            <strong>📎 Nanopublication Source:</strong>
          </div>
          <div style="font-size: 12px; margin-bottom: 10px; word-break: break-all;">
            <a href="${nanopubUri}" target="_blank" style="color: inherit; text-decoration: underline;">${nanopubUri}</a>
          </div>
          <div style="font-size: 11px;">
            <a href="https://nanodash.knowledgepixels.com/explore?id=${encodeURIComponent(nanopubUri)}" target="_blank" style="color: inherit; text-decoration: underline;">🔍 Explore this nanopublication</a>
          </div>
        </div>
      `;
      
      note.setNote(noteContent);
      note.parentItemID = item.id;
      note.addTag('nanopub:content');
      
      await note.saveTx();

      log("Successfully created standalone item for nanopub: " + nanopubUri);
      return item;
    } catch (err: any) {
      error("Failed to import nanopub as standalone item: " + nanopubUri, err);
      throw err;
    }
  }
  /**
   * Display a nanopublication from TriG content in a Zotero note
   */
  async displayFromContent(item: any, trigContent: string): Promise<void> {
    try {
      log("Displaying nanopub from content");

      // Create viewer instance
      const viewer = new NanopubViewer({
        theme: 'default',
        showMetadata: true
      });

      // Create a temporary container
      const doc = Zotero.getMainWindow().document;
      const tempDiv = doc.createElement('div');
      
      // Render the nanopub
      const parsedData = await viewer.render(tempDiv, trigContent);

      // Extract label from parsed data
      const nanopubLabel = this.extractLabelFromParsedData(parsedData, tempDiv);
      
      log("Extracted nanopub label: " + nanopubLabel);

      // Get and clean HTML
      let htmlContent = tempDiv.innerHTML;
      htmlContent = this.cleanHtmlForNote(htmlContent);

      // Create note with the rendered content
      const note = new Zotero.Item('note');
      
      const noteContent = `
        <div style="font-size: 16px; font-weight: bold; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 2px solid currentColor;">
          Science Live: ${nanopubLabel}
        </div>
        <link rel="stylesheet" href="chrome://nanopub-plugin/content/styles/nanopub-viewer.css">
        <style>
          button, .action-bar, .actions, .nanopub-actions, 
          [class*="action"], [class*="button"], .copy-button,
          .download-buttons, .format-buttons {
            display: none !important;
          }
        </style>
        <div class="nanopub-container">
          ${htmlContent}
        </div>
      `;
      
      note.setNote(noteContent);
      note.parentItemID = item.id;

      // Add tags
      note.addTag('nanopublication');
      note.addTag('nanopub:created');
      
      const typeTag = nanopubLabel.toLowerCase().replace(/[^\w]+/g, '-');
      note.addTag(`nanopub:${typeTag}`);

      await note.saveTx();

      log("Successfully created note with nanopub content");
    } catch (err: any) {
      error("Failed to display nanopub from content", err);
      throw err;
    }
  }

  /**
   * Extract label from nanopub-view's parsed data or rendered HTML
   */
  private extractLabelFromParsedData(parsedData: any, container: HTMLElement): string {
    try {
      // Method 1: Check if parsedData has a label or title property
      if (parsedData && parsedData.label) {
        return this.cleanLabel(parsedData.label);
      }
      
      if (parsedData && parsedData.title) {
        return this.cleanLabel(parsedData.title);
      }

      // Method 2: Look for the title in the rendered HTML
      const titleElement = container.querySelector('.pub-title, .nanopub-title, h1, h2');
      if (titleElement && titleElement.textContent) {
        const title = titleElement.textContent.trim();
        if (title.length > 0 && title.length < 200) {
          return this.cleanLabel(title);
        }
      }

      // Method 3: Look for a type field in metadata
      const typeElement = container.querySelector('[class*="type"], [data-type]');
      if (typeElement && typeElement.textContent) {
        const type = typeElement.textContent.trim();
        if (type.length > 0 && type.length < 100) {
          return this.cleanLabel(type);
        }
      }

      // Method 4: Check parsedData for type information
      if (parsedData && parsedData.type) {
        return this.cleanLabel(parsedData.type);
      }

      log("Could not extract label from parsed data, using fallback");
    } catch (err: any) {
      error("Error extracting label:", err);
    }

    // Fallback
    return "Nanopublication";
  }

  /**
   * Clean and format the label
   */
  private cleanLabel(label: string): string {
    // Remove extra whitespace
    label = label.replace(/\s+/g, ' ').trim();
    
    // If it's a URI, extract the last part
    if (label.includes('http://') || label.includes('https://')) {
      label = label.split('/').pop() || label;
      label = label.split('#').pop() || label;
    }
    
    // Limit length
    if (label.length > 100) {
      label = label.substring(0, 100) + '...';
    }
    
    return label;
  }

  /**
   * Clean HTML by removing interactive elements and text labels
   */
  private cleanHtmlForNote(html: string): string {
    // Remove button elements
    html = html.replace(/<button[^>]*>.*?<\/button>/gis, '');
    
    // Remove action bar divs
    html = html.replace(/<div[^>]*class="[^"]*action[^"]*"[^>]*>.*?<\/div>/gis, '');
    
    // Remove text content that looks like button labels
    const buttonLabels = [
      'Copy link',
      'Open in new tab',
      'TriG\\(txt\\)',
      'JSON-LD\\(txt\\)',
      'N-Quads\\(txt\\)',
      'XML\\(txt\\)',
      'Download as',
      'Share',
      'Cite'
    ];
    
    buttonLabels.forEach(label => {
      // Remove as standalone text
      html = html.replace(new RegExp(`\\s*${label}\\s*`, 'gi'), ' ');
      // Remove in spans or other elements
      html = html.replace(new RegExp(`<[^>]*>${label}<\\/[^>]*>`, 'gi'), '');
    });
    
    // Clean up multiple spaces
    html = html.replace(/\s{2,}/g, ' ');
    
    // Remove any onclick attributes
    html = html.replace(/\s*onclick="[^"]*"/gi, '');
    
    // Remove any data-action attributes
    html = html.replace(/\s*data-action="[^"]*"/gi, '');
    
    // Remove specific classes we know contain buttons
    const classesToRemove = [
      'action-bar',
      'actions',
      'nanopub-actions',
      'copy-button',
      'download-buttons',
      'format-buttons',
      'button-group'
    ];
    
    classesToRemove.forEach(className => {
      const regex = new RegExp(`<div[^>]*class="[^"]*${className}[^"]*"[^>]*>.*?<\/div>`, 'gis');
      html = html.replace(regex, '');
    });
    
    return html;
  }
}
