// bootstrap.js
function install(data, reason) {}

function startup(data, reason) {
  Services.console.logStringMessage("Nanopub: startup called");

  Zotero.NanopubPlugin = {
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
          // Try after a short delay
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
      let existingItem = menu.querySelector("#zotero-nanopub-create");
      if (!existingItem) {
        let pane = Zotero.getActiveZoteroPane();
        let menuItem = pane.document.createElementNS(
          "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
          "menuitem"
        );
        menuItem.setAttribute("id", "zotero-nanopub-create");
        menuItem.setAttribute("label", "Create Nanopublication on Nanodash");
        menuItem.addEventListener("command", Zotero.NanopubPlugin.createNanopub);
        menu.appendChild(menuItem);
        Services.console.logStringMessage("Nanopub: menu item added");
      }
    },

    createNanopub: async function() {
      Services.console.logStringMessage("Nanopub: createNanopub called");
      let pane = Zotero.getActiveZoteroPane();
      let items = pane.getSelectedItems();
      if (!items.length || !items[0].isRegularItem()) {
        Zotero.getMainWindow().alert("Please select a valid item.");
        return;
      }
      let item = items[0];
      let doi = item.getField("DOI") || "";
      let nanodashUrl = "https://nanodash.petapico.org/publish?template=http://purl.org/np/RAhMhogxA2LQGFNAbsukAuV75jhBZjPrOSMnQlYCljoP4&template-version=latest";
      Zotero.launchURL(nanodashUrl + "?source=" + encodeURIComponent(doi));

      setTimeout(async () => {
        let nanopubUrl = await Zotero.Utilities.Internal.prompt(
          "Nanopublication URL",
          "Paste the URL from Nanodash:",
          ""
        );
        if (nanopubUrl && nanopubUrl.startsWith("http")) {
          let note = new Zotero.Item("note");
          note.setNote(`Nanopublication: <a href="${nanopubUrl}">${nanopubUrl}</a>`);
          note.parentItemID = item.id;
          await note.saveTx();
          Services.console.logStringMessage("Nanopub: note saved");
        }
      }, 2000);
    },

    shutdown: function() {
      let pane = Zotero.getActiveZoteroPane();
      let menuItem = pane && pane.document.getElementById("zotero-nanopub-create");
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
