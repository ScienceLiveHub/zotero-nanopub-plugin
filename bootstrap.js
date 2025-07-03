// bootstrap.js - Enhanced Nanopub Plugin with Template-Specific DOI Parameters
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
      let existingMenu = menu.querySelector("#zotero-nanopub-menu");
      if (existingMenu) {
        existingMenu.remove();
      }

      let pane = Zotero.getActiveZoteroPane();
      
      // Create main menu item with submenu
      let mainMenu = pane.document.createElementNS(
        "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
        "menu"
      );
      mainMenu.setAttribute("id", "zotero-nanopub-menu");
      mainMenu.setAttribute("label", "Create Nanopublication");

      // Create submenu popup
      let submenu = pane.document.createElementNS(
        "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
        "menupopup"
      );
      mainMenu.appendChild(submenu);

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
        submenu.appendChild(templateItem);
      });

      menu.appendChild(mainMenu);
      Services.console.logStringMessage("Nanopub: submenu added with " + this.templates.length + " templates");
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

    shutdown: function() {
      let pane = Zotero.getActiveZoteroPane();
      let menuItem = pane && pane.document.getElementById("zotero-nanopub-menu");
      if (menuItem) menuItem.remove();
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
