// src/modules/nanopubCreator.ts
// Wrapper around @sciencelivehub/nanopub-create npm package
// ONLY uses methods that actually exist in the package

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

      console.log('🔏 Signing nanopub...');

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
   * Sign and publish a nanopub to the network
   * 
   * @param trigContent - Unsigned TriG content
   * @returns Object with URI and signed content
   */
  async signAndPublish(trigContent: string): Promise<{ uri: string; signedContent: string }> {
    try {
      // First sign it
      const signedContent = await this.sign(trigContent);

      console.log('📤 Publishing to network...');

      // Publish to the nanopub server
      const publishUrl = 'https://np.knowledgepixels.com/';
      
      const response = await fetch(publishUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/trig',
        },
        body: signedContent
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Publishing failed. Status:', response.status);
        console.error('Response:', errorText);
        throw new Error(`Publishing failed: ${response.status} ${response.statusText}`);
      }

      // Extract URI from response
      const responseText = await response.text();
      console.log('📨 Publish response:', responseText);
      
      // Try different patterns to extract the URI
      let uri = null;
      
      // Pattern 1: Standard w3id.org format
      let uriMatch = responseText.match(/https?:\/\/w3id\.org\/np\/[A-Za-z0-9_-]+/);
      if (uriMatch) {
        uri = uriMatch[0];
      }
      
      // Pattern 2: Look for any nanopub identifier
      if (!uri) {
        uriMatch = responseText.match(/https?:\/\/[^\/\s]+\/np\/[A-Za-z0-9_-]+/);
        if (uriMatch) {
          uri = uriMatch[0];
        }
      }
      
      // Pattern 3: Check if response is just the URI
      if (!uri && responseText.trim().startsWith('http')) {
        uri = responseText.trim();
      }
      
      // Pattern 4: Look in Location header
      if (!uri) {
        const location = response.headers.get('Location');
        if (location) {
          console.log('📍 Found URI in Location header:', location);
          uri = location;
        }
      }
      
      if (!uri) {
        console.error('❌ Could not extract URI from response');
        console.error('Response text:', responseText);
        console.error('Response headers:', Array.from(response.headers.entries()));
        throw new Error('Could not extract URI from publish response. Server response: ' + responseText.substring(0, 200));
      }

      console.log('✅ Published successfully!');
      console.log('🌐 URI:', uri);
      
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
      console.log('📌 URI:', result.uri);

      return result;

    } catch (e) {
      console.error('Failed to create citation:', e);
      throw e;
    }
  }

  /**
   * Render form from template (for UI)
   * This is the ACTUAL method from the npm package
   */
  async renderFromTemplateUri(templateUri: string, container: HTMLElement): Promise<void> {
    if (!this.hasProfile()) {
      throw new Error('Please set up your profile first');
    }
    // This method EXISTS in the npm package
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
