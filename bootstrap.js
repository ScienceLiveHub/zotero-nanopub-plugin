// bootstrap.js - Nanopub Plugin with Template-Specific DOI Parameters and Search
function install(data, reason) {}

function startup(data, reason) {
  Services.console.logStringMessage("Nanopub: startup called");

  Zotero.NanopubPlugin = {
    // Template configuration with placeholder names for DOI parameters
    // Each template has specific placeholder names - these must match exactly what the template expects
    templates: [
      {
        id: "research_summary",
        name: "📝 Research Summary",
        template: "http://purl.org/np/RAVEpTdLrX5XrhNl_gnvTaBcjRRSDu_hhZix8gu2HO7jI",
        description: "Commenting on or evaluating a paper (using CiTO)",
        doiParameterName: "paper"  // to pass the DOI to the nanopublication
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
        doiParameterName: null  // No specific parameter for browsing
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
      
      // Remove existing menu items
      let existingCreateMenu = menu.querySelector("#zotero-nanopub-create-menu");
      if (existingCreateMenu) {
        existingCreateMenu.remove();
      }
      let existingSearchMenu = menu.querySelector("#zotero-nanopub-search-menu");
      if (existingSearchMenu) {
        existingSearchMenu.remove();
      }

      let pane = Zotero.getActiveZoteroPane();
      
      // Create main "Create Nanopublication" menu item with submenu
      let createMenu = pane.document.createElementNS(
        "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
        "menu"
      );
      createMenu.setAttribute("id", "zotero-nanopub-create-menu");
      createMenu.setAttribute("label", "Create Nanopublication");

      // Create submenu popup for templates
      let createSubmenu = pane.document.createElementNS(
        "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
        "menupopup"
      );
      createMenu.appendChild(createSubmenu);

      // Add template menu items
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

      // Create separate "Search Related Nanopublications" menu item
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

      // Add both menu items to the context menu
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

      // Build nanodash URL with proper template-specific DOI parameters
      let nanodashUrl;
      if (template.template === null) {
        // For "Browse All Templates", go to the main nanodash page
        nanodashUrl = this.nanodashUrl;
        // Add DOI as generic source if available
        if (doi) {
          nanodashUrl += `?source=${encodeURIComponent("https://doi.org/" + doi)}`;
        }
      } else {
        // For specific templates, include template parameter and template-specific DOI parameter
        nanodashUrl = `${this.nanodashUrl}?template=${encodeURIComponent(template.template)}&template-version=latest`;
        
        // Add DOI as template-specific parameter if both DOI and parameter name are available
        if (doi && template.doiParameterName) {
          nanodashUrl += `&param_${template.doiParameterName}=${encodeURIComponent("https://doi.org/" + doi)}`;
        }
      } 
      
      Services.console.logStringMessage("Nanopub: Opening nanodash URL: " + nanodashUrl);
      
      // Launch nanodash with the selected template and DOI parameter
      Zotero.launchURL(nanodashUrl);

      // Wait for user to create nanopub and get URL back
      setTimeout(async () => {
        let nanopubUrl = await Zotero.Utilities.Internal.prompt(
          "Nanopublication URL",
          `Paste the URL from Nanodash for "${template.name}":`,
          ""
        );
        
        if (nanopubUrl && nanopubUrl.startsWith("http")) {
          // Create note with template information and DOI details
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
          
          // Add tags for organization
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

    // NEW: Search functionality
    // NEW: Debug function to test search manually
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
      
      // Add debug option
      if (Services.prefs.getBoolPref("extensions.zotero.nanopub.debug", false)) {
        if (doi) {
          await this.debugSearchForDOI(doi);
        }
      }
      
      try {
        // Show progress
        let progressWindow = new Zotero.ProgressWindow();
        progressWindow.changeHeadline("Nanopub Search");
        progressWindow.addDescription("Searching for related nanopublications...");
        progressWindow.show();

        // Search for nanopubs
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

        // Show results and let user select which ones to attach
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
      
      // Primary search: DOI-based (most important)
      let doi = item.getField("DOI");
      if (doi) {
        Services.console.logStringMessage("Nanopub: searching for DOI: " + doi);
        let doiResults = await this.searchByDOI(doi);
        results.push(...doiResults);
        Services.console.logStringMessage("Nanopub: found " + doiResults.length + " nanopubs mentioning DOI");
      }
      
      // Secondary search: Title-based (if DOI search yielded few results)
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

    // NEW: DOI-specific search with multiple DOI formats
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

    // NEW: Create various DOI formats for comprehensive search
    createDOISearchTerms: function(doi) {
      let terms = [];
      
      // Clean the DOI (remove any existing URL prefixes)
      let cleanDoi = doi.replace(/^(https?:\/\/)?(dx\.)?doi\.org\//, '');
      
      // Add different DOI formats that might appear in nanopublications
      terms.push(`"${cleanDoi}"`);                                    // Exact DOI
      terms.push(`"https://doi.org/${cleanDoi}"`);                   // Full HTTPS URL
      terms.push(`"http://dx.doi.org/${cleanDoi}"`);                 // Old HTTP URL
      terms.push(`"doi:${cleanDoi}"`);                               // DOI with prefix
      terms.push(`"DOI:${cleanDoi}"`);                               // DOI with uppercase prefix
      terms.push(cleanDoi);                                          // DOI without quotes (broader search)
      
      Services.console.logStringMessage("Nanopub: created DOI search terms: " + terms.join(', '));
      return terms;
    },

    // NEW: Title-based search as fallback
    searchByTitle: async function(title) {
      let results = [];
      
      try {
        // Search for exact title
        let exactResults = await this.searchNanopubs(`"${title}"`);
        results.push(...exactResults);
        
        // If title is long, also search for first significant portion
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
      
      // Try multiple endpoints as the old one might not be working properly
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

    // Enhanced DOI search with more comprehensive patterns
    createDOISearchTerms: function(doi) {
      let terms = [];
      
      // Clean the DOI (remove any existing URL prefixes)
      let cleanDoi = doi.replace(/^(https?:\/\/)?(dx\.)?doi\.org\//, '');
      
      // Add different DOI formats that might appear in nanopublications
      // Most specific to least specific searches
      terms.push(`https://doi.org/${cleanDoi}`);           // Most common format in nanopubs
      terms.push(`http://dx.doi.org/${cleanDoi}`);         // Legacy format
      terms.push(`doi:${cleanDoi}`);                       // DOI with prefix
      terms.push(`DOI:${cleanDoi}`);                       // DOI with uppercase prefix
      terms.push(cleanDoi);                                // Just the DOI number
      
      // Also try with quotes for exact matching
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
      
      // Handle different response formats
      if (data.results && data.results.bindings) {
        // Standard SPARQL results format
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
        // Array format
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
      
      // Filter out empty results
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

    // NEW: Improved selection dialog with better design and clickable links
    showNanopubSelectionDialog: async function(nanopubs) {
      let self = this; // Store reference to this for use in nested functions
      
      return new Promise((resolve) => {
        let pane = Zotero.getActiveZoteroPane();
        let window = pane.document.defaultView;
        
        // Create dialog window with better styling
        let dialog = window.document.createElementNS(
          "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
          "dialog"
        );
        dialog.setAttribute("title", "Select Nanopublications to Attach");
        dialog.setAttribute("style", "width: 800px; height: 600px; padding: 0;");
        dialog.setAttribute("buttons", "accept,cancel");
        dialog.setAttribute("buttonlabelaccept", "Attach Selected");
        dialog.setAttribute("buttonlabelcancel", "Cancel");
        
        // Create main content with better styling
        let vbox = window.document.createElementNS(
          "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
          "vbox"
        );
        vbox.setAttribute("flex", "1");
        vbox.setAttribute("style", "padding: 15px; background: #f9f9f9;");
        
        // Add header with better styling
        let headerHbox = window.document.createElementNS(
          "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
          "hbox"
        );
        headerHbox.setAttribute("style", "margin-bottom: 15px; padding: 10px; background: white; border-radius: 5px; border: 1px solid #ddd;");
        
        let title = window.document.createElementNS(
          "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
          "label"
        );
        title.setAttribute("value", `Found ${nanopubs.length} related nanopublications - Select the ones you want to attach:`);
        title.setAttribute("style", "font-weight: bold; font-size: 1.1em; color: #333;");
        headerHbox.appendChild(title);
        vbox.appendChild(headerHbox);
        
        // Add "Select All" section with better styling
        let selectAllHbox = window.document.createElementNS(
          "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
          "hbox"
        );
        selectAllHbox.setAttribute("style", "margin-bottom: 10px; padding: 8px; background: #e8f4f8; border-radius: 3px; border: 1px solid #b3d9ea;");
        
        let selectAllCheckbox = window.document.createElementNS(
          "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
          "checkbox"
        );
        selectAllCheckbox.setAttribute("label", "Select All");
        selectAllCheckbox.setAttribute("checked", "true");
        selectAllCheckbox.setAttribute("style", "font-weight: bold; color: #0066cc;");
        selectAllHbox.appendChild(selectAllCheckbox);
        vbox.appendChild(selectAllHbox);
        
        // Create scrollable list with better styling
        let scrollbox = window.document.createElementNS(
          "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
          "scrollbox"
        );
        scrollbox.setAttribute("flex", "1");
        scrollbox.setAttribute("style", "border: 1px solid #ccc; background: white; border-radius: 5px; padding: 5px;");
        scrollbox.setAttribute("orient", "vertical");
        
        // Add nanopublications to list with rich content
        let checkboxes = [];
        nanopubs.forEach((nanopub, index) => {
          let itemBox = self.createNanopubSelectionItem(window, nanopub, index);
          let checkbox = itemBox.querySelector('checkbox');
          if (checkbox) {
            checkboxes.push(checkbox);
          }
          scrollbox.appendChild(itemBox);
        });
        
        // Select All functionality
        selectAllCheckbox.addEventListener("command", function() {
          let checked = selectAllCheckbox.getAttribute("checked") === "true";
          checkboxes.forEach(cb => {
            cb.setAttribute("checked", checked ? "true" : "false");
          });
        });
        
        vbox.appendChild(scrollbox);
        
        // Add info footer
        let footerHbox = window.document.createElementNS(
          "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
          "hbox"
        );
        footerHbox.setAttribute("style", "margin-top: 10px; padding: 8px; background: #fff3cd; border-radius: 3px; border: 1px solid #ffeaa7;");
        
        let footerLabel = window.document.createElementNS(
          "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
          "label"
        );
        footerLabel.setAttribute("value", "💡 Click on nanopub URIs to view them in your browser before selecting");
        footerLabel.setAttribute("style", "color: #856404; font-size: 0.9em;");
        footerHbox.appendChild(footerLabel);
        vbox.appendChild(footerHbox);
        
        dialog.appendChild(vbox);
        
        // Handle dialog result
        dialog.addEventListener("dialogaccept", function() {
          let selected = [];
          checkboxes.forEach((checkbox, index) => {
            if (checkbox.getAttribute("checked") === "true") {
              selected.push(nanopubs[index]);
            }
          });
          resolve(selected);
        });
        
        dialog.addEventListener("dialogcancel", function() {
          resolve([]);
        });
        
        // Show dialog
        window.document.documentElement.appendChild(dialog);
        dialog.focus();
        
        // Center the dialog
        dialog.centerWindowOnScreen();
      });
    },

    // Create individual nanopub selection item with rich content
    createNanopubSelectionItem: function(window, nanopub, index) {
      // Helper functions defined locally to avoid 'this' issues
      function cleanUriForDisplay(uri) {
        if (!uri) return '';
        
        if (uri.startsWith('http://') || uri.startsWith('https://')) {
          if (uri.includes('#')) {
            return uri.split('#').pop();
          }
          let pathParts = uri.split('/');
          let lastPart = pathParts[pathParts.length - 1];
          if (lastPart && lastPart.length > 0) {
            return lastPart;
          }
        }
        
        return uri;
      }
      
      function formatNanopubStatement(nanopub) {
        let statement = '';
        
        if (nanopub.subject && nanopub.predicate && nanopub.object) {
          let subject = cleanUriForDisplay(nanopub.subject);
          let predicate = cleanUriForDisplay(nanopub.predicate);
          let object = cleanUriForDisplay(nanopub.object);
          
          statement = `${subject} ${predicate} ${object}`;
          
          if (statement.length > 100) {
            statement = statement.substring(0, 100) + '...';
          }
        } else {
          statement = nanopub.uri.split('/').pop();
        }
        
        return statement;
      }
      
      function formatDate(dateString) {
        try {
          let date = new Date(dateString);
          return date.toLocaleDateString() + " " + date.toLocaleTimeString();
        } catch (e) {
          return dateString;
        }
      }
      
      function createDetailRow(window, label, value) {
        let hbox = window.document.createElementNS(
          "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
          "hbox"
        );
        hbox.setAttribute("style", "margin-bottom: 3px;");
        
        let labelElement = window.document.createElementNS(
          "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
          "label"
        );
        labelElement.setAttribute("value", label);
        labelElement.setAttribute("style", "font-weight: bold; color: #555; min-width: 80px; margin-right: 8px;");
        
        let valueElement = window.document.createElementNS(
          "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
          "label"
        );
        let cleanValue = cleanUriForDisplay(value);
        if (cleanValue.length > 100) {
          cleanValue = cleanValue.substring(0, 100) + "...";
        }
        valueElement.setAttribute("value", cleanValue);
        valueElement.setAttribute("style", "color: #333; flex: 1; word-wrap: break-word;");
        
        hbox.appendChild(labelElement);
        hbox.appendChild(valueElement);
        
        return hbox;
      }
      
      // Main item creation
      let itemBox = window.document.createElementNS(
        "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
        "vbox"
      );
      itemBox.setAttribute("style", "margin: 5px 0; padding: 12px; border: 1px solid #e0e0e0; border-radius: 5px; background: #fafafa;");
      
      // Create header with checkbox and index
      let headerHbox = window.document.createElementNS(
        "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
        "hbox"
      );
      headerHbox.setAttribute("style", "margin-bottom: 8px;");
      
      let checkbox = window.document.createElementNS(
        "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
        "checkbox"
      );
      checkbox.setAttribute("checked", "true");
      checkbox.setAttribute("style", "margin-right: 8px;");
      
      let indexLabel = window.document.createElementNS(
        "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
        "label"
      );
      indexLabel.setAttribute("value", `#${index + 1}`);
      indexLabel.setAttribute("style", "font-weight: bold; color: #666; margin-right: 10px;");
      
      headerHbox.appendChild(checkbox);
      headerHbox.appendChild(indexLabel);
      
      // Add statement content
      let statement = formatNanopubStatement(nanopub);
      let statementLabel = window.document.createElementNS(
        "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
        "label"
      );
      statementLabel.setAttribute("value", statement);
      statementLabel.setAttribute("style", "font-weight: bold; color: #333; font-size: 1.05em;");
      headerHbox.appendChild(statementLabel);
      
      itemBox.appendChild(headerHbox);
      
      // Add URI as clickable link
      let uriHbox = window.document.createElementNS(
        "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
        "hbox"
      );
      uriHbox.setAttribute("style", "margin-bottom: 5px; align-items: center;");
      
      let uriLabelPrefix = window.document.createElementNS(
        "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
        "label"
      );
      uriLabelPrefix.setAttribute("value", "🔗 Nanopub URI: ");
      uriLabelPrefix.setAttribute("style", "color: #666; font-size: 0.9em;");
      
      let uriLink = window.document.createElementNS(
        "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
        "label"
      );
      uriLink.setAttribute("value", nanopub.uri);
      uriLink.setAttribute("style", "color: #0066cc; font-size: 0.9em; text-decoration: underline; cursor: pointer;");
      uriLink.setAttribute("class", "text-link");
      
      // Make URI clickable
      uriLink.addEventListener("click", function() {
        Zotero.launchURL(nanopub.uri);
      });
      
      uriHbox.appendChild(uriLabelPrefix);
      uriHbox.appendChild(uriLink);
      itemBox.appendChild(uriHbox);
      
      // Add detailed content in a nice format
      let detailsVbox = window.document.createElementNS(
        "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
        "vbox"
      );
      detailsVbox.setAttribute("style", "margin-top: 8px; padding: 8px; background: white; border-radius: 3px; border: 1px solid #e8e8e8;");
      
      // Subject
      if (nanopub.subject) {
        let subjectHbox = createDetailRow(window, "Subject:", nanopub.subject);
        detailsVbox.appendChild(subjectHbox);
      }
      
      // Predicate
      if (nanopub.predicate) {
        let predicateHbox = createDetailRow(window, "Predicate:", nanopub.predicate);
        detailsVbox.appendChild(predicateHbox);
      }
      
      // Object
      if (nanopub.object) {
        let objectHbox = createDetailRow(window, "Object:", nanopub.object);
        detailsVbox.appendChild(objectHbox);
      }
      
      // Date
      if (nanopub.date) {
        let dateHbox = createDetailRow(window, "Date:", formatDate(nanopub.date));
        detailsVbox.appendChild(dateHbox);
      }
      
      // Creator/Publisher
      if (nanopub.pubkey) {
        let creatorHbox = createDetailRow(window, "Creator:", nanopub.pubkey);
        detailsVbox.appendChild(creatorHbox);
      }
      
      itemBox.appendChild(detailsVbox);
      
      return itemBox;
    },

    // Helper to create detail rows
    createDetailRow: function(window, label, value) {
      let hbox = window.document.createElementNS(
        "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
        "hbox"
      );
      hbox.setAttribute("style", "margin-bottom: 3px;");
      
      let labelElement = window.document.createElementNS(
        "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
        "label"
      );
      labelElement.setAttribute("value", label);
      labelElement.setAttribute("style", "font-weight: bold; color: #555; min-width: 80px; margin-right: 8px;");
      
      let valueElement = window.document.createElementNS(
        "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
        "label"
      );
      let cleanValue = this.cleanUriForDisplay(value);
      // Truncate very long values
      if (cleanValue.length > 100) {
        cleanValue = cleanValue.substring(0, 100) + "...";
      }
      valueElement.setAttribute("value", cleanValue);
      valueElement.setAttribute("style", "color: #333; flex: 1; word-wrap: break-word;");
      
      hbox.appendChild(labelElement);
      hbox.appendChild(valueElement);
      
      return hbox;
    },

    // Helper to format dates nicely
    formatDate: function(dateString) {
      try {
        let date = new Date(dateString);
        return date.toLocaleDateString() + " " + date.toLocaleTimeString();
      } catch (e) {
        return dateString;
      }
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
          
          // Add tags for organization
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
