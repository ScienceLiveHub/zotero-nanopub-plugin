/**
 * Zotero-specific storage implementation
 * Injects into nanopub-create for profile/key storage
 */
export function createZoteroStorage() {
  return {
    getItem: (key: string): string | null => {
      try {
        const value = Zotero.Prefs.get(`extensions.nanopub.${key}`, true);
        return value || null;
      } catch (e) {
        console.error('Failed to get from Zotero prefs:', e);
        return null;
      }
    },
    
    setItem: (key: string, value: string): void => {
      try {
        Zotero.Prefs.set(`extensions.nanopub.${key}`, value, true);
      } catch (e) {
        console.error('Failed to set Zotero pref:', e);
        throw e;
      }
    },
    
    removeItem: (key: string): void => {
      try {
        Zotero.Prefs.clear(`extensions.nanopub.${key}`, true);
      } catch (e) {
        console.error('Failed to remove Zotero pref:', e);
        throw e;
      }
    }
  };
}
