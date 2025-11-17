// src/modules/preferenceWindow.ts
export function registerPrefsWindow() {
  console.log('[Nanopub] Registering preferences window...');
  
  try {
    Zotero.PreferencePanes.register({
      pluginID: 'nanopub-plugin@sciencelivehub.com',
      src: 'chrome://nanopub/content/preferences.xhtml',
      label: 'Science Live',
      image: 'chrome://nanopub/content/icons/favicon.png',
    });
    console.log('[Nanopub] Preferences window registered successfully!');
  } catch (e) {
    console.error('[Nanopub] Failed to register preferences:', e);
  }
}

