// src/modules/nanopubCreator.ts 

import { createZoteroStorage } from "../utils/zoteroStorage";

// @ts-ignore
import NanopubCreator from '@sciencelivehub/nanopub-create';

export class ZoteroNanopubCreator {
  private creator: any;

  constructor() {
    try {
      this.creator = new NanopubCreator({
        publishServer: null,  // We handle publishing separately
        storage: createZoteroStorage()
      });
      
      console.log('✅ ZoteroNanopubCreator initialized');
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

  /**
   * Sign a nanopub using the internal creator.publish() method
   * This works because publishServer is null, so it only signs
   * 
   * @param trigContent - Unsigned TriG content
   * @returns Signed TriG content with URI embedded
   */
  async sign(trigContent: string): Promise<string> {
    try {
      if (!this.hasProfile()) {
        throw new Error('Please set up your profile first');
      }

      await this.creator.ensureWasm();

      console.log('🔐 Signing nanopub...');

      // Use internal publish() - it signs but doesn't publish (publishServer is null)
      const result = await this.creator.publish(trigContent);

      if (!result.signedContent) {
        throw new Error('No signed content returned');
      }

      console.log('✅ Signed successfully');
      console.log('📄 Length:', result.signedContent.length);

      return result.signedContent;

    } catch (e) {
      console.error('Failed to sign:', e);
      throw new Error(`Signing failed: ${e.message}`);
    }
  }

  /**
   * Extract the nanopub URI from signed content
   * The URI is in the PREFIX this: <URI> line
   */
  extractUri(signedContent: string): string {
    const uriMatch = signedContent.match(/PREFIX this: <(https:\/\/w3id\.org\/np\/[^>]+)>/);
    
    if (!uriMatch) {
      throw new Error('Could not extract URI from signed content');
    }

    return uriMatch[1];
  }

  /**
   * Publish signed content using Zotero's HTTP
   * 
   * @param signedContent - Signed TriG content
   * @returns Nanopub URI (extracted from content)
   */
  async publishViaZotero(signedContent: string): Promise<string> {
    try {
      // Extract URI first (we need this regardless of publish success)
      const uri = this.extractUri(signedContent);
      
      console.log('📤 Publishing to network...');
      console.log('📍 URI:', uri);
      
      // Try to publish
      const response = await Zotero.HTTP.request(
        'POST',
        'https://np.knowledgepixels.com/',
        {
          body: signedContent,
          headers: {
            'Content-Type': 'application/trig'
          },
          responseType: 'text'
        }
      );

      console.log('✅ Published! Status:', response.status);

      return uri;

    } catch (e) {
      // Even if publishing fails, we have the signed nanopub
      console.warn('⚠️ Publishing error:', e.message);
      
      // Try to extract URI anyway
      try {
        const uri = this.extractUri(signedContent);
        console.log('📍 Have URI from signed content:', uri);
        return uri;
      } catch (extractError) {
        throw new Error(`Publishing failed and could not extract URI: ${e.message}`);
      }
    }
  }

  /**
   * Sign and publish in one step
   * 
   * @param trigContent - Unsigned TriG content
   * @returns Object with URI and signed content
   */
  async signAndPublish(trigContent: string): Promise<{ uri: string; signedContent: string }> {
    try {
      console.log('🔐 Step 1: Signing...');
      const signedContent = await this.sign(trigContent);
      
      console.log('📤 Step 2: Publishing...');
      const uri = await this.publishViaZotero(signedContent);
      
      console.log('✅ Complete!');
      
      return { uri, signedContent };

    } catch (e) {
      console.error('Failed to sign and publish:', e);
      throw e;
    }
  }

  /**
   * Create a citation nanopub from a Zotero item
   * 
   * @param item - Zotero item
   * @param citedDoi - DOI of the cited paper
   * @returns Object with URI and signed content
   */
  async createCitationFromItem(
    item: Zotero.Item,
    citedDoi: string
  ): Promise<{ uri: string; signedContent: string }> {
    try {
      if (!this.hasProfile()) {
        throw new Error('Please set up your profile first');
      }

      const profile = this.getProfile();
      const orcidId = profile.orcid.split('/').pop();
      const randomId = Math.random().toString(36).substring(2, 15);
      
      // Get item metadata
      const doi = item.getField('DOI') as string;
      const title = item.getField('title') as string;

      if (!doi) {
        throw new Error('Item must have a DOI');
      }

      console.log('📝 Creating citation nanopub...');
      console.log('   From:', title);
      console.log('   Cites:', citedDoi);

      // Create TriG content
      const trigContent = `
@prefix this: <http://purl.org/nanopub/temp/${randomId}> .
@prefix sub: <http://purl.org/nanopub/temp/${randomId}/> .
@prefix np: <http://www.nanopub.org/nschema#> .
@prefix dct: <http://purl.org/dc/terms/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix orcid: <https://orcid.org/> .
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix cito: <http://purl.org/spar/cito/> .
@prefix npx: <http://purl.org/nanopub/x/> .

sub:Head {
  this: a np:Nanopublication ;
    np:hasAssertion sub:assertion ;
    np:hasProvenance sub:provenance ;
    np:hasPublicationInfo sub:pubinfo .
}

sub:assertion {
  <https://doi.org/${doi}> cito:cites <https://doi.org/${citedDoi}> .
}

sub:provenance {
  sub:assertion prov:wasAttributedTo orcid:${orcidId} .
}

sub:pubinfo {
  orcid:${orcidId} foaf:name "${profile.name}" .
  
  this: dct:created "${new Date().toISOString()}"^^xsd:dateTime ;
    dct:creator orcid:${orcidId} ;
    dct:license <https://creativecommons.org/licenses/by/4.0/> ;
    npx:hasNanopubType <http://purl.org/spar/cito/Citation> ;
    rdfs:label "Citation for: ${title}" .
}
`;

      // Sign and publish
      const result = await this.signAndPublish(trigContent);

      console.log('✅ Citation nanopub created!');
      console.log('📍 URI:', result.uri);

      return result;

    } catch (e) {
      console.error('Failed to create citation:', e);
      throw e;
    }
  }

  /**
   * Template support - load template and create nanopub
   */
  async createFromTemplate(
    templateUri: string,
    values: Record<string, string>
  ): Promise<string> {
    try {
      if (!this.hasProfile()) {
        throw new Error('Please set up your profile first');
      }

      console.log('📝 Creating from template:', templateUri);
      
      await this.creator.loadTemplate(templateUri);
      this.creator.formData = values;
      const trigContent = await this.creator.generateNanopub();
      
      console.log('✅ Generated from template');
      
      return trigContent;
      
    } catch (e) {
      console.error('Failed to create from template:', e);
      throw e;
    }
  }

  /**
   * Load template info
   */
  async loadTemplateInfo(templateUri: string): Promise<{
    label: string;
    description: string;
    placeholders: Array<{ id: string; label: string; required: boolean; type: string }>;
    types: string[];
  }> {
    try {
      await this.creator.loadTemplate(templateUri);
      const template = this.creator.template;
      
      const placeholders = (template.placeholders || []).map((p: any) => ({
        id: p.id,
        label: p.label || p.id,
        required: p.required !== false,
        type: p.type || 'unknown'
      }));
      
      return {
        label: template.label || 'Untitled',
        description: template.description || '',
        placeholders: placeholders,
        types: template.types || []
      };
    } catch (e) {
      console.error('Failed to load template:', e);
      throw e;
    }
  }

  /**
   * Create and publish from template
   */
  async createAndPublishFromTemplate(
    templateUri: string,
    values: Record<string, string>
  ): Promise<{ uri: string; signedContent: string }> {
    const trigContent = await this.createFromTemplate(templateUri, values);
    return await this.signAndPublish(trigContent);
  }

  /**
   * Render form from template (for UI)
   */
  async renderFromTemplateUri(templateUri: string, container: HTMLElement): Promise<void> {
    if (!this.hasProfile()) {
      throw new Error('Please set up your profile first');
    }
    await this.creator.renderFromTemplateUri(templateUri, container);
  }

  exportKeys(): string {
    return JSON.stringify(this.creator.exportKeys());
  }

  importKeys(keysJson: string): void {
    this.creator.importKeys(JSON.parse(keysJson));
  }

  on(event: string, callback: (data: any) => void): void {
    this.creator.on(event, callback);
  }

  clearCredentials(): void {
    this.creator.clearCredentials();
  }

  getFormData(): Record<string, any> {
    return this.creator.formData || {};
  }
}
