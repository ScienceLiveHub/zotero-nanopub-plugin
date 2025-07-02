// bootstrap.js - Simple Nanopub Plugin with Template Submenu
function install(data, reason) {}

function startup(data, reason) {
  Services.console.logStringMessage("Nanopub: startup called");

  Zotero.NanopubPlugin = {
    // Template configuration - easy to modify
    templates: [
      {
        id: "research_summary",
        name: "📝 Research Summary",
        template: "http://purl.org/np/RAVEpTdLrX5XrhNl_gnvTaBcjRRSDu_hhZix8gu2HO7jI",
        description: "Commenting on or evaluating a paper (using CiTO)"
      },
      {
        id: "claim", 
        name: "💡 Scientific Claim",
        template: "https://w3id.org/np/RALmXhDw3rHcMveTgbv8VtWxijUHwnSqhCmtJFIPKWVaA",
        description: "Make a scientific Claim"
      },
      {
        id: "data_description",
        name: "📊 Data Description",
        template: "https://w3id.org/np/RAkLducUzdNR3Hs2aF1iBxPH6nlOn5LfLvuVcSc6MiBqM", 
        description: "Assert findings from data"
      },
      {
        id: "citation_link",
        name: "📚 Citation Creation",
        template: "https://w3id.org/np/RAX_4tWTyjFpO6nz63s14ucuejd64t2mK3IBlkwZ7jjLo",
        description: "Create a citation from a paper"
      },
      {
        id: "browse_templates",
        name: "⚙️  Browse All Templates...",
        template: null,
        description: "Browse and select from all available nanopublication templates"
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

      // Build nanodash URL - check if this is the "browse all" option
      let nanodashUrl;
      if (template.template === null) {
        // For "Browse All Templates", go to the main nanodash page
        nanodashUrl = this.nanodashUrl;
        // Add DOI as source if available
        if (doi) {
          nanodashUrl += `?source=${encodeURIComponent(doi)}`;
        }
      } else {
        // For specific templates, include template parameter
        nanodashUrl = `${this.nanodashUrl}?template=${encodeURIComponent(template.template)}&template-version=latest`;
        // Add DOI as source if available
        if (doi) {
          nanodashUrl += `&source=${encodeURIComponent(doi)}`;
        }
      } 
      Services.console.logStringMessage("Nanopub: Opening nanodash URL: " + nanodashUrl);
      
      // Launch nanodash with the selected template
      Zotero.launchURL(nanodashUrl);

      // Wait for user to create nanopub and get URL back
      setTimeout(async () => {
        let nanopubUrl = await Zotero.Utilities.Internal.prompt(
          "Nanopublication URL",
          `Paste the URL from Nanodash for "${template.name}":`,
          ""
        );
        
        if (nanopubUrl && nanopubUrl.startsWith("http")) {
          // Create note with template information
          let note = new Zotero.Item("note");
          let noteContent = `<h3>Nanopublication: ${template.name}</h3>`;
          noteContent += `<p><strong>Template:</strong> ${template.description}</p>`;
          noteContent += `<p><strong>URL:</strong> <a href="${nanopubUrl}">${nanopubUrl}</a></p>`;
          noteContent += `<p><strong>Created:</strong> ${new Date().toLocaleString()}</p>`;
          
          note.setNote(noteContent);
          note.parentItemID = item.id;
          
          // Add tags for organization
          note.addTag(`nanopub:${template.id}`);
          note.addTag("nanopublication");
          
          await note.saveTx();
          Services.console.logStringMessage("Nanopub: note saved with template info");
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
