// src/config/templates.ts
// Nanopub Template Configuration
// Add your templates here to make them available in the UI

/**
 * Template definition
 */
export interface NanopubTemplate {
  uri: string;           // Permanent nanopub URI
  name: string;          // Display name
  description: string;   // What this template is for
  category: string;      // Category for grouping
  icon: string;          // Emoji icon (optional)
  recommended?: boolean; // Show in main menu
  keywords?: string[];   // For search
}

/**
 * POPULAR TEMPLATES
 * These appear in the main template selector
 */
export const POPULAR_TEMPLATES: NanopubTemplate[] = [
  {
    uri: 'https://w3id.org/np/RAX_4tWTyjFpO6nz63s14ucuejd64t2mK3IBlkwZ7jjLo',
    name: 'Citation with CiTO',
    description: 'Declare citations between papers using Citation Typing Ontology',
    category: 'Citation',
    icon: '📚',
    recommended: true,
    keywords: ['citation', 'cito', 'reference', 'cite']
  },
  {
    uri: 'https://w3id.org/np/RA24onqmqTMsraJ7ypYFOuckmNWpo4Zv5gsLqhXt7xYPU',
    name: 'Annotate a paper quotation',
    description: 'Annotating a paper quotation with personal interpretation',
    category: 'Annotation',
    icon: '❝❞',
    recommended: true,
    keywords: ['comment', 'annotation', 'quote', 'interpretation']
  },
  {
    uri: 'https://w3id.org/np/RAVEpTdLrX5XrhNl_gnvTaBcjRRSDu_hhZix8gu2HO7jI',
    name: 'Comment on Paper',
    description: 'Add comments, quotes, or evaluations to papers',
    category: 'Annotation',
    icon: '💬',
    recommended: true,
    keywords: ['comment', 'annotation', 'quote', 'review']
  },
  {
    uri: 'https://w3id.org/np/RA4fmfVFULMP50FqDFX8fEMn66uDF07vXKFXh_L9aoQKE',
    name: 'AIDA Sentence',
    description: 'Make structured scientific claims following the AIDA model',
    category: 'Scientific',
    icon: '🔬',
    recommended: true,
    keywords: ['aida', 'claim', 'assertion', 'scientific']
  },
  {
    uri: 'https://w3id.org/np/RAsPVd3bNOPg5vxQGc1Tqn69v3dSY-ASrAhEFioutCXao',
    name: 'Document geographical coverage',
    description: 'Document the geographical area or region covered by a resercher paper, data, or study.',
    category: 'geographical coverage',
    icon: '📝',
    recommended: false,
    keywords: ['statement', 'general', 'rdf', 'triple']
  }
];

/**
 * ALL TEMPLATES
 * Add more templates here as you discover useful ones
 */
export const ALL_TEMPLATES: NanopubTemplate[] = [
  ...POPULAR_TEMPLATES,
  
  // Add more templates below:
  
  // Example structure:
  // {
  //   uri: 'https://w3id.org/np/RA...',
  //   name: 'Your Template Name',
  //   description: 'What it does',
  //   category: 'Category',
  //   icon: '🎯',
  //   recommended: false,
  //   keywords: ['keyword1', 'keyword2']
  // },
];

/**
 * TEMPLATE CATEGORIES
 * For organizing templates in the UI
 */
export const TEMPLATE_CATEGORIES = [
  'Citation',
  'Annotation',
  'Scientific',
  'Data',
  'Workflow',
  'General'
];

/**
 * TEMPLATE DISCOVERY RESOURCES
 * Where to find more templates
 */
export const TEMPLATE_RESOURCES = [
  {
    name: 'Nanodash Template Gallery',
    url: 'https://nanodash.knowledgepixels.com/publish',
    description: 'Browse and use templates on Nanodash'
  },
  {
    name: 'Knowledge Pixels Templates',
    url: 'https://knowledgepixels.com/templates/',
    description: 'Official template documentation'
  },
  {
    name: 'Template Index',
    url: 'https://w3id.org/np/o/ntemplate/',
    description: 'Searchable index of all nanopub templates'
  }
];

/**
 * HELPER FUNCTIONS
 */

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: string): NanopubTemplate[] {
  return ALL_TEMPLATES.filter(t => t.category === category);
}

/**
 * Get recommended templates
 */
export function getRecommendedTemplates(): NanopubTemplate[] {
  return ALL_TEMPLATES.filter(t => t.recommended);
}

/**
 * Search templates by keyword
 */
export function searchTemplates(query: string): NanopubTemplate[] {
  const lowerQuery = query.toLowerCase();
  
  return ALL_TEMPLATES.filter(t => 
    t.name.toLowerCase().includes(lowerQuery) ||
    t.description.toLowerCase().includes(lowerQuery) ||
    (t.keywords && t.keywords.some(k => k.toLowerCase().includes(lowerQuery)))
  );
}

/**
 * Get template by URI
 */
export function getTemplateByUri(uri: string): NanopubTemplate | undefined {
  return ALL_TEMPLATES.find(t => t.uri === uri);
}

/**
 * Validate template URI format
 */
export function isValidTemplateUri(uri: string): boolean {
  return uri.startsWith('https://w3id.org/np/') && uri.length > 30;
}

// ============================================
// HOW TO ADD A NEW TEMPLATE
// ============================================
//
// 1. Find the template on Nanodash:
//    https://nanodash.knowledgepixels.com/publish
//
// 2. Copy the template URI (looks like: https://w3id.org/np/RA...)
//
// 3. Add to ALL_TEMPLATES array above:
//    {
//      uri: 'https://w3id.org/np/RA...',
//      name: 'Template Name',
//      description: 'What the template does',
//      category: 'Pick from TEMPLATE_CATEGORIES',
//      icon: 'Pick an emoji',
//      recommended: true/false,  // Show in main selector?
//      keywords: ['searchable', 'terms']
//    }
//
// 4. Rebuild: npm run build
//
// 5. Template will appear in "From Template..." menu
//
// ============================================

// ============================================
// EXAMPLE: ADDING SPECIFIC TEMPLATES
// ============================================
//
// Here are some useful templates you can add:
//
// ROSETTA STONE STATEMENT (from your project):
// {
//   uri: 'https://w3id.org/np/RA95PFSIiN6-B5qh-a89s78Rmna22y2Yy7rGHEI9R6Vws',
//   name: 'Rosetta Stone Statement',
//   description: 'Create RDF statements with subject-predicate-object',
//   category: 'General',
//   icon: '🗿',
//   recommended: true,
//   keywords: ['statement', 'triple', 'rdf', 'rosetta']
// }
//
// More templates can be found at:
// https://nanodash.knowledgepixels.com/publish
//
// ============================================
