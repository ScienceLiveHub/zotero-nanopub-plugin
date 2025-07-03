// bootstrap.js - EXACT ORIGINAL CODE with minimal dialog fix
function install(data, reason) {}

function startup(data, reason) {
  Services.console.logStringMessage("Nanopub: startup called");

  Zotero.NanopubPlugin = {
    templates: [
      {
        id: "research_summary",
        name: "📝 Research Summary",
        template: "http://purl.org/np/RAVEpTdLrX5XrhNl_gnvTaBcjRRSDu_hhZix8gu2HO7jI",
        description: "Commenting on or evaluating a paper (using CiTO)",
        doiParameterName: "paper"
      },
      {
        id: "aida_sentence", 
        name: "💡 AIDA Sentence",
        template: "https://w3id.org/np/RALmXhDw3rHcMveTgbv8VtWxijUHwnSqhCmtJFIPKWVaA",
        description: "Make a scientific claim using AIDA sentence structure",
        doiParameterName: "publication"  
      },
      {
        id: "citation_link",
        name: "📚 Citation Creation",
        template: "https://w3id.org/np/RAX_4tWTyjFpO6nz63s14ucuejd64t2mK3IBlkwZ7jjLo",
        description: "Create a citation from a paper",
        doiParameterName: "article"  
      },
      {
        id: "browse_templates",
        name: "⚙️  Browse All Templates...",
        template: null,
        description: "Browse and select from all available nanopublication templates",
        doiParameterName: null
      }
    ],

    nanodashUrl: "https://nanodash.knowledgepixels.com/publish",

    init: function() {
      Services.console.logStringMessage("Nanopub: init called");
      let pane = Zotero.getActiveZoteroPane();
      if (!pane) {
        Services.console.logStringMessage("Nanopub: no active pane found");
        return;
      }
      let tree = pane.document.getElementById("zotero-items-tree");
      if (!tree) {
        Services.console.logStringMessage("Nanopub: zotero-items-tree not found");
        return;
      }
      Services.console.logStringMessage("Nanopub: zotero-items-tree found");

      tree.addEventListener("contextmenu", function(event) {
        let window = Zotero.getMainWindow();
        let menu = event.target.closest("menupopup") || 
                   pane.document.querySelector("menupopup[open='true']") || 
                   window.document.querySelector("menupopup[open='true']");
        if (!menu) {
          Services.console.logStringMessage("Nanopub: no open context menu found");
          setTimeout(() => {
            let delayedMenu = pane.document.querySelector("menupopup[open='true']") || 
                             window.document.querySelector("menupopup[open='true']");
            if (delayedMenu) {
              Zotero.NanopubPlugin.addMenuItem(delayedMenu);
            } else {
              Services.console.logStringMessage("Nanopub: still no context menu after delay");
            }
          }, 50);
          return;
        }
        Zotero.NanopubPlugin.addMenuItem(menu);
      });
    },

    addMenuItem: function(menu) {
      Services.console.logStringMessage("Nanopub: context menu opened, ID: " + (menu.id || "no ID"));
      
      let existingCreateMenu = menu.querySelector("#zotero-nanopub-create-menu");
      if (existingCreateMenu) {
        existingCreateMenu.remove();
      }
      let existingSearchMenu = menu.querySelector("#zotero-nanopub-search-menu");
      if (existingSearchMenu) {
        existingSearchMenu.remove();
      }

      let pane = Zotero.getActiveZoteroPane();
      
      let createMenu = pane.document.createElementNS(
        "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
        "menu"
      );
      createMenu.setAttribute("id", "zotero-nanopub-create-menu");
      createMenu.setAttribute("label", "Create Nanopublication");

      let createSubmenu = pane.document.createElementNS(
        "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
        "menupopup"
      );
      createMenu.appendChild(createSubmenu);

      this.templates.forEach(template => {
        let templateItem = pane.document.createElementNS(
          "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
          "menuitem"
        );
        templateItem.setAttribute("label", template.name);
        templateItem.setAttribute("tooltiptext", template.description);
        templateItem.addEventListener("command", () => {
          this.createNanopub(template);
        });
        createSubmenu.appendChild(templateItem);
      });

      let searchMenuItem = pane.document.createElementNS(
        "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
        "menuitem"
      );
      searchMenuItem.setAttribute("id", "zotero-nanopub-search-menu");
      searchMenuItem.setAttribute("label", "🔍 Search Related Nanopublications");
      searchMenuItem.setAttribute("tooltiptext", "Find existing nanopublications related to this paper");
      searchMenuItem.addEventListener("command", () => {
        this.searchNanopubsForSelectedItem();
      });

      menu.appendChild(createMenu);
      menu.appendChild(searchMenuItem);
      
      Services.console.logStringMessage("Nanopub: added create menu with " + this.templates.length + " templates and separate search menu");
    },

    createNanopub: async function(template) {
      Services.console.logStringMessage("Nanopub: createNanopub called for template: " + template.name);
      
      let pane = Zotero.getActiveZoteroPane();
      let items = pane.getSelectedItems();
      if (!items.length || !items[0].isRegularItem()) {
        Zotero.getMainWindow().alert("Please select a valid item.");
        return;
      }
      
      let item = items[0];
      let doi = item.getField("DOI") || "";

      let nanodashUrl;
      if (template.template === null) {
        nanodashUrl = this.nanodashUrl;
        if (doi) {
          nanodashUrl += `?source=${encodeURIComponent("https://doi.org/" + doi)}`;
        }
      } else {
        nanodashUrl = `${this.nanodashUrl}?template=${encodeURIComponent(template.template)}&template-version=latest`;
        
        if (doi && template.doiParameterName) {
          nanodashUrl += `&param_${template.doiParameterName}=${encodeURIComponent("https://doi.org/" + doi)}`;
        }
      } 
      
      Services.console.logStringMessage("Nanopub: Opening nanodash URL: " + nanodashUrl);
      
      Zotero.launchURL(nanodashUrl);

      setTimeout(async () => {
        let nanopubUrl = await Zotero.Utilities.Internal.prompt(
          "Nanopublication URL",
          `Paste the URL from Nanodash for "${template.name}":`,
          ""
        );
        
        if (nanopubUrl && nanopubUrl.startsWith("http")) {
          let note = new Zotero.Item("note");
          let noteContent = `<h3>Nanopublication: ${template.name}</h3>`;
          noteContent += `<p><strong>Template:</strong> ${template.description}</p>`;
          if (doi) {
            noteContent += `<p><strong>Source DOI:</strong> <a href="https://doi.org/${doi}">${doi}</a></p>`;
          }
          noteContent += `<p><strong>Nanopub URL:</strong> <a href="${nanopubUrl}">${nanopubUrl}</a></p>`;
          noteContent += `<p><strong>Created:</strong> ${new Date().toLocaleString()}</p>`;
          
          note.setNote(noteContent);
          note.parentItemID = item.id;
          
          note.addTag(`nanopub:${template.id}`);
          note.addTag("nanopublication");
          if (doi) {
            note.addTag(`doi:${doi}`);
          }
          
          await note.saveTx();
          Services.console.logStringMessage("Nanopub: note saved with template info and DOI");
        }
      }, 2000);
    },

    debugSearchForDOI: async function(doi) {
      Services.console.logStringMessage("=== NANOPUB DEBUG SEARCH ===");
      Services.console.logStringMessage("DOI: " + doi);
      
      let searchTerms = this.createDOISearchTerms(doi);
      
      for (let term of searchTerms) {
        Services.console.logStringMessage("--- Testing term: " + term + " ---");
        let results = await this.searchNanopubs(term);
        Services.console.logStringMessage("Results count: " + results.length);
        if (results.length > 0) {
          Services.console.logStringMessage("First result: " + JSON.stringify(results[0]));
        }
      }
      
      Services.console.logStringMessage("=== END DEBUG SEARCH ===");
    },

    searchNanopubsForSelectedItem: async function() {
      Services.console.logStringMessage("Nanopub: searchNanopubsForSelectedItem called");
      
      let pane = Zotero.getActiveZoteroPane();
      let items = pane.getSelectedItems();
      if (!items.length || !items[0].isRegularItem()) {
        Zotero.getMainWindow().alert("Please select a valid item.");
        return;
      }

      let item = items[0];
      let doi = item.getField("DOI");
      
      if (Services.prefs.getBoolPref("extensions.zotero.nanopub.debug", false)) {
        if (doi) {
          await this.debugSearchForDOI(doi);
        }
      }
      
      try {
        let progressWindow = new Zotero.ProgressWindow();
        progressWindow.changeHeadline("Nanopub Search");
        progressWindow.addDescription("Searching for related nanopublications...");
        progressWindow.show();

        let nanopubs = await this.findNanopubsForItem(item);
        
        progressWindow.close();

        if (nanopubs.length === 0) {
          let message = 'No related nanopublications found for this item.';
          if (doi) {
            message += `\n\nSearched for DOI: ${doi}`;
            message += '\n\nTo enable debug mode, go to Zotero preferences and add this setting:';
            message += '\nextensions.zotero.nanopub.debug = true';
          }
          Zotero.getMainWindow().alert(message);
          return;
        }

        // ONLY CHANGE: Simple selection instead of complex XUL dialog
        let selectedNanopubs = await this.showNanopubSelectionDialog(nanopubs);
        
        if (selectedNanopubs.length > 0) {
          await this.attachNanopubsToItem(item, selectedNanopubs);
          Zotero.getMainWindow().alert(`Successfully attached ${selectedNanopubs.length} nanopublication(s) to this item.`);
        }

      } catch (error) {
        Services.console.logStringMessage('Nanopub search error: ' + error.message);
        Zotero.getMainWindow().alert(`Error searching for nanopubs: ${error.message}`);
      }
    },

    findNanopubsForItem: async function(item) {
      let results = [];
      
      let doi = item.getField("DOI");
      if (doi) {
        Services.console.logStringMessage("Nanopub: searching for DOI: " + doi);
        let doiResults = await this.searchByDOI(doi);
        results.push(...doiResults);
        Services.console.logStringMessage("Nanopub: found " + doiResults.length + " nanopubs mentioning DOI");
      }
      
      if (results.length < 3) {
        let title = item.getField("title");
        if (title) {
          Services.console.logStringMessage("Nanopub: searching for title: " + title);
          let titleResults = await this.searchByTitle(title);
          results.push(...titleResults);
          Services.console.logStringMessage("Nanopub: found " + titleResults.length + " nanopubs mentioning title");
        }
      }
      
      return this.removeDuplicates(results);
    },

    searchByDOI: async function(doi) {
      let doiSearchTerms = this.createDOISearchTerms(doi);
      let results = [];
      
      for (let term of doiSearchTerms) {
        try {
          let nanopubs = await this.searchNanopubs(term);
          results.push(...nanopubs);
          Services.console.logStringMessage("Nanopub: DOI search term '" + term + "' found " + nanopubs.length + " results");
        } catch (error) {
          Services.console.logStringMessage('Error searching for DOI term "' + term + '": ' + error.message);
        }
      }
      
      return results;
    },

    createDOISearchTerms: function(doi) {
      let terms = [];
      let cleanDoi = doi.replace(/^(https?:\/\/)?(dx\.)?doi\.org\//, '');
      
      terms.push(`"${cleanDoi}"`);
      terms.push(`"https://doi.org/${cleanDoi}"`);
      terms.push(`"http://dx.doi.org/${cleanDoi}"`);
      terms.push(`"doi:${cleanDoi}"`);
      terms.push(`"DOI:${cleanDoi}"`);
      terms.push(cleanDoi);
      
      Services.console.logStringMessage("Nanopub: created DOI search terms: " + terms.join(', '));
      return terms;
    },

    searchByTitle: async function(title) {
      let results = [];
      
      try {
        let exactResults = await this.searchNanopubs(`"${title}"`);
        results.push(...exactResults);
        
        if (title.length > 50) {
          let shortTitle = title.substring(0, 50).trim();
          let shortResults = await this.searchNanopubs(`"${shortTitle}"`);
          results.push(...shortResults);
        }
        
      } catch (error) {
        Services.console.logStringMessage('Error in title search: ' + error.message);
      }
      
      return results;
    },

    searchNanopubs: async function(searchTerm) {
      let encodedTerm = encodeURIComponent(searchTerm);
      
      let endpoints = [
        `http://grlc.nanopubs.lod.labs.vu.nl/api/local/local/find_nanopubs_with_text?text=${encodedTerm}`,
        `http://grlc.nanopubs.lod.labs.vu.nl/api/local/local/find_nanopubs_with_text?text=${encodedTerm}&graphpred=ALL`,
        `http://grlc.nanopubs.lod.labs.vu.nl/api/local/local/find_nanopubs_with_pattern?subj=&pred=&obj=${encodedTerm}`,
      ];
      
      Services.console.logStringMessage("Nanopub: searching with term: " + searchTerm);
      
      for (let url of endpoints) {
        try {
          Services.console.logStringMessage("Nanopub: trying endpoint: " + url);
          
          let response = await fetch(url, {
            method: 'GET',
            headers: { 
              'Accept': 'application/json',
              'User-Agent': 'Zotero-Nanopub-Plugin/1.0'
            }
          });
          
          if (!response.ok) {
            Services.console.logStringMessage(`Nanopub: endpoint failed with status ${response.status}: ${url}`);
            continue;
          }
          
          let data = await response.json();
          let results = this.processNanopubResults(data);
          
          if (results.length > 0) {
            Services.console.logStringMessage(`Nanopub: found ${results.length} results with endpoint: ${url}`);
            return results;
          }
          
        } catch (error) {
          Services.console.logStringMessage(`Nanopub: error with endpoint ${url}: ${error.message}`);
          continue;
        }
      }
      
      Services.console.logStringMessage("Nanopub: no results found with any endpoint for term: " + searchTerm);
      return [];
    },

    createDOISearchTerms: function(doi) {
      let terms = [];
      let cleanDoi = doi.replace(/^(https?:\/\/)?(dx\.)?doi\.org\//, '');
      
      terms.push(`https://doi.org/${cleanDoi}`);
      terms.push(`http://dx.doi.org/${cleanDoi}`);
      terms.push(`doi:${cleanDoi}`);
      terms.push(`DOI:${cleanDoi}`);
      terms.push(cleanDoi);
      terms.push(`"https://doi.org/${cleanDoi}"`);
      terms.push(`"${cleanDoi}"`);
      
      Services.console.logStringMessage("Nanopub: created DOI search terms: " + terms.join(', '));
      return terms;
    },

    processNanopubResults: function(data) {
      Services.console.logStringMessage("Nanopub: processing results: " + JSON.stringify(data));
      
      if (!data) {
        Services.console.logStringMessage("Nanopub: no data received");
        return [];
      }
      
      let results = [];
      
      if (data.results && data.results.bindings) {
        results = data.results.bindings.map(binding => ({
          uri: binding.np?.value || binding.nanopub?.value || '',
          subject: binding.subj?.value || binding.s?.value || '',
          predicate: binding.pred?.value || binding.p?.value || '',
          object: binding.obj?.value || binding.o?.value || binding.v?.value || '',
          date: binding.date?.value || binding.created?.value || '',
          pubkey: binding.pubkey?.value || binding.creator?.value || '',
          graph: binding.graph?.value || binding.g?.value || ''
        }));
      } else if (Array.isArray(data)) {
        results = data.map(item => ({
          uri: item.np || item.nanopub || item.uri || '',
          subject: item.subj || item.s || '',
          predicate: item.pred || item.p || '',
          object: item.obj || item.o || item.v || '',
          date: item.date || item.created || '',
          pubkey: item.pubkey || item.creator || '',
          graph: item.graph || item.g || ''
        }));
      } else {
        Services.console.logStringMessage("Nanopub: unexpected data format: " + JSON.stringify(data));
        return [];
      }
      
      results = results.filter(nanopub => nanopub.uri);
      
      Services.console.logStringMessage("Nanopub: processed " + results.length + " valid results");
      return results;
    },

    removeDuplicates: function(nanopubs) {
      let seen = new Set();
      return nanopubs.filter(nanopub => {
        if (seen.has(nanopub.uri)) return false;
        seen.add(nanopub.uri);
        return true;
      });
    },

    // BACK TO WORKING CONFIRM DIALOGS (but improved)
    showNanopubSelectionDialog: async function(nanopubs) {
      Services.console.logStringMessage("Nanopub: showNanopubSelectionDialog called with " + nanopubs.length + " nanopubs");
      
      let selected = [];
      
      // First show overview
      let overviewMessage = `Found ${nanopubs.length} nanopublications related to your paper.\n\n`;
      overviewMessage += `I'll show you each one so you can choose which to attach.\n\n`;
      overviewMessage += `Click OK to start selecting, or Cancel to attach all.`;
      
      let startSelection = Zotero.getMainWindow().confirm(overviewMessage);
      
      if (!startSelection) {
        // User chose Cancel = attach all
        Services.console.logStringMessage("Nanopub: User chose to attach all nanopubs");
        return nanopubs;
      }
      
      // Show each nanopub for individual selection
      for (let i = 0; i < nanopubs.length; i++) {
        let nanopub = nanopubs[i];
        let shortUri = nanopub.uri.split('/').pop();
        
        let message = `Nanopublication ${i + 1} of ${nanopubs.length}\n\n`;
        message += `URI: ${shortUri}\n\n`;
        
        if (nanopub.subject && nanopub.predicate && nanopub.object) {
          let subject = this.cleanUriForDisplay(nanopub.subject);
          let predicate = this.cleanUriForDisplay(nanopub.predicate);
          let object = this.cleanUriForDisplay(nanopub.object);
          let statement = `${subject} ${predicate} ${object}`;
          if (statement.length > 100) {
            statement = statement.substring(0, 100) + '...';
          }
          message += `Statement: ${statement}\n\n`;
        }
        
        if (nanopub.date) {
          try {
            let date = new Date(nanopub.date).toLocaleDateString();
            message += `Date: ${date}\n\n`;
          } catch (e) {
            // ignore date formatting errors
          }
        }
        
        message += `Do you want to attach this nanopublication?\n\n`;
        message += `(OK = Yes, Cancel = No)`;
        
        let result = Zotero.getMainWindow().confirm(message);
        
        if (result) {
          selected.push(nanopub);
        }
      }
      
      // Show final summary
      let summaryMessage = `Selection complete!\n\n`;
      summaryMessage += `You selected ${selected.length} out of ${nanopubs.length} nanopublications.\n\n`;
      summaryMessage += selected.length > 0 ? `These will be attached as notes to your Zotero item.` : `No nanopublications will be attached.`;
      
      Zotero.getMainWindow().alert(summaryMessage);
      
      Services.console.logStringMessage("Nanopub: User selected " + selected.length + " out of " + nanopubs.length + " nanopubs");
      
      return selected;
    },

    // Helper function for cleaning URIs
    cleanUriForDisplay: function(uri) {
      if (!uri) return '';
      if (uri.startsWith('http://') || uri.startsWith('https://')) {
        if (uri.includes('#')) {
          return uri.split('#').pop();
        }
        const pathParts = uri.split('/');
        const lastPart = pathParts[pathParts.length - 1];
        if (lastPart && lastPart.length > 0) {
          return lastPart;
        }
      }
      return uri;
    },

    attachNanopubsToItem: async function(item, nanopubs) {
      for (let nanopub of nanopubs) {
        try {
          let noteContent = `<div>
            <h3>Related Nanopublication</h3>
            <p><strong>URI:</strong> <a href="${nanopub.uri}">${nanopub.uri}</a></p>
            <p><strong>Statement:</strong> ${nanopub.subject} ${nanopub.predicate} ${nanopub.object}</p>`;
          
          if (nanopub.date) {
            noteContent += `<p><strong>Date:</strong> ${nanopub.date}</p>`;
          }
          
          if (nanopub.pubkey) {
            noteContent += `<p><strong>Publisher:</strong> ${nanopub.pubkey}</p>`;
          }
          
          noteContent += `<p><strong>Found:</strong> ${new Date().toLocaleString()}</p>
          </div>`;
          
          let note = new Zotero.Item('note');
          note.setNote(noteContent);
          note.parentItemID = item.id;
          
          note.addTag('nanopub:found');
          note.addTag('nanopublication');
          
          await note.saveTx();
          
        } catch (error) {
          Services.console.logStringMessage('Error attaching nanopub: ' + error.message);
        }
      }
    },

    shutdown: function() {
      let pane = Zotero.getActiveZoteroPane();
      let createMenuItem = pane && pane.document.getElementById("zotero-nanopub-create-menu");
      if (createMenuItem) createMenuItem.remove();
      let searchMenuItem = pane && pane.document.getElementById("zotero-nanopub-search-menu");
      if (searchMenuItem) searchMenuItem.remove();
    }
  };

  Zotero.NanopubPlugin.init();
}

function shutdown(data, reason) {
  if (reason !== APP_SHUTDOWN) {
    Zotero.NanopubPlugin && Zotero.NanopubPlugin.shutdown && Zotero.NanopubPlugin.shutdown();
  }
}

function uninstall(data, reason) {}
