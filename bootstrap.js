// bootstrap.js - Complete Nanopub Plugin for Zotero 7
// Combines: Add by Identifier, Search Nanopubs, PDF Text Selection

var NanopubPlugin;

function log(msg) {
  Zotero.debug("Nanopub: " + msg);
}

function install() {
  log("Installed");
}

async function startup({ id, version, rootURI }) {
  log("Starting up plugin v" + version);
  
  // Wait for Zotero to be ready
  if (!Zotero.Schema || !Zotero.Schema.schemaUpdatePromise) {
    setTimeout(() => startup({ id, version, rootURI }), 100);
    return;
  }
  
  await Zotero.Schema.schemaUpdatePromise;
  
  // Initialize the complete plugin
  initializeNanopubPlugin({ id, version, rootURI });
}

function initializeNanopubPlugin({ id, version, rootURI }) {
  log("Initializing Nanopub Plugin");
  
  NanopubPlugin = {
    id: id,
    version: version,
    rootURI: rootURI,
    initialized: false,
    processedReaders: new WeakSet(),
    pdfCheckInterval: null,
    
    // Configuration
    nanodashUrl: "https://nanodash.knowledgepixels.com/publish",
    sparqlEndpoint: "https://query.petapico.org/repo/full",
    
    // Default template for PDF text nanopubs
    defaultTemplate: {
      id: "research_summary",
      name: "📝 Research Summary",
      template: "http://purl.org/np/RAVEpTdLrX5XrhNl_gnvTaBcjRRSDu_hhZix8gu2HO7jI",
      doiParameterName: "paper",
      textParameterName: "text",
      relationParameterName: "relation",
      citedEntityParameterName: "cited_entity"
    },

    init: async function() {
      if (this.initialized) {
        log("Already initialized");
        return;
      }
      
      log("Initializing all features");
      this.initialized = true;
      
      // Initialize all three features
      this.initAddByIdentifier();
      this.initSearchFunctionality();
      this.initPDFHandler();
      
      // Add to all windows
      this.addToAllWindows();
      
      // Show startup notification
      setTimeout(() => {
        this.showStartupNotification();
      }, 2000);
    },

    showStartupNotification: function() {
      try {
        let win = Zotero.getMainWindow();
        if (win) {
          win.alert(
            "🔬 Nanopub Plugin Loaded (v" + this.version + ")!\n\n" +
            "Features:\n" +
            "✅ Add by Identifier: File → Add by Identifier (nanopub URLs)\n" +
            "✅ Search: Right-click item → Search Nanopubs\n" +
            "✅ PDF: Select text in PDF → Click 'Create Nanopub' button\n\n" +
            "Test URL: https://w3id.org/np/RAE8VvRRXE65JsAsqwlNxoY7HSZ9t2Gvqo_YqAWcEDrcU"
          );
        }
      } catch (err) {
        log("Error showing notification: " + err);
      }
    },

    // ==================== Feature 1: Add by Identifier ====================
    
    initAddByIdentifier: function() {
      log("Initializing Add by Identifier feature");
      
      setTimeout(() => {
        try {
          let window = Zotero.getMainWindow();
          if (window && window.Zotero_Lookup) {
            let originalAccept = window.Zotero_Lookup.accept;
            if (originalAccept) {
              window.Zotero_Lookup.accept = () => {
                let textbox = window.document.getElementById("zotero-lookup-textbox");
                if (textbox && textbox.value.includes("w3id.org/np/")) {
                  log("Intercepted nanopub URL: " + textbox.value);
                  this.processNanopubURL(textbox.value.trim());
                  if (window.Zotero_Lookup.cancel) {
                    window.Zotero_Lookup.cancel();
                  }
                  return;
                }
                return originalAccept.call(window.Zotero_Lookup);
              };
              log("Add by Identifier override installed");
            }
          }
        } catch (err) {
          log("Error setting up Add by Identifier: " + err);
        }
      }, 3000);
    },

    processNanopubURL: async function(url) {
      try {
        if (!url.includes("w3id.org/np/")) {
          Zotero.getMainWindow().alert("Not a valid nanopublication URL");
          return;
        }

        let itemID = await this.addNanopubToZotero(url);
        Zotero.getMainWindow().alert("✅ Nanopublication added! ID: " + itemID);
      } catch (err) {
        Zotero.getMainWindow().alert("Error: " + err.message);
      }
    },

    // ==================== Feature 2: Search Nanopubs ====================
    
    initSearchFunctionality: function() {
      log("Initializing Search functionality");
    },

    handleSearch: async function() {
      try {
        log("Search triggered");
        
        let zoteroPane = Zotero.getActiveZoteroPane();
        if (!zoteroPane) {
          Zotero.getMainWindow().alert("Please select an item first");
          return;
        }

        let selectedItems = zoteroPane.getSelectedItems();
        if (!selectedItems || selectedItems.length === 0) {
          Zotero.getMainWindow().alert("Please select an item with a DOI");
          return;
        }

        let item = selectedItems[0];
        let doi = item.getField("DOI");
        
        if (!doi) {
          Zotero.getMainWindow().alert("Selected item has no DOI");
          return;
        }

        await this.searchNanopubsByDOI(doi, item);
      } catch (err) {
        log("Search error: " + err);
        Zotero.getMainWindow().alert("Search failed: " + err.message);
      }
    },

    searchNanopubsByDOI: async function(doi, parentItem) {
      try {
        let cleanTerm = doi.replace(/^(https?:\/\/)?(dx\.)?doi\.org\//, '');
        
        let query = `
          PREFIX np: <http://www.nanopub.org/nschema#>
          PREFIX dcterms: <http://purl.org/dc/terms/>
          PREFIX foaf: <http://xmlns.com/foaf/0.1/>
          
          SELECT DISTINCT ?np ?date ?authorName
          WHERE {
            ?np a np:Nanopublication ;
                np:hasAssertion ?assertion .
            
            GRAPH ?assertion {
              ?s ?p ?o .
              FILTER (
                CONTAINS(LCASE(STR(?s)), LCASE("${cleanTerm}")) ||
                CONTAINS(LCASE(STR(?p)), LCASE("${cleanTerm}")) ||
                CONTAINS(LCASE(STR(?o)), LCASE("${cleanTerm}"))
              )
            }
            
            OPTIONAL {
              ?np dcterms:created ?date .
              ?np dcterms:creator ?creator .
              ?creator foaf:name ?authorName .
            }
          }
          ORDER BY DESC(?date)
          LIMIT 10`;

        let results = await this.performSPARQLQuery(query);
        
        if (results.length > 0) {
          this.displaySearchResults(results, doi, parentItem);
        } else {
          Zotero.getMainWindow().alert("No nanopublications found for DOI: " + doi);
        }
      } catch (err) {
        log("SPARQL error: " + err);
        throw err;
      }
    },

    performSPARQLQuery: function(query) {
      return new Promise((resolve, reject) => {
        let xhr = new XMLHttpRequest();
        xhr.open("POST", this.sparqlEndpoint);
        xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        xhr.setRequestHeader("Accept", "application/sparql-results+json");
        
        xhr.onload = function() {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              let data = JSON.parse(xhr.responseText);
              if (data.results && data.results.bindings) {
                let results = data.results.bindings.map(binding => ({
                  url: binding.np ? binding.np.value : '',
                  title: NanopubPlugin.generateTitle(binding.np ? binding.np.value : ''),
                  date: binding.date ? binding.date.value : '',
                  author: binding.authorName ? binding.authorName.value : ''
                }));
                resolve(results);
              } else {
                resolve([]);
              }
            } catch (e) {
              reject(e);
            }
          } else {
            reject(new Error("HTTP " + xhr.status));
          }
        };
        
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.send("query=" + encodeURIComponent(query) + "&format=json");
      });
    },

    displaySearchResults: function(results, doi, parentItem) {
      let message = `Found ${results.length} nanopublication(s):\n\n`;
      
      results.forEach((result, i) => {
        message += `${i + 1}. ${result.title}\n`;
        message += `   URL: ${result.url}\n`;
        if (result.author) message += `   Author: ${result.author}\n`;
        message += "\n";
      });
      
      message += "Enter numbers to add (comma-separated):";
      
      let choice = Zotero.getMainWindow().prompt(message, "1");
      if (choice) {
        let indices = choice.split(",").map(n => parseInt(n.trim()) - 1);
        
        indices.forEach(async (index) => {
          if (index >= 0 && index < results.length) {
            try {
              let itemID = await this.addNanopubToZotero(results[index].url);
              if (parentItem && itemID) {
                await this.createRelatedItems(parentItem.id, itemID);
              }
            } catch (err) {
              log("Error adding item: " + err);
            }
          }
        });
      }
    },

    // ==================== Feature 3: PDF Handler ====================
    
    initPDFHandler: function() {
      log("Initializing PDF handler");
      
      // Start checking for PDF readers
      if (this.pdfCheckInterval) {
        clearInterval(this.pdfCheckInterval);
      }
      
      this.pdfCheckInterval = setInterval(() => {
        this.checkForPDFReaders();
      }, 3000);
      
      // Do initial check
      this.checkForPDFReaders();
    },

    checkForPDFReaders: function() {
      if (!Zotero.Reader || !Zotero.Reader._readers) {
        return;
      }
      
      for (let reader of Zotero.Reader._readers) {
        if (!this.processedReaders.has(reader)) {
          log("Found new PDF reader");
          this.instrumentPDFReader(reader);
          this.processedReaders.add(reader);
        }
      }
    },

    instrumentPDFReader: function(reader) {
      if (!reader || !reader._iframeWindow) {
        setTimeout(() => {
          if (reader._iframeWindow) {
            this.instrumentPDFReader(reader);
          }
        }, 1000);
        return;
      }
      
      log("Instrumenting PDF reader");
      
      // Add button after delay to ensure PDF is loaded
      setTimeout(() => {
        this.addPDFButton(reader._iframeWindow, reader);
      }, 2000);
    },

    addPDFButton: function(targetWindow, reader) {
      try {
        // Check if button already exists
        if (targetWindow.document.getElementById('nanopub-pdf-button')) {
          return;
        }
        
        let button = targetWindow.document.createElement('button');
        button.id = 'nanopub-pdf-button';
        button.innerHTML = '🔬 Create Nanopub';
        
        // Button styling
        button.style.position = 'fixed';
        button.style.top = '10px';
        button.style.right = '10px';
        button.style.zIndex = '999999';
        button.style.backgroundColor = '#007bff';
        button.style.color = 'white';
        button.style.border = 'none';
        button.style.padding = '12px 16px';
        button.style.borderRadius = '6px';
        button.style.cursor = 'pointer';
        button.style.fontSize = '14px';
        button.style.fontWeight = 'bold';
        button.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
        button.style.transition = 'all 0.3s ease';
        button.title = 'Create nanopublication from selected text';
        
        // Hover effects
        button.onmouseover = function() {
          this.style.backgroundColor = '#0056b3';
          this.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
        };
        
        button.onmouseout = function() {
          let selection = targetWindow.getSelection();
          if (selection && !selection.isCollapsed) {
            this.style.backgroundColor = '#28a745';
          } else {
            this.style.backgroundColor = '#007bff';
          }
          this.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
        };
        
        // Click handler
        button.onclick = () => {
          log("PDF button clicked");
          let selectedText = this.getSelectedPDFText(targetWindow);
          
          if (selectedText.length > 0) {
            log("Found selected text: " + selectedText.substring(0, 50));
            this.createNanopubFromPDFText(selectedText, reader);
          } else {
            Zotero.getMainWindow().alert("Please select some text in the PDF first");
          }
        };
        
        targetWindow.document.body.appendChild(button);
        log("PDF button added successfully");
        
        // Monitor text selection
        targetWindow.addEventListener('mouseup', () => {
          setTimeout(() => {
            let selection = targetWindow.getSelection();
            if (selection && !selection.isCollapsed) {
              let selectedText = selection.toString().trim();
              if (selectedText.length > 0) {
                button.style.backgroundColor = '#28a745';
                button.innerHTML = '🔬 Create Nanopub ✓';
              } else {
                button.style.backgroundColor = '#007bff';
                button.innerHTML = '🔬 Create Nanopub';
              }
            }
          }, 100);
        }, true);
        
      } catch (error) {
        log("Could not add PDF button: " + error.message);
      }
    },

    getSelectedPDFText: function(targetWindow) {
      let windowsToCheck = [
        targetWindow,
        targetWindow.parent,
        targetWindow.top
      ];
      
      try {
        // Add PDF.js specific windows
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
        log("Error finding PDF.js windows: " + error.message);
      }
      
      let selectedText = '';
      
      for (let win of windowsToCheck) {
        if (!win) continue;
        
        try {
          let selection = win.getSelection();
          if (selection && !selection.isCollapsed && selection.toString().trim().length > 0) {
            selectedText = selection.toString().trim();
            break;
          }
        } catch (error) {
          continue;
        }
      }
      
      return selectedText;
    },

    createNanopubFromPDFText: function(text, reader) {
      log("Creating nanopub from PDF text");
      
      try {
        let currentItem = reader._item;
        if (!currentItem) {
          Zotero.getMainWindow().alert("Could not identify the current PDF item");
          return;
        }
        
        // Get parent item if this is an attachment
        let parentItem = currentItem;
        if (currentItem.isAttachment() && currentItem.parentItemID) {
          parentItem = Zotero.Items.get(currentItem.parentItemID);
        }
        
        let doi = this.extractDOI(parentItem);
        log("Found DOI: " + doi);
        
        // Build Nanodash URL
        let nanodashUrl = this.buildNanodashUrl(doi, text);
        log("Opening Nanodash: " + nanodashUrl);
        
        // Open Nanodash
        Zotero.launchURL(nanodashUrl);
        
        // Show success message
        let message = "✅ Nanodash opened with your selected text!\n\n";
        message += "Template: " + this.defaultTemplate.name + "\n";
        message += "Text: \"" + text.substring(0, 100) + (text.length > 100 ? "..." : "") + "\"\n";
        if (doi) {
          message += "Paper DOI: " + doi + "\n";
        }
        message += "\nYou can now create your nanopublication on Nanodash.";
        
        Zotero.getMainWindow().alert(message);
        
      } catch (error) {
        log("Error creating nanopub: " + error.message);
        Zotero.getMainWindow().alert("Error: " + error.message);
      }
    },

    extractDOI: function(item) {
      let doi = item.getField("DOI") || "";
      
      if (!doi) {
        let url = item.getField("url") || "";
        if (url.includes("doi.org")) {
          doi = url.replace(/^(https?:\/\/)?(dx\.)?doi\.org\//, '');
        }
      }
      
      doi = doi.trim();
      if (doi) {
        doi = doi.replace(/^doi:\s*/i, '');
      }
      
      return doi;
    },

    buildNanodashUrl: function(doi, text) {
      let template = this.defaultTemplate;
      let nanodashUrl = this.nanodashUrl;
      
      if (template && template.template) {
        nanodashUrl += "?template=" + encodeURIComponent(template.template) + "&template-version=latest";
        
        if (doi && template.doiParameterName) {
          let cleanDoi = doi.replace(/^(https?:\/\/)?(dx\.)?doi\.org\//, '');
          nanodashUrl += "&param_" + template.doiParameterName + "=" + encodeURIComponent("https://doi.org/" + cleanDoi);
        }
        
        if (template.textParameterName) {
          nanodashUrl += "&param_" + template.textParameterName + "=" + encodeURIComponent(text);
        }
        
        if (doi && template.relationParameterName && template.citedEntityParameterName) {
          let cleanDoi = doi.replace(/^(https?:\/\/)?(dx\.)?doi\.org\//, '');
          nanodashUrl += "&param_" + template.relationParameterName + "=" + encodeURIComponent("http://purl.org/spar/cito/includesQuotationFrom");
          nanodashUrl += "&param_" + template.citedEntityParameterName + "=" + encodeURIComponent("https://doi.org/" + cleanDoi);
        }
      } else if (doi) {
        nanodashUrl += "?source=" + encodeURIComponent("https://doi.org/" + doi);
      }
      
      return nanodashUrl;
    },

    // ==================== Shared Functions ====================
    
    addNanopubToZotero: async function(url) {
      try {
        log("Fetching nanopub from: " + url);
        
        let response = await fetch(url, {
          headers: {
            'Accept': 'application/trig, text/turtle, application/rdf+xml, text/plain'
          }
        });

        if (!response.ok) {
          throw new Error("HTTP " + response.status);
        }

        let rdfContent = await response.text();
        let metadata = this.extractMetadata(rdfContent);
        
        return await Zotero.DB.executeTransaction(async () => {
          let item = new Zotero.Item("document");
          
          item.setField("title", metadata.title || this.generateTitle(url));
          item.setField("url", url);
          
          if (metadata.author) {
            item.setCreator(0, {
              firstName: metadata.author.firstName || "",
              lastName: metadata.author.lastName || "Unknown Author",
              creatorType: "author"
            });
          }
          
          if (metadata.date) {
            try {
              let date = new Date(metadata.date);
              if (!isNaN(date)) {
                item.setField("date", date.toISOString().split('T')[0]);
              }
            } catch (e) {
              log("Could not parse date: " + metadata.date);
            }
          }
          
          let abstract = "Nanopublication\n\nURL: " + url + "\nImported: " + new Date().toISOString();
          if (metadata.description) {
            abstract += "\n\nDescription: " + metadata.description;
          }
          
          item.setField("abstractNote", abstract);
          item.addTag("nanopublication");
          
          let itemID = await item.save();
          log("Item saved with ID: " + itemID);
          
          // Add to current collection if selected
          let zoteroPane = Zotero.getActiveZoteroPane();
          if (zoteroPane && zoteroPane.getSelectedCollection()) {
            let collection = zoteroPane.getSelectedCollection();
            await collection.addItem(itemID);
          }
          
          return itemID;
        });
      } catch (err) {
        log("Error adding nanopub: " + err.message);
        throw err;
      }
    },

    extractMetadata: function(rdfContent) {
      let metadata = {};
      
      try {
        // Extract title
        let titleMatch = rdfContent.match(/dc:title\s*"([^"]+)"/i) ||
                        rdfContent.match(/rdfs:label\s*"([^"]+)"/i);
        if (titleMatch) {
          metadata.title = titleMatch[1];
        }
        
        // Extract author
        let authorMatch = rdfContent.match(/foaf:name\s*"([^"]+)"/i) ||
                         rdfContent.match(/dc:creator\s*"([^"]+)"/i);
        
        if (authorMatch) {
          metadata.author = this.parseAuthorName(authorMatch[1].trim());
        }

        // Extract date
        let dateMatch = rdfContent.match(/dcterms:created\s*"([^"]+)"/i);
        if (dateMatch) {
          metadata.date = dateMatch[1];
        }

        // Extract description
        let abstractMatch = rdfContent.match(/dc:description\s*"([^"]+)"/i);
        if (abstractMatch) {
          metadata.description = abstractMatch[1];
        }
      } catch (err) {
        log("Metadata extraction error: " + err);
      }
      
      return metadata;
    },

    parseAuthorName: function(fullName) {
      if (!fullName || typeof fullName !== 'string') {
        return { firstName: "", lastName: "Unknown Author" };
      }

      fullName = fullName.trim();
      
      if (fullName.includes(',')) {
        let parts = fullName.split(',');
        return {
          firstName: parts.length > 1 ? parts[1].trim() : "",
          lastName: parts[0].trim()
        };
      } else {
        let nameParts = fullName.split(/\s+/);
        if (nameParts.length === 1) {
          return { firstName: "", lastName: nameParts[0] };
        } else if (nameParts.length === 2) {
          return { firstName: nameParts[0], lastName: nameParts[1] };
        } else {
          return {
            firstName: nameParts[0],
            lastName: nameParts.slice(1).join(' ')
          };
        }
      }
    },

    generateTitle: function(url) {
      if (url) {
        let match = url.match(/np\/([A-Za-z0-9_-]+)$/);
        if (match) {
          return "Nanopublication " + match[1].substring(0, 8);
        }
      }
      return "Nanopublication";
    },

    createRelatedItems: async function(parentItemID, childItemID) {
      try {
        await Zotero.DB.executeTransaction(async () => {
          let parentItem = await Zotero.Items.getAsync(parentItemID);
          let childItem = await Zotero.Items.getAsync(childItemID);
          
          if (parentItem && childItem) {
            parentItem.addRelatedItem(childItem);
            childItem.addRelatedItem(parentItem);
            
            await parentItem.save();
            await childItem.save();
            
            log("Created relation between " + parentItemID + " and " + childItemID);
          }
        });
      } catch (err) {
        log("Error creating relation: " + err);
      }
    },

    // ==================== Window Management ====================
    
    addToAllWindows: function() {
      let windows = Zotero.getMainWindows();
      for (let win of windows) {
        if (!win.NanopubPlugin) {
          this.addToWindow(win);
        }
      }
    },

    addToWindow: function(window) {
      log("Adding to window");
      window.NanopubPlugin = this;
      
      // Add menu items
      this.addMenuItems(window);
    },

    addMenuItems: function(window) {
      try {
        // Add to Tools menu
        let toolsMenu = window.document.getElementById("menu_ToolsPopup");
        if (toolsMenu && !window.document.getElementById("nanopub-tools-search")) {
          let menuItem = window.document.createXULElement("menuitem");
          menuItem.id = "nanopub-tools-search";
          menuItem.setAttribute("label", "Search Nanopublications");
          menuItem.addEventListener("command", () => {
            this.handleSearch();
          });
          toolsMenu.appendChild(menuItem);
          log("Added tools menu item");
        }

        // Add to context menu
        let contextMenu = window.document.getElementById("zotero-itemmenu");
        if (contextMenu && !window.document.getElementById("nanopub-context-search")) {
          let menuItem = window.document.createXULElement("menuitem");
          menuItem.id = "nanopub-context-search";
          menuItem.setAttribute("label", "Search Nanopubs for this Item");
          menuItem.addEventListener("command", () => {
            this.handleSearch();
          });
          contextMenu.appendChild(menuItem);
          log("Added context menu item");
        }
      } catch (err) {
        log("Error adding menu items: " + err);
      }
    },

    removeFromAllWindows: function() {
      let windows = Zotero.getMainWindows();
      for (let win of windows) {
        if (win.NanopubPlugin) {
          this.removeFromWindow(win);
        }
      }
    },

    removeFromWindow: function(window) {
      log("Removing from window");
      
      // Remove menu items
      let toolsItem = window.document.getElementById("nanopub-tools-search");
      if (toolsItem) toolsItem.remove();
      
      let contextItem = window.document.getElementById("nanopub-context-search");
      if (contextItem) contextItem.remove();
      
      delete window.NanopubPlugin;
    },

    shutdown: function() {
      log("Shutting down plugin");
      
      // Clear intervals
      if (this.pdfCheckInterval) {
        clearInterval(this.pdfCheckInterval);
        this.pdfCheckInterval = null;
      }
      
      // Remove from all windows
      this.removeFromAllWindows();
      
      // Clear PDF readers
      this.processedReaders = new WeakSet();
      
      this.initialized = false;
    }
  };
  
  // Initialize the plugin
  NanopubPlugin.init();
  log("Plugin initialized successfully");
}

function onMainWindowLoad({ window }) {
  if (NanopubPlugin) {
    NanopubPlugin.addToWindow(window);
  }
}

function onMainWindowUnload({ window }) {
  if (NanopubPlugin) {
    NanopubPlugin.removeFromWindow(window);
  }
}

function shutdown() {
  log("Shutting down");
  if (NanopubPlugin) {
    NanopubPlugin.shutdown();
    NanopubPlugin = undefined;
  }
}

function uninstall() {
  log("Uninstalled");
}
