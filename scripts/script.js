var currentFolder = {};
var sugestCallback, db;

$(function() {

    //Database
    db = openDatabase("QuickBookmarksDB", "1.0", "Database", 200000);
    db.transaction(function(tx) {
        tx.executeSql("SELECT COUNT(*) FROM FoldersMenu", [], function(result) {
            loadFoldersMenu();
        }, function(tx, error) {
            console.dir(error);
            tx.executeSql("CREATE TABLE FoldersMenu (id TEXT NOT NULL UNIQUE, title TEXT NOT NULL, orderMenu INTEGER NULL)", [], function(result) { 
                loadFoldersMenu(); 
            }, function(err, txt){console.dir(err); console.dir(txt)});
        });
    });

    //Templates
    $.template("bookmarks", "{{#if url}} <li><a data-linkid='{{=id}}' href='{{=url}}' target='_self'><img class='menu-sprites link' src='/images/blank.gif' /><span>{{=title}}</span></a></li> {{/if}}");
    $.template("folders", "{{#if $ctx.not(url)}} <li><a href='#' data-folderid='{{=id}}'><img class='menu-sprites folder' src='/images/blank.gif' /><span>{{=title}}</span></a></li> {{/if}}");
    $.template("apps", "<li><a title='{{=name}}' href='#' data-appid='{{=id}}'><img width='64px' height='64px' src='{{getIcon icons}}' /><span>{{=name}}</span></a></li>");
    $.template("folderMenu", "<li><a href='#' data-folderid='{{=id}}' class='{{getClass $data}}'>{{=title}}</a></li>");
    $.template("title", "<h2><a href='#'>{{=title}}</a></h2>");
    $.views.registerTags({
        getIcon: function(icons){ return icons.filter(function(e){ return e.size>= 64; } )[0].url; },
        getClass: function(dat){ if (dat.id == currentFolder.id) return "active"; else return ""; }
    });

    //Initalize
    fillApps();
    
    var ht = $.render({id:"0", title:chrome.i18n.getMessage("root")}, "folderMenu");
    var $ht = $(ht);
    $ht.find("a").click(folderClick);
    $("#menu-itens").append($ht);

    $("#bin").droppable({
            over: function() { $(this).animate({ opacity: 1 }); }
            ,out: function() { $(this).animate({ opacity: 0.5 }); }
            ,tolerance: "touch"
			,drop: function(event, ui) {
                $("#bin").hide("fade");
                var $dragObj = $(ui.draggable);
                var $dragObjA = $("a", $dragObj);
                if ($dragObjA.data("folderid")) {
                    if ($dragObjA.hasClass("active"))
                        loadBookmarks(0);
                    var fldID = $dragObjA.data("folderid");
				    $dragObj.hide("fade").remove();
                    //webkitNotifications.createNotification("", "Sucess", "Menu " + $dragObj.text() +" foi removido com sucesso!").show();
                    db.transaction(function(tx) {
                        tx.executeSql("DELETE FROM FoldersMenu WHERE id = " + fldID);
                    });
                } else if ($dragObjA.data("linkid")) {
                    var linkID = $dragObjA.data("linkid");
                    chrome.bookmarks.remove(linkID.toString(), function() {
                        //webkitNotifications.createNotification("", "Sucess", "O link " + $dragObj.text() +" foi removido com sucesso!").show();
                        $dragObj.hide("fade").remove();
                    });
                } else if ($dragObjA.data("appid")) {
                    var appID = $dragObjA.data("appid");
                    chrome.management.uninstall(appID.toString(), function() {
                        //webkitNotifications.createNotification("", "Sucess", "O aplicatovo " + $dragObj.text() +" foi desinstalado com sucesso!").show();
                        $dragObj.hide("fade").remove();
                    });
                }
			}
		});

    //Clicks
    $("[data-containerId]").click(function() {
        var contID = $(this).data("containerid");
        $("#" + contID + "-container").stop().slideToggle(600, "easeOutQuint");
    });
    $("#add-button").click(function(){
        chrome.bookmarks.get(currentFolder.id, function(foldRows){
            var fold = foldRows[0];
            db.transaction(function(tx) {
                tx.executeSql("INSERT INTO FoldersMenu (id, title) values(?, ?)", [fold.id, fold.title], function(){
                    var $fld = $($.render(fold, "folderMenu"));
                    $fld.find("a").click(folderClick)
                    $fld.hide();
                    $("#menu-itens").append($fld);
                    $fld.show("blind");
                }, null);
            });
        });
    });

    //Shortcuts
    window.addEventListener('keyup', keyboardNavigation, false);

    chrome.omnibox.onInputCancelled.addListener(function() { loadBookmarks(0); });
    chrome.omnibox.onInputEntered.addListener(function(text) {
            currentFolder = text;
            chrome.bookmarks.search(text, function(tree){
                    $("#page-container").empty();
                    fillBookmarks(tree);
                });
            
            updatePath();
    });

    translatePage();
});

folderClick = function(e) {
    e.preventDefault();
    var itemID = $(this).data("folderid");
    loadBookmarks(parseInt(itemID));
}
appClick = function(e) {
    e.preventDefault();
    var itemID = $(this).data("appid");
    chrome.management.launchApp(itemID, function(){
       window.close(); 
    });
}

keyboardNavigation = function(e) {
    switch(e.which) {
        case 70:
            $("#folders-container").stop().slideToggle(600, "easeOutQuint");
            break;
        case 65:
            $("#apps-container").stop().slideToggle(600, "easeOutQuint");
            break;
        case 72:
            loadBookmarks(0);
            break;

    }
}

