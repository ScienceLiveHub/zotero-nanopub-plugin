// src/modules/readerIntegration.ts
// PDF Reader integration for creating nanopubs from annotations

import { log, error } from "../utils/logger";
import { TemplateFormDialog } from "./templateFormDialog";

export class ReaderIntegration {
  private pluginID: string = 'nanopub-plugin@sciencelivehub.com';
  private registered: boolean = false;

  constructor() {
    log("ReaderIntegration: Constructor called");
  }

  /**
   * Register reader event handlers
   */
  register() {
    try {
      log("ReaderIntegration: Registering PDF reader integration...");

      if (!Zotero.Reader) {
        error("ReaderIntegration: Zotero.Reader not available");
        return;
      }

      if (!Zotero.Reader.registerEventListener) {
        error("ReaderIntegration: Zotero.Reader.registerEventListener not available");
        return;
      }

      // Add "Create Nanopublication" to annotation context menu (right-click)
      Zotero.Reader.registerEventListener(
        'createAnnotationContextMenu',
        this.handleAnnotationContextMenu.bind(this),
        this.pluginID
      );

      // Add button to annotation sidebar header (below "Add tags...")
      Zotero.Reader.registerEventListener(
        'renderSidebarAnnotationHeader',
        this.handleSidebarAnnotationHeader.bind(this),
        this.pluginID
      );

      this.registered = true;
      log("ReaderIntegration: ✅ PDF reader integration registered successfully");
    } catch (err: any) {
      error("ReaderIntegration: Failed to register:", err);
    }
  }

  /**
   * Handle annotation context menu event (right-click menu)
   */
  private handleAnnotationContextMenu(event: any) {
    try {
      log("ReaderIntegration: Annotation context menu triggered");
      
      const { reader, params, append } = event;

      const annotationIds = params.ids || [];
      log(`ReaderIntegration: Annotation IDs: ${JSON.stringify(annotationIds)}`);
      
      if (annotationIds.length === 0) {
        log("ReaderIntegration: No annotations selected");
        return;
      }

      append({ type: 'separator' });

      const self = this;
      append({
        label: '✨ Create Nanopublication from Annotation',
        onCommand: async () => {
          log("ReaderIntegration: Menu item clicked");
          await self.createNanopubFromAnnotation(reader, annotationIds[0]);
        }
      });

      log("ReaderIntegration: Menu item added");
    } catch (err: any) {
      error("ReaderIntegration: Error in context menu handler:", err);
    }
  }

  /**
   * Handle sidebar annotation header - add button below tags
   */
  private handleSidebarAnnotationHeader(event: any) {
    try {
      const { reader, doc, params, append } = event;
      
      log("ReaderIntegration: Sidebar annotation header triggered");
      log("ReaderIntegration: Annotation params:", JSON.stringify(params?.annotation?.key || 'no key'));
      
      // Create a button container
      const container = doc.createElement('div');
      container.style.cssText = `
        margin-top: 8px;
        padding-top: 8px;
      `;
      
      // Create the button
      const button = doc.createElement('button');
      button.textContent = '✨ Create Nanopublication';
      button.style.cssText = `
        background: #4f46e5;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 6px 12px;
        font-size: 12px;
        cursor: pointer;
        width: 100%;
        transition: background 0.2s;
      `;
      
      button.addEventListener('mouseenter', () => {
        button.style.background = '#4338ca';
      });
      button.addEventListener('mouseleave', () => {
        button.style.background = '#4f46e5';
      });
      
      // Get annotation key from params
      const annotationKey = params?.annotation?.key || params?.annotation?.id;
      
      const self = this;
      button.addEventListener('click', async () => {
        log("ReaderIntegration: Sidebar button clicked");
        if (annotationKey) {
          await self.createNanopubFromAnnotation(reader, annotationKey);
        } else {
          error("ReaderIntegration: No annotation key found in params");
          Services.prompt.alert(null, 'Error', 'Could not find annotation. Please try right-clicking on the annotation instead.');
        }
      });
      
      container.appendChild(button);
      append(container);
      
      log("ReaderIntegration: Sidebar button added");
    } catch (err: any) {
      error("ReaderIntegration: Error in sidebar header handler:", err);
    }
  }

