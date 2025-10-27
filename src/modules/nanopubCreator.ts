import { createZoteroStorage } from "../utils/zoteroStorage";

// Import the bundled NanopubCreator from the built library
// @ts-ignore - This is bundled by esbuild, TypeScript won't recognize it
import NanopubCreator from '@sciencelivehub/nanopub-create';

export class ZoteroNanopubCreator {
  private creator: any;

  constructor() {
    try {
      // Initialize with Zotero storage injected
      this.creator = new NanopubCreator({
        publishServer: 'https://np.knowledgepixels.com/',
        storage: createZoteroStorage()
      });
      
      console.log('✅ ZoteroNanopubCreator initialized with Zotero storage');
    } catch (e) {
      console.error('Failed to initialize NanopubCreator:', e);
      throw e;
    }
  }

  async init() {
    try {
      await this.creator.initWasm();
      console.log('✅ WASM initialized');
    } catch (e) {
      console.error('Failed to initialize WASM:', e);
      throw new Error('Could not initialize nanopub creation library');
    }
  }

  hasProfile(): boolean {
    return this.creator.hasProfile();
  }

  async setupProfile(name: string, orcid: string): Promise<void> {
    try {
      await this.creator.setupProfile(name, orcid);
      console.log('✅ Profile setup complete');
    } catch (e) {
      console.error('Profile setup failed:', e);
      throw e;
    }
  }

  getProfile() {
    return this.creator.getProfile();
  }

  async renderFromTemplateUri(templateUri: string, container: HTMLElement): Promise<void> {
    try {
      if (!this.hasProfile()) {
        throw new Error('Please set up your profile first');
      }

      await this.creator.renderFromTemplateUri(templateUri, container);
      console.log('✅ Template rendered');
    } catch (e) {
      console.error('Failed to render template:', e);
      throw e;
    }
  }

  async createFromTemplate(
    templateUri: string,
    values: Record<string, string>
  ): Promise<string> {
    try {
      if (!this.hasProfile()) {
        throw new Error('Please set up your profile first');
      }

      // For now, use the form-based approach
      console.log('Creating nanopub from template:', templateUri);
      console.log('Values:', values);
      
      // You would need to implement programmatic form filling
      // or use the renderFromTemplateUri + form submission approach
      throw new Error('Use renderFromTemplateUri for template-based creation');
      
    } catch (e) {
      console.error('Failed to create nanopub:', e);
      throw e;
    }
  }

  async publish(trigContent: string): Promise<{ uri: string; signedContent: string }> {
    try {
      if (!this.hasProfile()) {
        throw new Error('Please set up your profile first');
      }

      return await this.creator.publish(trigContent);
    } catch (e) {
      console.error('Failed to publish nanopub:', e);
      throw e;
    }
  }

  exportKeys(): string {
    return JSON.stringify(this.creator.exportKeys());
  }

  importKeys(keysJson: string): void {
    this.creator.importKeys(JSON.parse(keysJson));
  }

  // Event handling
  on(event: string, callback: (data: any) => void): void {
    this.creator.on(event, callback);
  }

  clearCredentials(): void {
    this.creator.clearCredentials();
  }
}
