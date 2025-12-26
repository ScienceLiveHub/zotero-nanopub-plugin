// src/modules/nanopubCreationDialog.ts
// Simple dialog for creating citations from selected items

export class NanopubCreationDialog {
  
  /**
   * Show dialog to create a citation nanopub from selected item
   */
  static async showCreateCitationDialog() {
    const creator = Zotero.Nanopub.creator;
    
    // Check profile
    if (!creator.hasProfile()) {
      const setup = await this.showProfileSetupDialog();
      if (!setup) {
        return; // User cancelled
      }
    }

    // Get selected item
    const pane = Zotero.getActiveZoteroPane();
    const items = pane.getSelectedItems();

    if (!items || items.length === 0) {
      Services.prompt.alert(
        null,
        'No Item Selected',
        'Please select an item to create a citation from.'
      );
      return;
    }

    const item = items[0];
    const doi = item.getField('DOI');
    const title = item.getField('title');

    if (!doi) {
      Services.prompt.alert(
        null,
        'No DOI',
        'The selected item must have a DOI to create a citation nanopub.'
      );
      return;
    }

    // Ask for cited DOI
    const citedDoiInput = { value: '10.1234/example' };
    const citedDoiResult = Services.prompt.prompt(
      null,
      'Create Citation',
      `Creating citation for:\n"${title}"\n\nEnter the DOI of the paper being cited:`,
      citedDoiInput,
      null,
      { value: false }
    );

    if (!citedDoiResult || !citedDoiInput.value) {
      return; // User cancelled
    }

    const citedDoi = citedDoiInput.value.trim();

    // Clean DOI (remove https://doi.org/ if present)
    const cleanCitedDoi = citedDoi.replace(/^https?:\/\/(dx\.)?doi\.org\//, '');

    try {
      // Show progress
      const progressWin = new Zotero.ProgressWindow();
      progressWin.changeHeadline('Creating Nanopublication');
      progressWin.addLines(['Signing and publishing...']);
      progressWin.show();

      // Create the citation
      const result = await creator.createCitationFromItem(item, cleanCitedDoi);

      progressWin.close();

      // Success!
      const viewUrl = `https://platform.sciencelive4all.org/np/?uri=${encodeURIComponent(result.uri)}`;
      
      const message = `Successfully created and published!\n\n` +
        `URI: ${result.uri}\n\n` +
        `View at Nanodash:\n${viewUrl}\n\n` +
        `Attach to this item?`;

      const attach = Services.prompt.confirm(
        null,
        'Success',
        message
      );

      if (attach) {
        await Zotero.Nanopub.displayModule.displayFromUri(item, result.uri);
        Services.prompt.alert(
          null,
          'Success',
          'Nanopublication attached to item!'
        );
      }

    } catch (e) {
      Services.prompt.alert(
        null,
        'Error',
        `Failed to create nanopublication:\n${e.message}`
      );
      console.error('Citation creation failed:', e);
    }
  }

  /**
   * Show profile setup dialog
   */
  static async showProfileSetupDialog(): Promise<boolean> {
    const prompts = Services.prompt;
    
    // Ask for name
    const nameInput = { value: '' };
    const nameResult = prompts.prompt(
      null,
      'Setup Nanopub Profile',
      'Enter your full name:',
      nameInput,
      null,
      { value: false }
    );

    if (!nameResult || !nameInput.value) {
      return false;
    }

    const name = nameInput.value.trim();

    // Ask for ORCID
    const orcidInput = { value: '0000-0002-' };
    const orcidResult = prompts.prompt(
      null,
      'Setup Nanopub Profile',
      'Enter your ORCID (e.g., 0000-0002-1234-5678):',
      orcidInput,
      null,
      { value: false }
    );

    if (!orcidResult || !orcidInput.value) {
      return false;
    }

    const orcid = orcidInput.value.trim();

    // Format ORCID
    const formattedOrcid = orcid.startsWith('https://orcid.org/') 
      ? orcid 
      : `https://orcid.org/${orcid}`;

    try {
      await Zotero.Nanopub.creator.setupProfile(name, formattedOrcid);
      
      Services.prompt.alert(
        null,
        'Profile Created',
        `Profile created successfully!\n\nName: ${name}\nORCID: ${formattedOrcid}`
      );

      return true;

    } catch (e) {
      Services.prompt.alert(
        null,
        'Error',
        `Failed to create profile:\n${e.message}`
      );
      return false;
    }
  }

  /**
   * Show profile info
   */
  static showProfileInfo() {
    const creator = Zotero.Nanopub.creator;

    if (!creator.hasProfile()) {
      Services.prompt.alert(
        null,
        'No Profile',
        'No nanopub profile has been set up yet.\n\n' +
        'Use "Setup Nanopub Profile" from the File menu to create one.'
      );
      return;
    }

    const profile = creator.getProfile();
    
    Services.prompt.alert(
      null,
      'Nanopub Profile',
      `Name: ${profile.name}\nORCID: ${profile.orcid}\n\n` +
      'Keys are stored securely in Zotero.'
    );
  }
}