  /**
   * Create nanopublication from an annotation
   */
  private async createNanopubFromAnnotation(reader: any, annotationKey: string) {
    try {
      log(`ReaderIntegration: Creating nanopub from annotation key: ${annotationKey}`);

      let annotationItem: any = null;
      
      // First try as an ID (number)
      if (!isNaN(Number(annotationKey))) {
        annotationItem = await Zotero.Items.getAsync(Number(annotationKey));
        log(`ReaderIntegration: Tried as ID, found: ${!!annotationItem}`);
      }
      
      // If not found, try to find it via the reader's PDF item using the key
      if (!annotationItem && reader.itemID) {
        log(`ReaderIntegration: Trying via reader.itemID: ${reader.itemID}`);
        const pdfItem = await Zotero.Items.getAsync(reader.itemID);
        if (pdfItem) {
          const annotations = pdfItem.getAnnotations();
          log(`ReaderIntegration: PDF has ${annotations.length} annotations`);
          annotationItem = annotations.find((a: any) => a.key === annotationKey || a.id == annotationKey);
          log(`ReaderIntegration: Found via key match: ${!!annotationItem}`);
        }
      }

      // Try one more approach - get by key directly
      if (!annotationItem) {
        try {
          const libraryID = Zotero.Libraries.userLibraryID;
          annotationItem = await Zotero.Items.getByLibraryAndKeyAsync(libraryID, annotationKey);
          log(`ReaderIntegration: Tried getByLibraryAndKeyAsync, found: ${!!annotationItem}`);
        } catch (e) {
          log(`ReaderIntegration: getByLibraryAndKeyAsync failed: ${e}`);
        }
      }

      if (!annotationItem) {
        error("ReaderIntegration: Annotation not found for key: " + annotationKey);
        Services.prompt.alert(null, 'Error', 'Annotation not found. Please try again.');
        return;
      }

      // Get annotation data
      const annotationType = annotationItem.annotationType;
      const annotationText = annotationItem.annotationText || '';
      const annotationComment = annotationItem.annotationComment || '';
      const pageLabel = annotationItem.annotationPageLabel || '';

      log(`ReaderIntegration: Annotation type: ${annotationType}`);
      log(`ReaderIntegration: Annotation text length: ${annotationText.length}`);
      log(`ReaderIntegration: Annotation comment length: ${annotationComment.length}`);

      // Get the PDF item and parent item
      const pdfItem = annotationItem.parentItem;
      if (!pdfItem) {
        error("ReaderIntegration: PDF item not found");
        Services.prompt.alert(null, 'Error', 'PDF item not found');
        return;
      }

      const parentItem = pdfItem.parentItem;
      if (!parentItem) {
        error("ReaderIntegration: Parent item not found");
        Services.prompt.alert(null, 'Error', 'Parent item not found');
        return;
      }

      log(`ReaderIntegration: Parent item: ${parentItem.getField('title')}`);

      // Process the quote text
      const { quoteStart, quoteEnd } = this.processQuoteText(annotationText);

      // Prepare annotation data for the form
      const annotationData = {
        quoteText: quoteStart,
        quoteEnd: quoteEnd,
        comment: annotationComment,
        pageLabel: pageLabel
      };

      // Open the form with pre-filled data
      await TemplateFormDialog.showTemplateWorkflowWithAnnotation(
        parentItem,
        'https://w3id.org/np/RA24onqmqTMsraJ7ypYFOuckmNWpo4Zv5gsLqhXt7xYPU', // Annotate a paper quotation
        annotationData
      );

    } catch (err: any) {
      error("ReaderIntegration: Failed to create nanopub from annotation:", err);
      Services.prompt.alert(
        null,
        'Error',
        `Failed to create nanopublication:\n${err.message}`
      );
    }
  }

  /**
   * Process quote text - split if > 500 characters
   */
  private processQuoteText(text: string): { quoteStart: string; quoteEnd: string } {
    if (!text || text.length <= 500) {
      return { quoteStart: text, quoteEnd: '' };
    }

    const firstPart = text.substring(0, 500);
    const lastSentenceEnd = Math.max(
      firstPart.lastIndexOf('. '),
      firstPart.lastIndexOf('! '),
      firstPart.lastIndexOf('? ')
    );

    let quoteStart: string;
    let remainingText: string;

    if (lastSentenceEnd > 200) {
      quoteStart = text.substring(0, lastSentenceEnd + 1).trim();
      remainingText = text.substring(lastSentenceEnd + 1).trim();
    } else {
      quoteStart = firstPart.trim();
      remainingText = text.substring(500).trim();
    }

    const sentences = remainingText.split(/(?<=[.!?])\s+/);
    const quoteEnd = sentences.length > 0 ? sentences[sentences.length - 1].trim() : '';

    return { quoteStart, quoteEnd };
  }

  /**
   * Cleanup on shutdown
   */
  unregister() {
    try {
      if (this.registered) {
        log("ReaderIntegration: Unregistered (cleanup handled by Zotero)");
      }
      this.registered = false;
    } catch (err: any) {
      error("ReaderIntegration: Failed to unregister:", err);
    }
  }
}