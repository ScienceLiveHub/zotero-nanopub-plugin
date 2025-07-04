// bootstrap.js - Enhanced version with ORCID support for nanopub creation
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
        doiParameterName: "paper",
        namespace: "cito",
        contentType: "Citation"
      },
      {
        id: "aida_sentence", 
        name: "💡 AIDA Sentence",
        template: "https://w3id.org/np/RALmXhDw3rHcMveTgbv8VtWxijUHwnSqhCmtJFIPKWVaA",
        description: "Make a scientific claim using AIDA sentence structure",
        doiParameterName: "publication",
        namespace: "aida",
        contentType: "AIDA Sentence"
      },
      {
        id: "citation_link",
        name: "📚 Citation Creation",
        template: "https://w3id.org/np/RAX_4tWTyjFpO6nz63s14ucuejd64t2mK3IBlkwZ7jjLo",
        description: "Create a citation from a paper",
        doiParameterName: "article",
        namespace: "cito",
        contentType: "Citation"
      },
      {
        id: "browse_templates",
        name: "⚙️  Browse All Templates...",
        template: null,
        description: "Browse and select from all available nanopublication templates",
        doiParameterName: null,
        namespace: null,
        contentType: "Content"
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
      
      Services.console.logStringMessage("Nanopub: added create menu with " + this.templates.length + " templates and search menu");
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

      setTimeout(() => {
        let nanopubUrl = prompt(`After creating your nanopublication on Nanodash, paste the URL here for "${template.name}":`);
        
        if (nanopubUrl && nanopubUrl.startsWith("http")) {
          this.saveNanopubNote(item, template, nanopubUrl, doi);
        }
      }, 3000);
    },

    saveNanopubNote: async function(item, template, nanopubUrl, doi) {
      try {
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
        
        Zotero.getMainWindow().alert("Nanopublication note saved successfully!");
      } catch (error) {
        Services.console.logStringMessage("Nanopub: Error saving note: " + error.message);
        Zotero.getMainWindow().alert("Error saving nanopublication note: " + error.message);
      }
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
      let title = item.getField("title");
      
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
          }
          if (title) {
            message += `\nSearched for title: ${title}`;
          }
          message += '\n\nThis is a basic search implementation. The nanopub search infrastructure is still being developed.';
          Zotero.getMainWindow().alert(message);
          return;
        }

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
        let doiResults = await this.basicSearchForTerm(doi);
        results.push(...doiResults);
        Services.console.logStringMessage("Nanopub: found " + doiResults.length + " nanopubs mentioning DOI");
      }
      
      if (results.length < 3) {
        let title = item.getField("title");
        if (title) {
          Services.console.logStringMessage("Nanopub: searching for title: " + title);
          let titleResults = await this.basicSearchForTerm(title);
          results.push(...titleResults);
          Services.console.logStringMessage("Nanopub: found " + titleResults.length + " nanopubs mentioning title");
        }
      }
      
      return this.removeDuplicates(results);
    },

    basicSearchForTerm: async function(searchTerm) {
      let results = [];
      
      let cleanTerm = searchTerm;
      if (searchTerm.includes("doi.org")) {
        cleanTerm = searchTerm.replace(/^(https?:\/\/)?(dx\.)?doi\.org\//, '');
      }
      
      let endpoints = [
        "https://query.knowledgepixels.com/repo/full",
        "https://query.knowledgepixels.com/repo/text", 
        "https://query.knowledgepixels.com/repo/last30d"
      ];
      
      let sparqlQuery = `
        PREFIX np: <http://www.nanopub.org/nschema#>
        PREFIX npa: <http://purl.org/nanopub/admin/>
        PREFIX prov: <http://www.w3.org/ns/prov#>
        PREFIX dcterms: <http://purl.org/dc/terms/>
        PREFIX foaf: <http://xmlns.com/foaf/0.1/>
        
        SELECT DISTINCT ?np ?date ?pubkey ?assertion ?provenance ?orcid ?authorName
        WHERE {
          ?np a np:Nanopublication ;
              np:hasAssertion ?assertion ;
              np:hasProvenance ?provenance .
          
          GRAPH ?assertion {
            ?s ?p ?o .
            FILTER (
              CONTAINS(LCASE(STR(?s)), LCASE("${cleanTerm}")) ||
              CONTAINS(LCASE(STR(?p)), LCASE("${cleanTerm}")) ||
              CONTAINS(LCASE(STR(?o)), LCASE("${cleanTerm}"))
            )
          }
          
          OPTIONAL {
            GRAPH ?provenance {
              ?np dcterms:created ?date .
              ?np dcterms:creator ?creator .
              ?creator foaf:name ?authorName .
              FILTER(CONTAINS(STR(?creator), "orcid.org"))
              BIND(STRAFTER(STR(?creator), "orcid.org/") AS ?orcid)
            }
          }
          
          OPTIONAL {
            GRAPH npa:graph {
              ?np npa:hasValidSignatureForPublicKey ?pubkey .
            }
          }
        }
        ORDER BY DESC(?date)
        LIMIT 20
      `;
      
      for (let endpoint of endpoints) {
        try {
          Services.console.logStringMessage(`Nanopub: trying SPARQL endpoint: ${endpoint}`);
          
          let response = await fetch(endpoint, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': 'application/sparql-results+json'
            },
            body: 'query=' + encodeURIComponent(sparqlQuery)
          });
          
          if (!response.ok) {
            Services.console.logStringMessage(`Nanopub: SPARQL endpoint failed with status ${response.status}: ${endpoint}`);
            continue;
          }
          
          let data = await response.json();
          let searchResults = this.processSearchResults(data);
          
          if (searchResults.length > 0) {
            Services.console.logStringMessage(`Nanopub: found ${searchResults.length} results with endpoint: ${endpoint}`);
            results.push(...searchResults);
            break;
          }
          
        } catch (error) {
          Services.console.logStringMessage(`Nanopub: error with endpoint ${endpoint}: ${error.message}`);
          continue;
        }
      }
      
      if (results.length === 0) {
        Services.console.logStringMessage("Nanopub: trying fallback endpoints");
        let fallbackEndpoints = [
          `http://grlc.nanopubs.lod.labs.vu.nl/api/local/local/find_nanopubs_with_text?text=${encodeURIComponent(cleanTerm)}`,
          `http://grlc.nanopubs.lod.labs.vu.nl/api/local/local/find_nanopubs_with_pattern?subj=&pred=&obj=${encodeURIComponent(cleanTerm)}`
        ];
        
        for (let endpoint of fallbackEndpoints) {
          try {
            Services.console.logStringMessage(`Nanopub: trying fallback endpoint: ${endpoint}`);
            
            let response = await fetch(endpoint, {
              method: 'GET',
              headers: { 
                'Accept': 'application/json',
                'User-Agent': 'Zotero-Nanopub-Plugin/1.0'
              }
            });
            
            if (!response.ok) {
              Services.console.logStringMessage(`Nanopub: fallback endpoint failed with status ${response.status}: ${endpoint}`);
              continue;
            }
            
            let data = await response.json();
            let searchResults = this.processSearchResults(data);
            
            if (searchResults.length > 0) {
              Services.console.logStringMessage(`Nanopub: found ${searchResults.length} results with fallback endpoint: ${endpoint}`);
              results.push(...searchResults);
              break;
            }
            
          } catch (error) {
            Services.console.logStringMessage(`Nanopub: error with fallback endpoint ${endpoint}: ${error.message}`);
            continue;
          }
        }
      }
      
      return results;
    },

    processSearchResults: function(data) {
      Services.console.logStringMessage("Nanopub: processing search results");
      
      if (!data) {
        Services.console.logStringMessage("Nanopub: no data received");
        return [];
      }
      
      let results = [];
      
      if (data.results && data.results.bindings) {
        results = data.results.bindings.map(binding => ({
          uri: binding.np?.value || '',
          assertion: binding.assertion?.value || '',
          provenance: binding.provenance?.value || '',
          date: binding.date?.value || '',
          pubkey: binding.pubkey?.value || '',
          orcid: binding.orcid?.value || '',
          authorName: binding.authorName?.value || '',
          subject: binding.assertion?.value || '',
          predicate: 'np:hasAssertion',
          object: binding.np?.value || '',
          graph: binding.assertion?.value || ''
        }));
      } else if (Array.isArray(data)) {
        results = data.map(item => ({
          uri: item.np || item.nanopub || item.uri || '',
          subject: item.subj || item.s || '',
          predicate: item.pred || item.p || '',
          object: item.obj || item.o || item.v || '',
          date: item.date || item.created || '',
          pubkey: item.pubkey || item.creator || '',
          orcid: item.orcid || '',
          authorName: item.authorName || '',
          graph: item.graph || item.g || ''
        }));
      } else {
        Services.console.logStringMessage("Nanopub: unexpected data format");
        return [];
      }
      
      results = results.filter(nanopub => nanopub.uri);
      
      Services.console.logStringMessage("Nanopub: processed " + results.length + " valid results");
      return results;
    },

    removeDuplicates: function(nanopubs) {
      let seen = new Set();
      return nanopubs.filter(nanopub => {
        let key = nanopub.uri || nanopub.subject;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    },

    showNanopubSelectionDialog: async function(nanopubs) {
      Services.console.logStringMessage("Nanopub: showNanopubSelectionDialog called with " + nanopubs.length + " nanopubs");
      
      let selected = [];
      
      let overviewMessage = `Found ${nanopubs.length} nanopublications related to your paper.\n\n`;
      overviewMessage += `Click OK to attach all, or Cancel to select individually.`;
      
      let attachAll = Zotero.getMainWindow().confirm(overviewMessage);
      
      if (attachAll) {
        Services.console.logStringMessage("Nanopub: User chose to attach all nanopubs");
        return nanopubs;
      }
      
      for (let i = 0; i < nanopubs.length; i++) {
        let nanopub = nanopubs[i];
        let shortUri = nanopub.uri.split('/').pop();
        
        let message = `Nanopublication ${i + 1} of ${nanopubs.length}\n\n`;
        message += `URI: ${shortUri}\n\n`;
        
        if (nanopub.authorName) {
          message += `Author: ${nanopub.authorName}`;
          if (nanopub.orcid) {
            message += ` (ORCID: ${nanopub.orcid})`;
          }
          message += `\n\n`;
        } else if (nanopub.orcid) {
          message += `Author ORCID: ${nanopub.orcid}\n\n`;
        }
        
        if (nanopub.assertion) {
          message += `Assertion: ${this.cleanUriForDisplay(nanopub.assertion)}\n\n`;
        }
        
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
        
        message += `Attach this nanopublication?\n\n`;
        message += `(OK = Yes, Cancel = No)`;
        
        let result = Zotero.getMainWindow().confirm(message);
        
        if (result) {
          selected.push(nanopub);
        }
      }
      
      Services.console.logStringMessage("Nanopub: User selected " + selected.length + " out of " + nanopubs.length + " nanopubs");
      
      return selected;
    },

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

    fetchNanopubDetails: async function(nanopubUri) {
      try {
        Services.console.logStringMessage(`Nanopub: fetching ${nanopubUri}`);
        
        let response = await fetch(nanopubUri + '.trig', {
          headers: { 'Accept': 'application/trig' }
        });
        
        if (response.ok) {
          let content = await response.text();
          Services.console.logStringMessage(`Nanopub: got ${content.length} characters`);
          
          let allQuotes = content.match(/"[^"]*"/g) || [];
          Services.console.logStringMessage(`Nanopub: found ${allQuotes.length} quoted strings`);
          
          allQuotes.forEach((quote, idx) => {
            if (quote.length > 50) {
              Services.console.logStringMessage(`Quote ${idx}: ${quote}`);
            }
          });
          
          return this.parseNanopubContent(content, nanopubUri);
        }
        
        return null;
      } catch (error) {
        Services.console.logStringMessage(`Error: ${error.message}`);
        return null;
      }
    },

    parseNanopubContent: function(content, uri) {
      let details = {
        title: null,
        description: null,
        author: null,
        authorName: null,
        orcid: null,
        assertion: null,
        fullAssertion: null,
        type: null,
        contentItems: [],
        rawContent: content.substring(0, 1000)
      };
      
      try {
        Services.console.logStringMessage(`Nanopub: parsing content of length ${content.length}`);
        
        // Debug: Let's see what lines contain "Anne" or "orcid" 
        let debugLines = content.split('\n');
        debugLines.forEach((line, idx) => {
          if (line.toLowerCase().includes('anne') || line.toLowerCase().includes('orcid')) {
            Services.console.logStringMessage(`Debug line ${idx}: ${line}`);
          }
        });
        
        let contentUriMatches = content.match(/<http:\/\/purl\.org\/[^\/]+\/([^>]+)>/g);
        if (contentUriMatches) {
          Services.console.logStringMessage(`Nanopub: found ${contentUriMatches.length} content URIs`);
          contentUriMatches.forEach((match, idx) => {
            let uriParts = match.replace(/[<>]/g, '').split('/');
            let encodedContent = uriParts[uriParts.length - 1];
            
            try {
              let decodedContent = decodeURIComponent(encodedContent);
              decodedContent = decodedContent.replace(/\+/g, ' ');
              
              Services.console.logStringMessage(`Nanopub: decoded URI ${idx}: "${decodedContent.substring(0, 100)}${decodedContent.length > 100 ? '...' : ''}"`);
              
              if (decodedContent.length > 50 && 
                  /[a-zA-Z]/.test(decodedContent) && 
                  !decodedContent.match(/^[A-Z0-9\-_\.]+$/)) {
                
                let namespace = uriParts[3];
                let contentType = this.getContentTypeFromNamespace(namespace);
                
                details.contentItems.push({
                  type: contentType,
                  content: decodedContent,
                  subject: '',
                  predicate: 'uri:encoded'
                });
              }
            } catch (decodeError) {
              Services.console.logStringMessage(`Nanopub: failed to decode URI: ${decodeError.message}`);
            }
          });
        }
        
        let lines = content.split('\n');
        let assertionLines = [];
        let provenanceLines = [];
        let inAssertion = false;
        let inProvenance = false;
        
        for (let i = 0; i < lines.length; i++) {
          let line = lines[i].trim();
          
          if (line.includes('# assertion') || line.includes('#assertion')) {
            inAssertion = true;
            inProvenance = false;
            Services.console.logStringMessage("Nanopub: entering assertion section");
            continue;
          } else if (line.includes('# provenance') || line.includes('#provenance')) {
            inProvenance = true;
            inAssertion = false;
            Services.console.logStringMessage("Nanopub: entering provenance section");
            continue;
          } else if (line.includes('# pubinfo') || line.includes('#pubinfo')) {
            inAssertion = false;
            inProvenance = false;
            Services.console.logStringMessage("Nanopub: entering pubinfo section");
            continue;
          }
          
          if (inAssertion && line && !line.startsWith('#')) {
            assertionLines.push(line);
          } else if (inProvenance && line && !line.startsWith('#')) {
            provenanceLines.push(line);
          }
          
          if ((line.includes('rdfs:label') || line.includes('<http://www.w3.org/2000/01/rdf-schema#label>')) && !details.title) {
            let match = line.match(/"([^"]+)"/);
            if (match) {
              details.title = match[1];
              Services.console.logStringMessage(`Nanopub: found title: "${details.title}"`);
            }
          }
          
          if ((line.includes('rdfs:comment') || line.includes('dcterms:description')) && !details.description) {
            let match = line.match(/"([^"]+)"/);
            if (match) {
              details.description = match[1];
              Services.console.logStringMessage(`Nanopub: found description: "${details.description}"`);
            }
          }
          
          if (line.includes('dcterms:creator') || line.includes('pav:createdBy')) {
            let match = line.match(/<([^>]+)>/);
            if (match) {
              details.author = match[1];
              if (match[1].includes('orcid.org')) {
                details.orcid = match[1].split('/').pop();
                Services.console.logStringMessage(`Nanopub: found ORCID: ${details.orcid}`);
              }
            }
          }
          
          // Look for ORCID in any line containing orcid.org
          if (line.includes('orcid.org') && !details.orcid) {
            let orcidMatch = line.match(/orcid\.org\/([0-9\-X]+)/i);
            if (orcidMatch) {
              details.orcid = orcidMatch[1];
              Services.console.logStringMessage(`Nanopub: found ORCID in line: ${details.orcid}`);
            }
          }
          
          if (line.includes('foaf:name') || line.includes('schema:name')) {
            let match = line.match(/"([^"]+)"/);
            if (match) {
              details.authorName = match[1];
              Services.console.logStringMessage(`Nanopub: found author name: "${details.authorName}"`);
            }
          }
          
          if (line.includes('rdf:type') && !line.includes('np:Nanopublication')) {
            let match = line.match(/<([^>]+)>/);
            if (match && !details.type) {
              details.type = this.cleanUriForDisplay(match[1]);
            }
          }
        }
        
        Services.console.logStringMessage(`Nanopub: processing ${assertionLines.length} assertion lines`);
        
        if (assertionLines.length > 0 && details.contentItems.length === 0) {
          details.fullAssertion = this.extractFullAssertion(assertionLines);
          details.assertion = this.simplifyAssertion(assertionLines.join('\n'));
          let extractedItems = this.extractContentItems(assertionLines);
          details.contentItems.push(...extractedItems);
          
          Services.console.logStringMessage(`Nanopub: extracted ${extractedItems.length} content items from assertion`);
        }
        
        if (details.contentItems.length > 1) {
          let seen = new Set();
          details.contentItems = details.contentItems.filter(item => {
            let key = item.content.toLowerCase().trim();
            if (seen.has(key)) {
              Services.console.logStringMessage(`Nanopub: removing duplicate content: ${item.content.substring(0, 50)}...`);
              return false;
            }
            seen.add(key);
            return true;
          });
        }
        
        if (provenanceLines.length > 0) {
          let provenanceInfo = this.extractProvenanceInfo(provenanceLines);
          if (provenanceInfo.authorName && !details.authorName) details.authorName = provenanceInfo.authorName;
          if (provenanceInfo.orcid && !details.orcid) details.orcid = provenanceInfo.orcid;
        }
        
        // Also scan the entire content for any ORCID patterns if we still don't have one
        if (!details.orcid) {
          // Look for standard ORCID patterns like 0000-0002-1784-2920
          let orcidMatches = content.match(/\b\d{4}-\d{4}-\d{4}-\d{3}[0-9X]\b/g);
          if (orcidMatches && orcidMatches.length > 0) {
            details.orcid = orcidMatches[0];
            Services.console.logStringMessage(`Nanopub: found ORCID pattern in content: ${details.orcid}`);
          } else {
            // Also try to find orcid.org URLs
            let orcidUrlMatches = content.match(/orcid\.org\/([0-9\-X]+)/gi);
            if (orcidUrlMatches && orcidUrlMatches.length > 0) {
              let orcidMatch = orcidUrlMatches[0].match(/orcid\.org\/([0-9\-X]+)/i);
              if (orcidMatch) {
                details.orcid = orcidMatch[1];
                Services.console.logStringMessage(`Nanopub: found ORCID URL in content: ${details.orcid}`);
              }
            }
          }
        }
        
        Services.console.logStringMessage(`Nanopub: final parsed details - title: ${details.title}, authorName: ${details.authorName}, orcid: ${details.orcid}, contentItems: ${details.contentItems.length}`);
        
      } catch (error) {
        Services.console.logStringMessage(`Error parsing nanopub content: ${error.message}`);
      }
      
      return details;
    },

    getContentTypeFromNamespace: function(namespace) {
      // First check if we have this namespace in our known templates
      for (let template of this.templates) {
        if (template.namespace && template.namespace.toLowerCase() === namespace.toLowerCase()) {
          return template.contentType;
        }
      }
      
      // Fallback: clean up the namespace and capitalize
      if (namespace) {
        return namespace.charAt(0).toUpperCase() + namespace.slice(1).replace(/[-_]/g, ' ');
      }
      
      return 'Content';
    },

    extractProvenanceInfo: function(provenanceLines) {
      let info = { authorName: null, orcid: null, affiliation: null };
      
      for (let line of provenanceLines) {
        if (line.includes('foaf:name') || line.includes('schema:name')) {
          let match = line.match(/"([^"]+)"/);
          if (match) {
            info.authorName = match[1];
          }
        }
        
        // More comprehensive ORCID extraction
        if (line.includes('orcid.org')) {
          let match = line.match(/orcid\.org\/([0-9\-X]+)/i);
          if (match) {
            info.orcid = match[1];
            Services.console.logStringMessage(`Nanopub: extracted ORCID from provenance: ${info.orcid}`);
          }
        }
        
        // Look for standalone ORCID patterns (like 0000-0002-1784-2920)
        if (!info.orcid) {
          let orcidPattern = line.match(/\b(\d{4}-\d{4}-\d{4}-\d{3}[0-9X])\b/);
          if (orcidPattern) {
            info.orcid = orcidPattern[1];
            Services.console.logStringMessage(`Nanopub: extracted ORCID pattern from provenance: ${info.orcid}`);
          }
        }
        
        // Also check for ORCID in creator fields
        if ((line.includes('dcterms:creator') || line.includes('pav:createdBy')) && line.includes('orcid.org')) {
          let match = line.match(/orcid\.org\/([0-9\-X]+)/i);
          if (match) {
            info.orcid = match[1];
            Services.console.logStringMessage(`Nanopub: extracted ORCID from creator field: ${info.orcid}`);
          }
        }
        
        if (line.includes('schema:affiliation') || line.includes('foaf:Organization')) {
          let match = line.match(/"([^"]+)"/);
          if (match) {
            info.affiliation = match[1];
          }
        }
      }
      
      return info;
    },

    extractFullAssertion: function(assertionLines) {
      let fullContent = [];
      
      for (let line of assertionLines) {
        line = line.trim();
        if (!line || line.startsWith('#') || line.startsWith('@')) continue;
        
        let quotedMatch = line.match(/"([^"]+)"/);
        if (quotedMatch && quotedMatch[1].length > 10) {
          fullContent.push(quotedMatch[1]);
        }
      }
      
      return fullContent.length > 0 ? fullContent.join('\n\n') : null;
    },

    extractContentItems: function(assertionLines) {
      let contentItems = [];
      
      for (let line of assertionLines) {
        let matches = line.match(/"([^"]+)"/g);
        if (matches) {
          matches.forEach(match => {
            let content = match.replace(/"/g, '');
            if (content.length > 20) {
              contentItems.push({
                type: 'Content',
                content: content,
                subject: '',
                predicate: ''
              });
            }
          });
        }
      }
      
      return contentItems;
    },

    cleanPredicateForDisplay: function(predicate) {
      let clean = this.cleanUriForDisplay(predicate);
      
      let predicateMap = {
        'label': 'Title',
        'comment': 'Description', 
        'description': 'Description',
        'title': 'Title',
        'name': 'Name',
        'value': 'Content',
        'sentence': 'Sentence',
        'statement': 'Statement',
        'claim': 'Claim',
        'hypothesis': 'Hypothesis',
        'conclusion': 'Conclusion',
        'summary': 'Summary',
        'abstract': 'Abstract'
      };
      
      for (let [key, value] of Object.entries(predicateMap)) {
        if (clean.toLowerCase().includes(key)) {
          return value;
        }
      }
      
      return clean.charAt(0).toUpperCase() + clean.slice(1);
    },

    simplifyAssertion: function(assertionText) {
      let lines = assertionText.split('\n').filter(line => line.trim());
      let simplified = [];
      
      for (let line of lines) {
        line = line.trim();
        if (line && !line.startsWith('#') && !line.startsWith('@')) {
          let parts = line.split(/\s+/);
          if (parts.length >= 3) {
            let subject = this.cleanUriForDisplay(parts[0]);
            let predicate = this.cleanUriForDisplay(parts[1]);
            let object = parts.slice(2).join(' ').replace(/[;".]$/, '');
            
            if (object.startsWith('"') && object.endsWith('"')) {
              object = object.slice(1, -1);
            } else {
              object = this.cleanUriForDisplay(object);
            }
            
            simplified.push(`${subject} ${predicate} ${object}`);
          }
        }
      }
      
      return simplified.slice(0, 3).join('; ');
    },

    generateNoteFirstLine: function(details) {
      if (details && details.contentItems && details.contentItems.length > 0) {
        let longestItem = details.contentItems.reduce((longest, current) => 
          current.content.length > longest.content.length ? current : longest
        );
        
        let emoji = this.getEmojiForContentType(longestItem.type);
        return `${emoji} ${longestItem.content}`;
      }
      
      if (details && details.title && !details.title.includes('...')) {
        return `📄 ${details.title}`;
      }
      
      if (details && details.description) {
        return `📝 ${details.description}`;
      }
      
      if (details && details.fullAssertion) {
        let assertion = details.fullAssertion.split('\n')[0];
        return `⚡ ${assertion}`;
      }
      
      if (details && details.type) {
        return `🔬 ${details.type}`;
      }
      
      return `🔗 Nanopub`;
    },

    getEmojiForContentType: function(contentType) {
      let type = contentType.toLowerCase();
      
      if (type.includes('sentence') || type.includes('statement')) return '💡';
      if (type.includes('title')) return '📄';
      if (type.includes('description') || type.includes('summary')) return '📝';
      if (type.includes('claim') || type.includes('hypothesis')) return '🔬';
      if (type.includes('conclusion')) return '✅';
      if (type.includes('abstract')) return '📋';
      
      return '⚡';
    },

    generateRichNoteContent: function(nanopub, details) {
      let content = '<div style="font-family: sans-serif; line-height: 1.4;">';
      
      let noteTitle = this.generateNoteFirstLine(details);
      content += `<div style="margin: 0 0 16px 0; font-size: 16px; font-weight: bold;">${noteTitle}</div>`;
      
      if (details?.contentItems && details.contentItems.length > 0) {
        content += `<h4 style="margin: 12px 0 4px 0;">Content</h4>`;
        content += `<div style="margin: 0 0 12px 0; padding: 12px; border: 1px solid; border-radius: 4px;">`;
        
        let sortedItems = details.contentItems.sort((a, b) => {
          let priorityTypes = ['title', 'sentence', 'statement', 'description'];
          let aPriority = priorityTypes.findIndex(type => a.type.toLowerCase().includes(type));
          let bPriority = priorityTypes.findIndex(type => b.type.toLowerCase().includes(type));
          
          if (aPriority !== -1 && bPriority !== -1) {
            return aPriority - bPriority;
          } else if (aPriority !== -1) {
            return -1;
          } else if (bPriority !== -1) {
            return 1;
          }
          
          return b.content.length - a.content.length;
        });
        
        for (let item of sortedItems) {
          content += `<p style="margin: 0 0 8px 0;"><strong>${item.type}:</strong> ${item.content}</p>`;
        }
        
        content += `</div>`;
      } else if (details?.fullAssertion) {
        content += `<h4 style="margin: 12px 0 4px 0;">Content</h4>`;
        content += `<div style="margin: 0 0 12px 0; padding: 12px; border: 1px solid; border-radius: 4px;">`;
        content += `<p style="margin: 0;">${details.fullAssertion}</p>`;
        content += `</div>`;
      } else if (details?.title || details?.description) {
        content += `<h4 style="margin: 12px 0 4px 0;">Content</h4>`;
        content += `<div style="margin: 0 0 12px 0; padding: 12px; border: 1px solid; border-radius: 4px;">`;
        
        if (details.title) {
          content += `<p style="margin: 0 0 8px 0;"><strong>Title:</strong> ${details.title}</p>`;
        }
        
        if (details.description) {
          content += `<p style="margin: 0 0 8px 0;"><strong>Description:</strong> ${details.description}</p>`;
        }
        
        content += `</div>`;
      }
      
      content += `<h4 style="margin: 16px 0 4px 0;">Provenance</h4>`;
      content += `<div style="padding: 12px; border: 1px solid; border-radius: 6px; margin-bottom: 12px;">`;
      
      if (details?.authorName) {
        content += `<p style="margin: 0 0 6px 0;"><strong>Author:</strong> ${details.authorName}</p>`;
      }
      
      if (details?.orcid) {
        content += `<p style="margin: 0 0 6px 0;"><strong>ORCID:</strong> <a href="https://orcid.org/${details.orcid}" target="_blank">${details.orcid}</a></p>`;
      }
      
      if (details?.type) {
        content += `<p style="margin: 0 0 6px 0;"><strong>Type:</strong> ${details.type}</p>`;
      }
      
      if (nanopub.date) {
        try {
          let date = new Date(nanopub.date).toLocaleDateString();
          content += `<p style="margin: 0 0 6px 0;"><strong>Published:</strong> ${date}</p>`;
        } catch (e) {
          // ignore date formatting errors
        }
      }
      
      content += `<p style="margin: 0;"><strong>Found:</strong> ${new Date().toLocaleDateString()}</p>`;
      content += `</div>`;
      
      content += `<h4 style="margin: 16px 0 4px 0;">Links</h4>`;
      content += `<div style="padding: 12px; border: 1px solid; border-radius: 6px;">`;
      content += `<p style="margin: 0;"><strong>Nanopublication URI:</strong><br><a href="${nanopub.uri}" style="word-break: break-all;">${nanopub.uri}</a></p>`;
      content += `</div>`;
      
      content += `</div>`;
      
      return content;
    },

    attachNanopubsToItem: async function(item, nanopubs) {
      let progressWindow = new Zotero.ProgressWindow();
      progressWindow.changeHeadline("Processing Nanopublications");
      progressWindow.addDescription("Fetching detailed information...");
      progressWindow.show();
      
      for (let i = 0; i < nanopubs.length; i++) {
        let nanopub = nanopubs[i];
        
        try {
          progressWindow.addDescription(`Processing ${i + 1} of ${nanopubs.length}...`);
          
          let details = await this.fetchNanopubDetails(nanopub.uri);
          
          let noteContent = this.generateRichNoteContent(nanopub, details);
          
          let note = new Zotero.Item('note');
          note.setNote(noteContent);
          note.parentItemID = item.id;
          
          note.addTag('nanopub:related');
          note.addTag('nanopublication');
          
          if (details?.type) {
            note.addTag(`type:${details.type.toLowerCase()}`);
          }
          
          if (details?.authorName) {
            note.addTag(`author:${details.authorName.toLowerCase()}`);
          }
          
          if (details?.orcid) {
            note.addTag(`orcid:${details.orcid}`);
          }
          
          await note.saveTx();
          
          Services.console.logStringMessage(`Nanopub: created note for ${nanopub.uri}`);
          
        } catch (error) {
          Services.console.logStringMessage(`Error processing nanopub ${i + 1}: ${error.message}`);
          
          let noteContent = `<h3>Related Nanopublication (${i + 1})</h3>`;
          noteContent += `<p><strong>URI:</strong> <a href="${nanopub.uri}">${nanopub.uri}</a></p>`;
          noteContent += `<p><strong>Found:</strong> ${new Date().toLocaleString()}</p>`;
          
          let note = new Zotero.Item('note');
          note.setNote(noteContent);
          note.parentItemID = item.id;
          note.addTag('nanopub:related');
          note.addTag('nanopublication');
          await note.saveTx();
        }
      }
      
      progressWindow.close();
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
