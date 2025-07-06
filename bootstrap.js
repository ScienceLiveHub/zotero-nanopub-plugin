// bootstrap.js - Complete corrected merged version
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
        textParameterName: "text",
        relationParameterName: "relation",
        citedEntityParameterName: "cited_entity",
        namespace: "cito",
        contentType: "Citation"
      },
      {
        id: "aida_sentence", 
        name: "💡 AIDA Sentence",
        template: "https://w3id.org/np/RALmXhDw3rHcMveTgbv8VtWxijUHwnSqhCmtJFIPKWVaA",
        description: "Make a scientific claim using AIDA sentence structure",
        doiParameterName: "publication",
        textParameterName: "sentence",
        relationParameterName: "cites_relation",
        citedEntityParameterName: "cited_work",
        namespace: "aida",
        contentType: "AIDA Sentence"
      },
      {
        id: "citation_link",
        name: "📚 Citation Creation",
        template: "https://w3id.org/np/RAX_4tWTyjFpO6nz63s14ucuejd64t2mK3IBlkwZ7jjLo",
        description: "Create a citation from a paper",
        doiParameterName: "article",
        textParameterName: "text",
        relationParameterName: "citation_type",
        citedEntityParameterName: "source_article",
        namespace: "cito",
        contentType: "Citation"
      },
      {
        id: "browse_templates",
        name: "⚙️  Browse All Templates...",
        template: null,
        description: "Browse and select from all available nanopublication templates",
        doiParameterName: null,
        textParameterName: null,
        relationParameterName: null,
        citedEntityParameterName: null,
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
        let nanopubUrl = Zotero.getMainWindow().prompt(`After creating your nanopublication on Nanodash, paste the URL here for "${template.name}":`);
        
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

  // Initialize the main plugin
  Zotero.NanopubPlugin.init();
  
  // INITIALIZE PDF HANDLER
  Services.console.logStringMessage("Nanopub: Initializing PDF handler");
  
  try {
    Zotero.NanopubPDFHandler = {
      init: function() {
        Services.console.logStringMessage("NanopubPDF: Starting PDF handler initialization");
        this.startPeriodicCheck();
      },
      
      startPeriodicCheck: function() {
        Services.console.logStringMessage("NanopubPDF: Starting periodic check for new readers");
        
        this.checkInterval = setInterval(() => {
          this.checkForNewReaders();
        }, 3000);
      },
      
      checkForNewReaders: function() {
        if (Zotero.Reader && Zotero.Reader._readers) {
          for (let reader of Zotero.Reader._readers) {
            if (!reader._nanopubInstrumented) {
              Services.console.logStringMessage("NanopubPDF: Found new uninstrumented reader");
              this.instrumentReader(reader);
            }
          }
        }
      },
      
      instrumentReader: function(reader) {
        Services.console.logStringMessage("NanopubPDF: Instrumenting reader");
        
        if (reader._nanopubInstrumented) {
          return;
        }
        
        reader._nanopubInstrumented = true;
        
        setTimeout(() => {
          this.setupReaderUI(reader);
        }, 2000);
      },
      
      setupReaderUI: function(reader) {
        Services.console.logStringMessage("NanopubPDF: Setting up reader UI");
        
        if (reader._iframeWindow) {
          try {
            this.addCreateButton(reader._iframeWindow, reader);
          } catch (error) {
            Services.console.logStringMessage("NanopubPDF: Error setting up UI: " + error.message);
          }
        }
      },
      
      addCreateButton: function(targetWindow, reader) {
        try {
          let createButton = targetWindow.document.createElement('button');
          createButton.innerHTML = '🔬 Create Nanopub';
          createButton.style.position = 'fixed';
          createButton.style.top = '10px';
          createButton.style.right = '10px';
          createButton.style.zIndex = '999999';
          createButton.style.backgroundColor = '#007bff';
          createButton.style.color = 'white';
          createButton.style.border = 'none';
          createButton.style.padding = '12px 16px';
          createButton.style.borderRadius = '6px';
          createButton.style.cursor = 'pointer';
          createButton.style.fontSize = '14px';
          createButton.style.fontWeight = 'bold';
          createButton.title = 'Create nanopublication from selected text';
          
          createButton.onclick = function() {
            Services.console.logStringMessage("NanopubPDF: Create button clicked");
            
            let windowsToCheck = [
              targetWindow,
              targetWindow.parent,
              targetWindow.top
            ];
            
            try {
              if (targetWindow.PDFViewerApplication) {
                windowsToCheck.push(targetWindow);
              }
              
              let pdfIframes = targetWindow.document.querySelectorAll('iframe');
              for (let iframe of pdfIframes) {
                if (iframe.contentWindow) {
                  windowsToCheck.push(iframe.contentWindow);
                }
              }
            } catch (error) {
              Services.console.logStringMessage("NanopubPDF: Error finding PDF.js windows: " + error.message);
            }
            
            let selectedText = '';
            
            for (let i = 0; i < windowsToCheck.length; i++) {
              let win = windowsToCheck[i];
              if (!win) continue;
              
              try {
                let selection = win.getSelection();
                if (selection && !selection.isCollapsed && selection.toString().trim().length > 0) {
                  selectedText = selection.toString().trim();
                  break;
                }
                
                if (win.document && win.document.getSelection) {
                  let docSelection = win.document.getSelection();
                  if (docSelection && !docSelection.isCollapsed && docSelection.toString().trim().length > 0) {
                    selectedText = docSelection.toString().trim();
                    break;
                  }
                }
              } catch (error) {
                continue;
              }
            }
            
            if (selectedText.length > 0) {
              Services.console.logStringMessage(`NanopubPDF: Found selected text: ${selectedText.substring(0, 50)}...`);
              Zotero.NanopubPDFHandler.createNanopubFromText(selectedText, reader);
            } else {
              let mainWindow = Zotero.getMainWindow();
              if (mainWindow) {
                mainWindow.alert("No text selected in PDF!\n\nPlease:\n1. Select/highlight some text in the PDF first\n2. Then click the 'Create Nanopub' button");
              }
            }
          };
          
          targetWindow.document.body.appendChild(createButton);
          Services.console.logStringMessage("NanopubPDF: Create button added successfully");
          
          targetWindow.addEventListener('mouseup', function() {
            setTimeout(() => {
              let selection = targetWindow.getSelection();
              if (selection && !selection.isCollapsed) {
                let selectedText = selection.toString().trim();
                if (selectedText.length > 0) {
                  createButton.style.backgroundColor = '#28a745';
                  createButton.innerHTML = '🔬 Create Nanopub ✓';
                  createButton.title = `Create nanopub from: "${selectedText.substring(0, 50)}${selectedText.length > 50 ? '...' : ''}"`;
                } else {
                  createButton.style.backgroundColor = '#007bff';
                  createButton.innerHTML = '🔬 Create Nanopub';
                  createButton.title = 'Create nanopublication from selected text';
                }
              }
            }, 100);
          }, true);
          
        } catch (error) {
          Services.console.logStringMessage("NanopubPDF: Could not add create button: " + error.message);
        }
      },
      
      createNanopubFromText: function(text, reader) {
        Services.console.logStringMessage("NanopubPDF: Creating nanopub from text: " + text.substring(0, 50));
        
        try {
          let currentItem = reader._item;
          if (!currentItem) {
            Zotero.getMainWindow().alert("Could not identify the current PDF item.");
            return;
          }
          
          // Get the parent item if this is an attachment
          let parentItem = currentItem;
          if (currentItem.isAttachment() && currentItem.parentItemID) {
            parentItem = Zotero.Items.get(currentItem.parentItemID);
            Services.console.logStringMessage("NanopubPDF: Found parent item for attachment");
          }
          
          let doi = parentItem.getField("DOI") || "";
          Services.console.logStringMessage(`NanopubPDF: Found DOI: "${doi}"`);
          
          // If no DOI found, try alternative fields
          if (!doi) {
            let url = parentItem.getField("url") || "";
            if (url.includes("doi.org")) {
              doi = url.replace(/^(https?:\/\/)?(dx\.)?doi\.org\//, '');
              Services.console.logStringMessage(`NanopubPDF: Extracted DOI from URL: "${doi}"`);
            }
          }
          
          // Use the CiTO template (research_summary) as default for PDF text
          let template = Zotero.NanopubPlugin.templates.find(t => t.id === "research_summary");
          
          if (!template) {
            // Fallback to any template with a textParameterName
            template = Zotero.NanopubPlugin.templates.find(t => t.textParameterName);
          }
          
          let nanodashUrl = Zotero.NanopubPlugin.nanodashUrl;
          
          if (template && template.template) {
            nanodashUrl += `?template=${encodeURIComponent(template.template)}&template-version=latest`;
            
            // Add DOI parameter if available
            if (doi && template.doiParameterName) {
              // Clean the DOI first - remove any existing https://doi.org/ prefix
              let cleanDoi = doi.replace(/^(https?:\/\/)?(dx\.)?doi\.org\//, '');
              nanodashUrl += `&param_${template.doiParameterName}=${encodeURIComponent("https://doi.org/" + cleanDoi)}`;
              Services.console.logStringMessage(`NanopubPDF: Adding DOI parameter: param_${template.doiParameterName}=https://doi.org/${cleanDoi}`);
            }
            
            // Add the selected text using the template's text parameter name
            if (template.textParameterName) {
              nanodashUrl += `&param_${template.textParameterName}=${encodeURIComponent(text)}`;
              Services.console.logStringMessage(`NanopubPDF: Adding text parameter: param_${template.textParameterName}=${text.substring(0, 50)}...`);
            }
            
            // Add the citation relationship - includesQuotationFrom
            // This indicates that the nanopub includes a quotation from the cited paper
            if (doi && template.relationParameterName && template.citedEntityParameterName) {
              let cleanDoi = doi.replace(/^(https?:\/\/)?(dx\.)?doi\.org\//, '');
              nanodashUrl += `&param_${template.relationParameterName}=${encodeURIComponent("http://purl.org/spar/cito/includesQuotationFrom")}`;
              nanodashUrl += `&param_${template.citedEntityParameterName}=${encodeURIComponent("https://doi.org/" + cleanDoi)}`;
              Services.console.logStringMessage(`NanopubPDF: Adding citation relation: ${template.relationParameterName}=includesQuotationFrom, ${template.citedEntityParameterName}=https://doi.org/${cleanDoi}`);
            }
            
          } else {
            // Fallback: basic nanodash URL
            if (doi) {
              nanodashUrl += `?source=${encodeURIComponent("https://doi.org/" + doi)}`;
            }
          }
          
          Services.console.logStringMessage("NanopubPDF: Opening nanodash URL: " + nanodashUrl);
          
          // Open Nanodash immediately with pre-filled data
          Zotero.launchURL(nanodashUrl);

          // Show immediate feedback and then auto-search for the created nanopub
          setTimeout(() => {
            let mainWindow = Zotero.getMainWindow();
            let message = `✅ Nanodash opened with selected text!\n\n`;
            message += `Template: ${template ? template.name : 'Default'}\n`;
            message += `Text: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"\n\n`;
            message += `After you create the nanopublication on Nanodash:\n`;
            message += `• Click OK to automatically search for it\n`;
            message += `• Or Cancel to search manually later`;
            
            let shouldSearch = mainWindow.confirm(message);
            
            if (shouldSearch) {
              // Wait a bit longer for the user to create the nanopub, then auto-search
              setTimeout(() => {
                Zotero.NanopubPDFHandler.autoSearchForCreatedNanopub(parentItem, text, template);
              }, 30000); // Wait 30 seconds for creation
            }
          }, 2000);
          
        } catch (error) {
          Services.console.logStringMessage("NanopubPDF: Error creating nanopub: " + error.message);
          let mainWindow = Zotero.getMainWindow();
          if (mainWindow) {
            mainWindow.alert("Error creating nanopublication: " + error.message);
          }
        }
      },
      
      autoSearchForCreatedNanopub: async function(item, selectedText, template) {
        try {
          Services.console.logStringMessage("NanopubPDF: Auto-searching for created nanopub");
          
          let progressWindow = new Zotero.ProgressWindow();
          progressWindow.changeHeadline("Searching for Created Nanopublication");
          progressWindow.addDescription("Looking for your newly created nanopub...");
          progressWindow.show();
          
          // Try multiple search strategies
          let searchResults = [];
          
          // Strategy 1: Search for the exact selected text
          Services.console.logStringMessage("NanopubPDF: Strategy 1 - Searching for exact text");
          let exactTextResults = await Zotero.NanopubPlugin.basicSearchForTerm(selectedText);
          searchResults.push(...exactTextResults);
          
          // Strategy 2: Search for a shorter version of the text (first 50 chars)
          if (searchResults.length === 0 && selectedText.length > 50) {
            Services.console.logStringMessage("NanopubPDF: Strategy 2 - Searching for truncated text");
            let shortText = selectedText.substring(0, 50).trim();
            let shortTextResults = await Zotero.NanopubPlugin.basicSearchForTerm(shortText);
            searchResults.push(...shortTextResults);
          }
          
          // Strategy 3: Search for key words from the selected text
          if (searchResults.length === 0) {
            Services.console.logStringMessage("NanopubPDF: Strategy 3 - Searching for key words");
            let words = selectedText.split(/\s+/).filter(word => 
              word.length > 4 && // Only words longer than 4 characters
              !/^(the|and|for|are|but|not|you|all|can|had|her|was|one|our|out|day|get|has|him|his|how|its|new|now|old|see|two|way|who|boy|did|may|she|use|your|each|make|most|over|such|take|than|them|well|were)$/i.test(word) // Filter common words
            );
            
            if (words.length > 0) {
              // Try searching for combinations of key words
              let keywordSearches = [
                words.slice(0, 3).join(' '), // First 3 key words
                words.slice(0, 2).join(' '), // First 2 key words
                words[0] // Just the first key word
              ];
              
              for (let searchTerm of keywordSearches) {
                if (searchTerm.length > 0) {
                  Services.console.logStringMessage(`NanopubPDF: Searching for keywords: ${searchTerm}`);
                  let keywordResults = await Zotero.NanopubPlugin.basicSearchForTerm(searchTerm);
                  searchResults.push(...keywordResults);
                  if (searchResults.length > 0) break;
                }
              }
            }
          }
          
          // Strategy 4: Search by DOI for very recent nanopubs (created in last 10 minutes)
          if (searchResults.length === 0) {
            Services.console.logStringMessage("NanopubPDF: Strategy 4 - Searching recent nanopubs by DOI");
            let doi = item.getField("DOI");
            if (doi) {
              let doiResults = await Zotero.NanopubPlugin.basicSearchForTerm(doi);
              // Filter to only very recent ones
              let recentDoiResults = doiResults.filter(nanopub => {
                if (nanopub.date) {
                  let nanopubDate = new Date(nanopub.date);
                  let tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
                  return nanopubDate > tenMinutesAgo;
                }
                return false;
              });
              searchResults.push(...recentDoiResults);
            }
          }
          
          // Remove duplicates
          searchResults = Zotero.NanopubPlugin.removeDuplicates(searchResults);
          
          Services.console.logStringMessage(`NanopubPDF: Total search results found: ${searchResults.length}`);
          
          if (searchResults.length === 0) {
            progressWindow.close();
            let mainWindow = Zotero.getMainWindow();
            let message = `No nanopublication found with the selected text yet.\n\n`;
            message += `This could mean:\n`;
            message += `• The nanopub is still being processed (can take 1-5 minutes)\n`;
            message += `• The text doesn't match exactly in the search index\n`;
            message += `• The nanopub hasn't been indexed yet\n\n`;
            message += `Selected text preview: "${selectedText.substring(0, 100)}${selectedText.length > 100 ? '...' : ''}"\n\n`;
            message += `Would you like to:\n`;
            message += `• Try again in a few minutes (Recommended)\n`;
            message += `• Add it manually by providing the URL`;
            
            let tryAgain = mainWindow.confirm(message);
            
            if (tryAgain) {
              // Try again after a longer delay
              setTimeout(() => {
                this.autoSearchForCreatedNanopub(item, selectedText, template);
              }, 120000); // Wait 2 minutes this time
            } else {
              // Fall back to manual URL entry
              this.promptForManualEntry(item, selectedText, template);
            }
            return;
          }
          
          progressWindow.close();
          
          // Filter results to find the most recent ones (likely the one just created)
          let recentResults = searchResults.filter(nanopub => {
            if (nanopub.date) {
              let nanopubDate = new Date(nanopub.date);
              let tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
              return nanopubDate > tenMinutesAgo;
            }
            return true; // Include if no date available
          });
          
          let candidateResults = recentResults.length > 0 ? recentResults : searchResults.slice(0, 5);
          
          Services.console.logStringMessage(`NanopubPDF: Found ${candidateResults.length} candidate nanopubs`);
          
          if (candidateResults.length === 1) {
            // Only one candidate - likely the one we want
            let nanopub = candidateResults[0];
            let mainWindow = Zotero.getMainWindow();
            let shortUri = nanopub.uri.split('/').pop();
            
            let message = `Found your nanopublication! 🎉\n\n`;
            message += `URI: ${shortUri}\n`;
            if (nanopub.authorName) {
              message += `Author: ${nanopub.authorName}\n`;
            }
            if (nanopub.orcid) {
              message += `ORCID: ${nanopub.orcid}\n`;
            }
            if (nanopub.date) {
              try {
                let date = new Date(nanopub.date).toLocaleString();
                message += `Created: ${date}\n`;
              } catch (e) {
                // ignore date formatting errors
              }
            }
            message += `\nAdd this nanopublication to your paper?`;
            
            let shouldAdd = mainWindow.confirm(message);
            
            if (shouldAdd) {
              await this.attachNanopubWithRichContent(item, nanopub, selectedText, template);
              mainWindow.alert("✅ Nanopublication added successfully with full metadata!");
            }
            
          } else if (candidateResults.length > 1) {
            // Multiple candidates - let user choose
            let mainWindow = Zotero.getMainWindow();
            let message = `Found ${candidateResults.length} possible nanopublications.\n\n`;
            message += `This might include your newly created nanopub and some existing ones.\n\n`;
            message += `Would you like to:\n`;
            message += `• Review and select the correct one (Recommended)\n`;
            message += `• Skip for now and add manually later`;
            
            let choice = mainWindow.confirm(message);
            
            if (choice) {
              // Use the existing selection dialog but with enhanced context
              let selectedNanopubs = await this.showPDFNanopubSelectionDialog(candidateResults, selectedText);
              
              if (selectedNanopubs.length > 0) {
                for (let nanopub of selectedNanopubs) {
                  await this.attachNanopubWithRichContent(item, nanopub, selectedText, template);
                }
                mainWindow.alert(`✅ Added ${selectedNanopubs.length} nanopublication(s) with full metadata!`);
              }
            }
          }
          
        } catch (error) {
          Services.console.logStringMessage("NanopubPDF: Error in auto-search: " + error.message);
          let mainWindow = Zotero.getMainWindow();
          mainWindow.alert("Error searching for nanopublication: " + error.message + "\n\nPlease try adding manually.");
        }
      },
      
      showPDFNanopubSelectionDialog: async function(nanopubs, selectedText) {
        Services.console.logStringMessage("NanopubPDF: showing selection dialog for PDF nanopubs");
        
        let selected = [];
        
        for (let i = 0; i < nanopubs.length; i++) {
          let nanopub = nanopubs[i];
          let shortUri = nanopub.uri.split('/').pop();
          
          let message = `Nanopublication ${i + 1} of ${nanopubs.length}\n\n`;
          message += `URI: ${shortUri}\n\n`;
          message += `Selected text: "${selectedText.substring(0, 100)}${selectedText.length > 100 ? '...' : ''}"\n\n`;
          
          if (nanopub.authorName) {
            message += `Author: ${nanopub.authorName}`;
            if (nanopub.orcid) {
              message += ` (ORCID: ${nanopub.orcid})`;
            }
            message += `\n\n`;
          } else if (nanopub.orcid) {
            message += `Author ORCID: ${nanopub.orcid}\n\n`;
          }
          
          if (nanopub.date) {
            try {
              let date = new Date(nanopub.date).toLocaleDateString();
              message += `Date: ${date}\n\n`;
            } catch (e) {
              // ignore date formatting errors
            }
          }
          
          message += `Is this your nanopublication?\n\n`;
          message += `(OK = Yes, Cancel = No)`;
          
          let result = Zotero.getMainWindow().confirm(message);
          
          if (result) {
            selected.push(nanopub);
          }
        }
        
        return selected;
      },
      
      attachNanopubWithRichContent: async function(item, nanopub, selectedText, template) {
        try {
          Services.console.logStringMessage("NanopubPDF: Attaching nanopub with rich content");
          
          // Fetch detailed nanopub content (same as search functionality)
          let details = await Zotero.NanopubPlugin.fetchNanopubDetails(nanopub.uri);
          
          // Generate rich note content using the main plugin's function
          let noteContent = this.generatePDFNanopubNote(nanopub, details, selectedText, template);
          
          let note = new Zotero.Item('note');
          note.setNote(noteContent);
          note.parentItemID = item.id;
          
          // Use consistent tagging with the main plugin
          note.addTag('nanopub:pdf-created');
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
          
          if (template) {
            note.addTag(`template:${template.id}`);
          }
          
          await note.saveTx();
          
          Services.console.logStringMessage(`NanopubPDF: Successfully attached nanopub: ${nanopub.uri}`);
          
        } catch (error) {
          Services.console.logStringMessage("NanopubPDF: Error attaching nanopub: " + error.message);
          throw error;
        }
      },
      
      generatePDFNanopubNote: function(nanopub, details, selectedText, template) {
        let content = '<div style="font-family: sans-serif; line-height: 1.4;">';
        
        // Title with emoji based on content type
        let noteTitle = details ? Zotero.NanopubPlugin.generateNoteFirstLine(details) : '🔬 Created Nanopublication';
        content += `<div style="margin: 0 0 16px 0; font-size: 16px; font-weight: bold;">${noteTitle}</div>`;
        
        // Selected text section (highlighted)
        content += `<h4 style="margin: 12px 0 4px 0;">Selected Text from PDF</h4>`;
        content += `<div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 16px 0; border-radius: 4px;">`;
        content += `<blockquote style="margin: 0; font-style: italic; color: #374151; white-space: pre-wrap;">"${selectedText}"</blockquote>`;
        content += `</div>`;
        
        // Content section (if available from parsing)
        if (details?.contentItems && details.contentItems.length > 0) {
          content += `<h4 style="margin: 12px 0 4px 0;">Nanopublication Content</h4>`;
          content += `<div style="margin: 0 0 12px 0; padding: 12px; border: 1px solid #ddd; border-radius: 4px;">`;
          
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
          content += `<h4 style="margin: 12px 0 4px 0;">Nanopublication Content</h4>`;
          content += `<div style="margin: 0 0 12px 0; padding: 12px; border: 1px solid #ddd; border-radius: 4px;">`;
          content += `<p style="margin: 0;">${details.fullAssertion}</p>`;
          content += `</div>`;
        }
        
        // Provenance section
        content += `<h4 style="margin: 16px 0 4px 0;">Provenance</h4>`;
        content += `<div style="padding: 12px; border: 1px solid #ddd; border-radius: 6px; margin-bottom: 12px;">`;
        
        if (template) {
          content += `<p style="margin: 0 0 6px 0;"><strong>Template:</strong> ${template.name}</p>`;
        }
        
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
        
        content += `<p style="margin: 0;"><strong>Created from PDF:</strong> ${new Date().toLocaleDateString()}</p>`;
        content += `</div>`;
        
        // Links section
        content += `<h4 style="margin: 16px 0 4px 0;">Links</h4>`;
        content += `<div style="padding: 12px; border: 1px solid #ddd; border-radius: 6px;">`;
        content += `<p style="margin: 0;"><strong>Nanopublication URI:</strong><br><a href="${nanopub.uri}" style="word-break: break-all;">${nanopub.uri}</a></p>`;
        content += `</div>`;
        
        content += `</div>`;
        
        return content;
      },
      
      promptForManualEntry: function(item, selectedText, template) {
        let mainWindow = Zotero.getMainWindow();
        let message = `Would you like to manually enter the nanopublication URL?\n\n`;
        message += `Selected text: "${selectedText.substring(0, 100)}${selectedText.length > 100 ? '...' : ''}"\n\n`;
        message += `Paste the nanopublication URL below:`;
        
        let nanopubUrl = mainWindow.prompt(message);
        
        if (nanopubUrl && nanopubUrl.startsWith("http")) {
          this.saveNanopubNote(item, nanopubUrl, selectedText, template?.description);
        }
      },
      
      saveNanopubNote: async function(item, nanopubUrl, selectedText, doi) {
        try {
          Services.console.logStringMessage("NanopubPDF: Saving nanopub note");
          
          let note = new Zotero.Item("note");
          
          let noteContent = `
            <div style="font-family: Arial, sans-serif; line-height: 1.6;">
              <h3 style="color: #2563eb;">📄 Nanopublication from PDF Text</h3>
              
              <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 16px 0;">
                <h4 style="margin-top: 0; color: #92400e;">Selected Text</h4>
                <blockquote style="margin: 0; font-style: italic; color: #374151; white-space: pre-wrap;">"${selectedText}"</blockquote>
              </div>
              
              ${doi ? `<p><strong>Source DOI:</strong> <a href="https://doi.org/${doi}" target="_blank">${doi}</a></p>` : ''}
              
              <p><strong>Nanopublication URL:</strong><br>
              <a href="${nanopubUrl}" target="_blank" style="word-break: break-all;">${nanopubUrl}</a></p>
              
              <div style="background: #f1f5f9; border-radius: 6px; padding: 12px; margin-top: 16px;">
                <p style="margin: 0; font-size: 12px; color: #64748b;">
                  <strong>Created:</strong> ${new Date().toLocaleString()}
                </p>
              </div>
            </div>
          `;
          
          note.setNote(noteContent);
          note.parentItemID = item.id;
          
          note.addTag("nanopub:pdf-text");
          note.addTag("nanopublication");
          note.addTag("nanopub:created");
          
          if (doi) {
            // Clean DOI for tagging
            let cleanDoi = doi.replace(/^(https?:\/\/)?(dx\.)?doi\.org\//, '');
            note.addTag(`doi:${cleanDoi}`);
          }
          
          // Extract nanopub ID from URL for tagging
          let nanopubId = nanopubUrl.split('/').pop();
          if (nanopubId) {
            note.addTag(`nanopub-id:${nanopubId}`);
          }
          
          await note.saveTx();
          
          Services.console.logStringMessage("NanopubPDF: Note saved successfully");
          
          // Show success message with more details
          let successMessage = "✅ Nanopublication note created successfully!\n\n";
          successMessage += `📄 Note attached to: ${item.getField("title") || "Current item"}\n`;
          successMessage += `🔗 Nanopub: ${nanopubUrl}\n`;
          successMessage += `📝 Text: "${selectedText.substring(0, 100)}${selectedText.length > 100 ? '...' : ''}"\n\n`;
          successMessage += "The note should now appear under this item in your Zotero library.";
          
          let mainWindow = Zotero.getMainWindow();
          if (mainWindow) {
            mainWindow.alert(successMessage);
          }
          
        } catch (error) {
          Services.console.logStringMessage("NanopubPDF: Error saving nanopub note: " + error.message);
          let mainWindow = Zotero.getMainWindow();
          if (mainWindow) {
            mainWindow.alert("Error saving nanopublication note: " + error.message);
          }
        }
      },
      
      shutdown: function() {
        Services.console.logStringMessage("NanopubPDF: Shutting down");
        
        if (this.checkInterval) {
          clearInterval(this.checkInterval);
          this.checkInterval = null;
        }
      }
    };
    
    Zotero.NanopubPDFHandler.init();
    Services.console.logStringMessage("Nanopub: PDF handler initialized successfully");
    
  } catch (error) {
    Services.console.logStringMessage("Nanopub: Error initializing PDF handler: " + error.message);
  }
}

function shutdown(data, reason) {
  if (reason !== APP_SHUTDOWN) {
    Zotero.NanopubPlugin && Zotero.NanopubPlugin.shutdown && Zotero.NanopubPlugin.shutdown();
    
    if (typeof Zotero.NanopubPDFHandler !== 'undefined') {
      Zotero.NanopubPDFHandler.shutdown();
    }
  }
}

function uninstall(data, reason) {}