loadBookmarks = function(folderID) {
    chrome.bookmarks.get(folderID.toString(), function(e){

            currentFolder = e[0];
    
            var $currentFld = $("#menu-itens a[data-folderid='" + currentFolder.id + "']");
            if ($currentFld.length > 0) {
                $("#menu-itens a[data-folderid].active").removeClass("active");
                $currentFld.addClass("active");
                $("#add-button").hide("fade");
            }
            else {
                $("#add-button").show("fade");
                $("#menu-itens a[data-folderid].active").removeClass("active");
            }

            $pgContainer = $("#page-container");
            $pgContainer.empty();

            chrome.bookmarks.getChildren(currentFolder.id, function(tree){
                fillBookmarks(tree);
            });

            if (currentFolder.id === "0") {
                fillApps()
            }

        })

}
fillBookmarks = function(tree) {
    var $pgContainer = $("#page-container");

    //Bookmarks
    var ulBookmarks = $("<ul>").addClass("icons").append($.render(tree, "bookmarks"));
    if ( $("li", ulBookmarks).length > 0) { 
        $("li", ulBookmarks).draggable({
                    start: function(event, ui) {  $("#bin").show("fade", 150); }
                    ,stop: function(event, ui) { 
                        $("#bin").hide("fade");
                        $(this).removeAttr("style");
                    }
                });
        var tit = $.render({title: currentFolder.title.toLowerCase()}, "title");
        var ele = $("<div>").append(ulBookmarks);
        $pgContainer.append(tit, ele);
    }

    //Folders    
    var ulFolders = $("<ul>").addClass("icons").append($.render(tree, "folders"));
    if ( $("li", ulFolders).length > 0) {
        $("a[data-folderid]", ulFolders).click(folderClick);
        var tit = $.render({title: chrome.i18n.getMessage("folders").toLowerCase()}, "title");
        var ele = $("<div>").append(ulFolders);
        $pgContainer.append(tit, ele);
        
    }

    updatePath();
    $pgContainer.accordion("destroy").accordion({autoHeight: false, navigation: true, event: "mouseover",animated: 'bounceslide'});;
}

fillApps = function() {
    chrome.management.getAll(function(tree){
        var ulApps = $("<ul>").addClass("icons").append($.render(tree.filter(function(e){ return e.isApp && e.enabled; } ), "apps"));
        $("a[data-appid]", ulApps).click(appClick);
        $("li ", ulApps).draggable({
                                    start: function(event, ui) {  $("#bin").show("fade", 150); }
                                    ,stop: function(event, ui) { 
                                        $("#bin").hide("fade");
                                        $(this).removeAttr("style");
                                    }
                                });
        var tit = $.render({title: chrome.i18n.getMessage("apps").toLowerCase()}, "title");
        var ele = $("<div>").append(ulApps);
        var $pgContainer = $("#page-container");
        $pgContainer.append(tit, ele)
        $pgContainer.accordion("destroy").accordion({autoHeight: false, navigation: true, event: "mouseover", animated: 'bounceslide'});

    });
}

loadFoldersMenu = function() {
    db.readTransaction(function(tx) {
        tx.executeSql("SELECT id, title FROM FoldersMenu ORDER BY orderMenu", [], function(tx, result) {
            
            var i, ht = "", $menuUL = $("#menu-itens");
            for (i = 0; result.rows.length > i; i++) {
                ht += $.render(result.rows.item(i), "folderMenu");
            }
            var $ht = $(ht);
            $ht.find("a").click(folderClick);
            $menuUL.append($ht);
            $("li a[data-folderid!='0']", $menuUL).parent().draggable({
                start: function(event, ui) {  $("#bin").show("fade", 150); }
                ,stop: function(event, ui) { 
                    $("#bin").hide("fade");
                    $(this).removeAttr("style");
                }
            });

            loadBookmarks(0);

        }, function(tx, error) {
            console.error("Failed to retrieve folders from database");
            console.dir(error);
            return;
        });
    });
}

updatePath = function() {
    
    $("#menu-path").empty();

    if (typeof currentFolder === "object")
        chrome.bookmarks.get(currentFolder.id, function(item){
            addPathItem(item[0]);
        });
    else
        $("#menu-path")
            .empty()
            .append(
                $("<li>").text(chrome.i18n.getMessage("searchFor") + ": \"" + currentFolder + "\"")
            );        
}

addPathItem = function(item) {
    
    var li;
    var $menuPath = $("#menu-path");

    if (item.id == 0)
        item.title = chrome.i18n.getMessage("root");

    if (item.id == currentFolder.id)
        li = $("<li>").text(item.title)
    else
        li = $("<li>").append( $("<a>").attr("href", "#").attr("data-folderid", item.id).click(folderClick).text(item.title) );
    
    $menuPath.prepend(li);

    if (item.parentId) {
        $menuPath.prepend( $("<li>").text(">") );
        chrome.bookmarks.get(item.parentId, function(item) {
            addPathItem(item[0]);
        });
    }
}

translatePage = function() {
    var extName = chrome.i18n.getMessage("extensionName");
    $("title").text(extName);
    $("#extInfo").text(extName + "  - v" + chrome.app.getDetails().version);

    document.getElementById("add-button").title = chrome.i18n.getMessage("addButtonTitle");
    $("[alt='__MSG_addButtonAlt__']").text(chrome.i18n.getMessage("addButtonAlt"));
    $("#bin > span").text(chrome.i18n.getMessage("dump"));
    
}