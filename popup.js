var bgPage;
var tabid;
var g_ck;
var url;
var instance;
var urlFull;
var userName;
var roles;
var dtUpdateSets;
var dtUpdates;
var dtNodes;
var dtTables;
var dtDataExplore;
var dtSlashcommands;
var objCustomCommands = {};

var objSettings;
var tablesloaded = false;
var nodesloaded = false;
var dataexploreloaded = false;
var userloaded = false;
var updatesetsloaded = false;
var updatesloaded = false;
var myFrameHref;
var datetimeformat;
var table;
var sys_id;
var isNoRecord = true;


$.fn.dataTable.ext.errMode = 'none';

document.addEventListener('DOMContentLoaded', function () {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        tabid = tabs[0].id;
        var cookieStoreId = tabs[0].cookieStoreId || '';
        urlFull = tabs[0].url;
        bgPage = chrome.extension.getBackgroundPage();
        bgPage.getBrowserVariables(tabid, cookieStoreId);
    });
    document.querySelector('#firefoxoptions').href = chrome.runtime.getURL("options.html");

    if (typeof InstallTrigger !== 'undefined') $('input[type="color"]').attr('type','text') //bug in FireFox to use html5 color tag in popup

});


//Set variables, called by BG page after calling getRecordVariables
function setRecordVariables(obj) {
    console.log(obj)
    isNoRecord = !obj.myVars.hasOwnProperty('NOWsysId');
    sys_id = obj.myVars.NOWsysId || obj.myVars.mySysId;
    table = obj.myVars.NOWtargetTable;

    if (!table)
        table = (myFrameHref || urlFull).match(/com\/(.*).do/)[1].replace('_list', '');
    if (!sys_id)
        sys_id = (getParameterByName('sys_id', myFrameHref || urlFull));


    var xmllink = url + '/' + obj.myVars.NOWtargetTable + '.do?sys_id=' + obj.myVars.NOWsysId + '&sys_target=&XML';
    $('#btnviewxml').click(function () {
        chrome.tabs.create({ "url": xmllink, "active": false });
    }).prop('disabled', isNoRecord);



    $('#btnupdatesets').click(function () {
        chrome.tabs.create({ "url": url + '/sys_update_set_list.do?sysparm_query=state%3Din%20progress', "active": false });
    });


    $('#waitinglink, #waitingscript').hide();

}


//Place the key value pair in the chrome local storage, with metafield for date added.
function setToChromeStorage(theName, theValue) {
    var myobj = {};
    myobj[instance + "-" + theName] = theValue;
    myobj[instance + "-" + theName + "-date"] = new Date().toDateString();
    chrome.storage.local.set(myobj, function () {

    });
}

//Place the key value pair in the chrome sync storage.
function setToChromeSyncStorage(theName, theValue) {
    var myobj = {};
    myobj[instance + "-" + theName] = theValue;
    chrome.storage.sync.set(myobj, function () {

    });
}

//Try to get saved form state and set it
function setFormFromSyncStorage(callback) {
    var query = instance + "-formvalues";
    chrome.storage.sync.get(query, function (result) {
        if (query in result) {
            $('form').deserialize(result[query]);
        }
        callback();
    });
}

//Try to get json with servicenow tables, first from chrome storage, else via REST api
function prepareJsonTable() {
    var dataset = $('#slctdataset').val();
    var query = [instance + "-tables-" + dataset, instance + "-tables-" + dataset + "-date"];
    chrome.storage.local.get(query, function (result) {
        try {
            var thedate = new Date().toDateString();
            if (thedate == result[query[1]].toString()) {
                setDataTableTables(result[query[0]]);
            }
            else
                bgPage.getTables(dataset);
        }
        catch (err) {
            bgPage.getTables(dataset);
        }
    });
}

//Try to get json with instance nodes, first from chrome storage, else via REST api
function prepareJsonNodes() {
    var query = [instance + "-nodes", instance + "-nodes-date"];
    chrome.storage.local.get(query, function (result) {
        try {
            var thedate = new Date().toDateString();
            if (thedate == result[query[1]].toString()) {
                bgPage.getActiveNode(result[query[0]]);
            }
            else
                bgPage.getNodes($('#btnrefreshtables').val());
        }
        catch (err) {
            bgPage.getNodes($('#btnrefreshtables').val());
        }
    });
}

function getParameterByName(name, url) {
    if (!url) url = window.location.href.toLowerCase();
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
}

//Set variables, called by BG page after calling getBrowserVariables
//Also attach event handlers.
function setBrowserVariables(obj) {

    $("#snuVersion").text(chrome.runtime.getManifest().version);

    g_ck = obj.myVars.g_ck || '';
    url = obj.url;
    instance = (new URL(url)).host.replace(".service-now.com", "");
    userName = obj.myVars.NOWusername || obj.myVars.NOWuser_name;
    //roles = obj.myVars.NOWuserroles ;
    datetimeformat = obj.myVars.g_user_date_time_format;
    myFrameHref = obj.frameHref;

    setFormFromSyncStorage(function () {
        $('.nav-tabs a[data-target="' + $('#tbxactivetab').val() + '"]').tab('show');
    });

    //Attach eventlistners
    $('#btnGetUser').click(function () {
        getUserDetails(false);
    });
    //Attach eventlistners
    $('#btncreatefiles').click(function () {
        sendToSnuFileSync();
    });
    $('#tbxname').keypress(function (e) {
        if (e.which == '13') {
            e.preventDefault();
            getUserDetails(false);
        }
    });
    $('#btnrefreshtables').click(function () {
        $('#waitingtables').show();
        bgPage.getTables($('#slctdataset').val());
    });
    $('#slctdataset').on('change', function () {
        $('#waitingtables').show();
        bgPage.getTables(this.value);
        console.log(this.value);
    });
    $('#btnSendXplore').click(function () {
        var script = $('#txtgrquery').val();
        var win = chrome.tabs.create({ "url": url + "/snd_xplore.do", "active": !(event.ctrlKey || event.metaKey) }); //window.open('');
        jQuery(win).bind('load', function () {
            win.snd_xplore_editor.setValue(script);
        });
    });

    $('.snu-setting').change(function () {
        setSettings();
    });

    $('.snu-instance-setting').change(function () {
        setInstanceSettings();
    });

    $('input.snu-instance-setting').on('keyup',function () {
        setInstanceSettings();
    });


    $('#btnrefreshnodes').click(function () {
        $('#waitingnodes').show();
        bgPage.getNodes();
    });

    $('input').on('blur', function () {
        setToChromeSyncStorage("formvalues", $('form .sync').serialize());
    });

    $('select').on('change', function () {
        setToChromeSyncStorage("formvalues", $('form .sync').serialize());
    });

    $('#btnSetGRName').click(function () {
        getGRQuery();
    });
    $('#tbxgrname').keypress(function (e) {
        if (e.which == '13') {
            e.preventDefault();
            getGRQuery();
        }
    });
    $('#tbxgrtemplate, #cbxtemplatelines, #cbxfullvarname').change(function (e) {
        getGRQuery();
    });

    $('a.popuplinks').click(function () {
        event.preventDefault();
        chrome.tabs.create({ "url": $(this).attr('href'), "active": !(event.ctrlKey || event.metaKey) });
    });

    $('#slashcommands').on('dblclick',function(){
        $(this).prop('readonly','');
    })

    $('#iconallowbadge').on('change',function(){
       iconSettingsDiv($(this).prop('checked'));
    })

    // $('#addtechnicalnames').on('change', function (e) {
    //     technicalNamesShowRegex();
    // });

    


    $.fn.dataTable.moment('DD-MM-YYYY HH:mm:ss');
    $.fn.dataTable.moment(datetimeformat);

    $('a[data-toggle="tab"]').on('shown.bs.tab', function (e) {
        var target = $(e.target).data("target"); // activated tab

        $('#tbxactivetab').val(target);
        setToChromeSyncStorage("formvalues", $('form .sync').serialize());

        switch (target) {
            case "#tabupdatesets":
                if (!updatesetsloaded) {
                    $('#waitingupdatesets').show();
                    bgPage.getUpdateSets();
                    updatesetsloaded = true;
                }
                $('#tbxupdatesets').focus(function () {
                    $(this).select();
                });
                break;
            case "#tabupdates":
                if (!updatesloaded) {
                    $('#waitingupdates').show();
                    bgPage.getUpdates(userName);

                    updatesloaded = true;
                }
                $('#tbxupdates').focus(function () {
                    $(this).select();
                });
                break;
            case "#tabnodes":
                if (!nodesloaded) {
                    $('#waitingnodes').show();
                    prepareJsonNodes();
                    nodesloaded = true;
                }
                $('#tbxnodes').focus(function () {
                    $(this).select();
                });
                break;
            case "#tabtables":
                $('#tbxtables').focus(function () {
                    $(this).select();
                }).focus();
                if (!tablesloaded) {
                    $('#waitingtables').show();
                    prepareJsonTable();
                    tablesloaded = true;
                }

                break;
            case "#tabdataexplore":
                if (!dataexploreloaded) {
                    $('#waitingdataexplore').show();
                    bgPage.getExploreData();
                    dataexploreloaded = true;
                }
                $('#tbxdataexplore').focus(function () {
                    $(this).select();
                });
                break;
            case "#tablink":
                $('#waitinglink').show();
                bgPage.getRecordVariables();
                break;
            case "#tabgr":
                getGRQuery();
                break;
            case "#tabuser":
                if (!userloaded) {
                    if ($('#tbxname').val().length > 0)
                        getUserDetails(false);
                    userloaded = true;
                }
                $('#tbxname').focus(function () {
                    $(this).select();
                });
                break;
            case "#tabsettings":
                if (typeof InstallTrigger !== 'undefined') {
                    jQuery(".hide-in-chrome").css('display', 'inline');
                }
                getSettings(function(){});
                getInstanceSettings();
                break;
            case "#tabslashcommands":
                getSlashcommands();
                setSampleCommandHref();
                break;
            case "#tabwhitelist":
                getSettings(function(){});
                break;
        }

    });

    $('#helperslashcommands').on('click', function () {
        $('#navslashcommands').click();
    })

    chrome.tabs.sendMessage(tabid, { method: "getSelection" }, function (selresponse) {
        var selectedText = ('' + selresponse.selectedText).trim();
        if (selectedText.length > 0 && selectedText.length <= 30)
            getUserDetails(selectedText);

    });


}




//Set message, on about tab, callback from getInfoMessage
function setInfoMessage(html) {
    $('#livemessage').html(html);
}

function getSettings(callback) {
    bgPage.getFromSyncStorageGlobal("snusettings", function (settings) {
        objSettings = settings || {};
        for (var setting in settings) {

            try {
            if (typeof settings[setting] == "boolean")
                document.getElementById(setting).checked = settings[setting];
            else
                document.getElementById(setting).value = settings[setting];
            }
            catch (ex) { //property removed
            }
        };
        iconSettingsDiv($('#iconallowbadge').prop('checked')); 
        //technicalNamesShowRegex();
        callback();
    })
}

function setSettings() {
    var snusettings = {};
    $('.snu-setting').each(function (index, item) {
        if (this.type == 'checkbox') {
            snusettings[this.id] = this.checked;
        }
        else {
            snusettings[this.id] = this.value;
        }

    });
    bgPage.setToChromeSyncStorageGlobal("snusettings", snusettings);
}

function setInstanceSettings() {
    var snuinstancesettings = {};
    $('.snu-instance-setting').each(function (index, item) {
        snuinstancesettings[this.id] = this.value;
    });
    bgPage.setToChromeSyncStorage("snuinstancesettings", snuinstancesettings);
    applyFavIconBadge(snuinstancesettings);
}

function getInstanceSettings() {

    bgPage.getFromSyncStorage("snuinstancesettings", function(settings){
        objSettings = settings || {};
        for (var setting in settings) {

            if (typeof settings[setting] == "boolean")
                document.getElementById(setting).checked = settings[setting];
            else
                document.getElementById(setting).value = settings[setting];
        };
        applyFavIconBadge(settings);

    });
    $('#instancename').text(instance);
}

function iconSettingsDiv(visible){
    if (visible)
        $('#iconsettingsdiv').show();
    else 
        $('#iconsettingsdiv').hide();
}

function applyFavIconBadge(settings){
    document.getElementById("icontext").style.backgroundColor = settings.iconcolorbg; 
    document.getElementById("icontext").style.color = settings.iconcolortext; 

    chrome.tabs.sendMessage(tabid, { method: "setFavIconBadge", options: settings }, function () {});

}

function setSampleCommandHref() {
    
    var newHref = myFrameHref || urlFull;
    if ((newHref.split('?')[0]).indexOf('_list.do') > 1) {
        bgPage.getListUrl();
    }
    else {
        if (newHref.includes('.do?')) //allow page with .do in url to default to the UI16 iframe
            newHref = newHref.replace(url + '/','');
        else 
            newHref = newHref.replace(url,'');
        setListUrl(newHref, '');
    }
}

function setListUrl(listUrl, tableLabel, fields){
    var hrf = document.getElementById('cmdforma');
    hrf.href = url + '/' + listUrl
    hrf.innerText =listUrl;
    hrf.setAttribute('data-tablelabel', tableLabel);

    hrf.onclick = function(e) { 
        e.preventDefault();
        document.getElementById('tbxslashurl').value = this.innerText;
        if (tableLabel)
            document.getElementById('tbxslashhint').value = this.getAttribute('data-tablelabel') + ' <search>';
        document.getElementById('tbxslashcmd').value = '';
        document.getElementById('tbxslashfields').value = fields;
        document.getElementById('tbxslashcmd').focus();
        slashCommandShowFieldField();
    };

}

function getGRQuery() {

    var newHref = myFrameHref || urlFull;
    if ((newHref.split('?')[0]).indexOf('_list.do') > 1) {
        bgPage.getGRQuery($('#tbxgrname').val(), $('#tbxgrtemplate').val(),
            document.getElementById('cbxtemplatelines').checked,
            document.getElementById('cbxfullvarname').checked);
    }
    else {
        bgPage.getGRQueryForm($('#tbxgrname').val(), $('#tbxgrtemplate').val(),
            document.getElementById('cbxtemplatelines').checked,
            document.getElementById('cbxfullvarname').checked);
    }
}

function setGRQuery(gr) {
    if (gr.indexOf("GlideRecord('undefined')") > -1) gr = "This only works in forms and lists.";
    $('#txtgrquery').val(gr).select();
}






//Initiate Call to servicenow rest api
function getUserDetails(usr) {
    if (!usr) usr = $('#tbxname').val();
    $('#tbxname').val(usr);
    $('#waitinguser').show();
    bgPage.getUserDetails(usr);
}

//Set the user details table
function setUserDetails(html) {
    $('#rspns').html(html);

    if ($('#createdby').length > 0) {
        $('.nav-tabs a[data-target="#tabuser"]').tab('show');
        $('#createdby').click(function () {
            var usr = $(this).data('username');
            $('#tbxname').val(usr).focus(function () {
                $(this).select();
            });

            bgPage.getUserDetails(usr);
        });
    }
    else
        $('#tbxname').val('');

    $('#waitinguser').hide();
}

//set or refresh datatable with ServiceNow updatesets
function setDataTableUpdateSets(nme) {

    if (nme == 'error') {
        $('#updatesets').hide().after('<br /><div class="alert alert-danger">Data can not be retrieved, are you Admin?</div>');
        $('#waitingupdatesets').hide();
        return false;
    }

    $('#btnnewupdateset').attr('href', url + '/nav_to.do?uri=%2Fsys_update_set.do%3Fsys_id%3D');
    $('#btnopenupdatesets').attr('href', url + '/nav_to.do?uri=%2Fsys_update_set_list.do?sysparm_query=state%3Din%20progress');

    if (dtUpdateSets) dtUpdateSets.destroy();
    dtUpdateSets = $('#updatesets').DataTable({
        "aaData": nme.result.updateSet,
        "aoColumns": [
            { "mDataProp": "name" },
            {
                mRender: function (data, type, row) {
                    var iscurrent = "";
                    if (row.sysId == nme.result.current.sysId) iscurrent = "iscurrent";
                    return "<a class='updatesetlist' href='" + url + "/nav_to.do?uri=sys_update_set.do?sys_id=" + row.sysId + "' title='Table definition' ><i class='fas fa-list' aria-hidden='true'></i></a> " +
                        "<a class='setcurrent " + iscurrent + "' data-post='{name: \"" + row.name + "\", sysId: \"" + row.sysId + "\"}' href='#" + row.sysId + "' title='Set current updateset'><i class='far fa-dot-circle' aria-hidden='true'></i></a> ";
                },
                "width": "7%",
                "searchable": false
            }
        ],
        "drawCallback": function () {
            var row0 = $("#updatesets tbody tr a.iscurrent").closest('tr').clone();
            $('#updatesets tbody tr:first').before(row0.css('background-color', '#86ED78'));
        },
        "language": {
            "info": "Matched: _TOTAL_ of _MAX_ updatesets | Hold down CMD or CTRL to keep window open after clicking a link",
            "infoFiltered": "",
            "infoEmpty": "No matches found"
        },
        "bLengthChange": false,
        "bSortClasses": false,
        "scrollY": "200px",
        "scrollCollapse": true,
        "paging": false

    });

    $('#tbxupdatesets').keyup(function () {
        dtUpdateSets.search($(this).val()).draw();
    }).focus().trigger('keyup');

    $('a.updatesetlist').click(function () {
        event.preventDefault();
        chrome.tabs.create({ "url": $(this).attr('href'), "active": !(event.ctrlKey || event.metaKey) });
    });

    $('a.setcurrent').click(function () {
        $('#waitingupdatesets').show();
        bgPage.setUpdateSet($(this).data('post'));
    });

    $('#waitingupdatesets').hide();

}


function setNodes(jsn) {

    if (typeof jsn == "undefined" || jsn == "error") {
        $('#instancenodes').hide().after('<br /><div class="alert alert-danger">Nodes data can not be retrieved, are you Admin?</div>');
        $('#waitingnodes').hide();
        return false;
    }

    setToChromeStorage("nodes", jsn);
    bgPage.getActiveNode(jsn);
}

//set or refresh datatable with ServiceNow updatesets
function setDataTableNodes(nme, node) {


    if (dtNodes) dtNodes.destroy();
    dtNodes = $('#instancenodes').DataTable({
        "aaData": nme,
        "aoColumns": [
            {
                mRender: function (data, type, row) {
                    return row.system_id.split(":")[1];
                }
            },
            { "mDataProp": "system_id" },
            { "mDataProp": "status" },
            {
                mRender: function (data, type, row) {
                    var iscurrent = (row.node_id == node);
                    return "<a class='setnode " + (iscurrent ? "iscurrent" : "") + "' data-node='" + row.system_id + "' href='#' id='" + row.node_id + "' title='Switch to Node'><i class='far fa-dot-circle' aria-hidden='true'></i>" + (iscurrent ? " Active Node" : " Set Active") + "</a> ";
                },
                "searchable": false
            }
        ],
        "bLengthChange": false,
        "bSortClasses": false,
        "scrollY": "200px",
        "scrollCollapse": true,
        "paging": false

    });

    $('#tbxnodes').keyup(function () {
        dtNodes.search($(this).val()).draw();
    }).focus().trigger('keyup');

    $('a.setnode').click(function () {
        bgPage.setActiveNode(this.id, $(this).attr('data-node'));
    });

    $('#waitingnodes').hide();

}

//set or refresh datatable with ServiceNow tables
function setDataTableUpdates(nme) {

    if (nme == 'error') {
        $('#updts').hide().after('<br /><div class="alert alert-danger">Data can not be retrieved, are you Admin?</div>');
        $('#waitingupdates').hide();
        return false;
    }

    if (dtUpdates) dtUpdates.destroy();

    dtUpdates = $('#updts').DataTable({
        "aaData": nme.result,
        "aoColumns": [
            { "mDataProp": "type" },
            { "mDataProp": "target_name" },
            { "mDataProp": "sys_updated_on" },
            { "mDataProp": "update_set\\.name" },
            {
                mRender: function (data, type, row) {
                    var i = row.name.lastIndexOf("_");
                    return "<a class='updatetarget' href='" + url + "/" + row.name.substr(0, i) + ".do?sys_id=" + row.name.substr(i + 1) + "' title='Open related record' ><i class='fas fa-edit' aria-hidden='true'></i></a> " +
                        "<a class='updatetarget' href='" + url + "/sys_update_xml.do?sys_id=" + row.sys_id + "' title='View update' ><i class='fas fa-history' aria-hidden='true'></i></a> ";
                },
                "width": "7%",
                "searchable": false
            }
        ],
        "language": {
            "info": "Matched: _TOTAL_ of _MAX_ updates | Hold down CMD or CTRL to keep window open after clicking a link",
            "infoFiltered": "",
            "infoEmpty": "No matches found"
        },
        "bLengthChange": false,
        "bSortClasses": false,
        "scrollY": "200px",
        "scrollCollapse": true,
        "order": [[2, "desc"]],
        "paging": false

    });


    $('a.updatetarget').click(function () {
        event.preventDefault();
        chrome.tabs.create({ "url": $(this).attr('href'), "active": !(event.ctrlKey || event.metaKey) });
    });

    $('#tbxupdates').keyup(function () {
        dtUpdates.search($(this).val()).draw();
    }).focus().trigger('keyup');


    $('#waitingupdates').hide();
}


//add object to storage and refresh datatable
function setTables(dataset, jsn) {
    setToChromeStorage("tables-" + dataset, jsn);
    setDataTableTables(jsn);
}



//set or refresh datatable with ServiceNow tables
function setDataTableTables(nme) {

    if (dtTables) {
        dtTables.destroy();
        $('#tbls thead tr .dyna').remove();
        $('#tbls tbody tr').remove();
    }

    var columnDefs = [
        { "width": "46%", "targets": 0 },
        { "width": "46%", "targets": 1 },
        { "width": "8%", "targets": 2 }
    ];

    var aoColumns = [
        { "mDataProp": "label" },
        { "mDataProp": "name" },
        {
            mRender: function (data, type, row) {
                return "<a class='tabletargetlist' href='" + url + '/' + row.name + "_list.do' title='Go to List (Using query selected below)' ><i class='fas fa-table' aria-hidden='true'></i></a> " +
                    "<a class='tabletarget' href='" + url + "/nav_to.do?uri=sys_db_object.do?sys_id=" + row.name + "%26sysparm_refkey=name' title='Go to table definition' ><i class='fas fa-cog' aria-hidden='true'></i></a> " +
                    "<a class='tabletarget' href='" + url + "/generic_hierarchy_erd.do?sysparm_attributes=table_history=,table=" + row.name + ",show_internal=true,show_referenced=true,show_referenced_by=true,show_extended=true,show_extended_by=true,table_expansion=,spacing_x=60,spacing_y=90,nocontext' title='Show Schema Map'><i class='fas fa-sitemap' aria-hidden='true'></i></a>";
            },
            "searchable": false
        }
    ]

    if (nme.length) {
        if (nme[0].hasOwnProperty("super_classname")) {
            aoColumns.splice(2, 0, { "mDataProp": "super_classname" });
            aoColumns.splice(3, 0, { "mDataProp": "sys_scopescope" });
            $('th#thaction').after('<th class="dyna">Extends</th><th class="dyna">Scope</th>');

            var columnDefs = [
                { "width": "25%", "targets": 0 },
                { "width": "24%", "targets": 1 },
                { "width": "24%", "targets": 2 },
                { "width": "18%", "targets": 3 },
                { "width": "9%", "targets": 4 }
            ];

        }
    }

    dtTables = $('#tbls').DataTable({
        "aaData": nme,
        "columnDefs": columnDefs,
        "aoColumns": aoColumns,
        "bAutoWidth": false,
        "language": {
            "info": "Matched: _TOTAL_ of _MAX_ tables, showing max 250 | Hold down CMD or CTRL to keep window open after clicking a link ",
            "infoFiltered": "",
            "infoEmpty": "No matches found"
        },
        "bLengthChange": false,
        "bSortClasses": false,
        "scrollY": "200px",
        "scrollCollapse": true,
        "pageLength": 250,
        //"paging": false,
        "dom": 'rti<"btns"B>',
        "buttons": [
            "copyHtml5"
        ]

    });

    dtTables.on('draw.dt', function () {
        $('a.tabletargetlist:not(.evented)').click(function () {
            event.preventDefault();
            var url = $(this).attr('href') + "?sysparm_query=" + $('#slctlistquery').val();
            if (url.indexOf("syslog") > 1) {
                url = url.replace(/sys_updated_on/g, 'sys_created_on'); //syslog tables have no updated columnn.
            }
            chrome.tabs.create({ "url": url, "active": !(event.ctrlKey || event.metaKey) });
        }).addClass('evented');

        $('a.tabletarget:not(.evented)').click(function () {
            event.preventDefault();
            chrome.tabs.create({ "url": $(this).attr('href'), "active": !(event.ctrlKey || event.metaKey) });
        }).addClass('evented');
    });


    $('#tbxtables').keyup(function () {
        dtTables.search($(this).val()).draw();
    }).focus().trigger('keyup');


    $('#waitingtables').hide();
}

var dataslashcommands;
function getSlashcommands() {

    getSettings(function () { //sorry for throwing this in callback, not a star in async stuff :(

        dataslashcommands = Object.keys(snuslashcommands).map(function (key) {
            var source = "2builtin";
            var url = snuslashcommands[key].url;
            var fields = snuslashcommands[key].fields;
            var order = snuslashcommands[key].order;
            var overwriteurl = snuslashcommands[key].overwriteurl;
            if (url.startsWith('*')) {
                source = "3script";
                url = 'Built in scripted command, cannot be overwritten';
            };
            return { "command": key, "url": url, "hint": snuEncodeHtml(snuslashcommands[key].hint), "fields": fields, "overwriteurl" : overwriteurl,  "source": source, "order" : order  };
        });

        try {
            objCustomCommands = JSON.parse(objSettings.slashcommands);
        } catch (e) { };

        Object.keys(objCustomCommands).forEach(function (key) {
            dataslashcommands.push({ "command": key, "url": objCustomCommands[key].url, "hint": snuEncodeHtml(objCustomCommands[key].hint), "fields": objCustomCommands[key].fields, "overwriteurl" : objCustomCommands[key].overwriteurl, "order" : objCustomCommands[key].order,  "source": "1custom" });
        });


        if (dtSlashcommands) dtSlashcommands.destroy();
        dtSlashcommands = $('#tblslashcommands').DataTable({
            "aaData": dataslashcommands,
            "aoColumns": [
                {
                    mRender: function (data, type, row) {
                        var icon = '<span class="hidden">' + row.source + '</span><i title="Built in command" class="fas fa-chevron-circle-right"></i>';
                        if (row.source == '1custom') icon = '<span class="hidden">' + row.source + '</span><i title="Custom command" class="fas fa-user-circle"></i>';
                        if (row.source == '3script') {
                            icon = '<span class="hidden">' + row.source + '</span><i title="Built in read-only" class="fas fa-stop-circle"></i>';
                        };
                        return "<div>" + icon + "</div>";
                    },
                    "width": "3%",
                    "bSearchable": true,
                    "mDataProp": "source"

                },
                { "mDataProp": "command" },
                {
                    mRender: function (data, type, row) {
                        return "<div>" + row.hint + "</div><div class='snucmdurl'>" + row.url + "</div>";
                    }
                },
                {
                    mRender: function (data, type, row) {

                        var html = ''
                        if (row.source == "1custom" || row.source == "2builtin") {
                            html += "<a href='#'><i class='fas fa-edit' aria-hidden='true'></i></a> "
                        }
                        if (row.source == "1custom") {
                            html += "<a class='deletecmd' href='#' data-cmd='"+ row.command +"' ><i class='far fa-trash-alt ' aria-hidden='true'></i></a>"
                        }
                        html += `<div class='snucmdurl'>${(row.order || 100)}</div>`;
                        return html;
                    },
                    "width": "10%",
                    "searchable": false,
                    "mDataProp": "order"
                }

            ],
            "language": {
                "info": "Matched: _TOTAL_ of _MAX_ slashcommands <a id='downloadcommands' href='javavscript:'>Backup custom slashcommands</a>",
                "infoFiltered": "",
                "infoEmpty": "No matches found"
            },
            "rowCallback": function (row, data) {

                if (data.source != '3script') {

                    $(row).on('click', function (e) {
                        $('#divslashmsg').text('');
                        var row = dtSlashcommands.row(this).data();
                        $('#tbxslashcmd').val(row.command);
                        $('#tbxslashurl').val(row.url);
                        $('#tbxslashhint').val(snuDecodeHtml(row.hint));
                        $('#tbxslashfields').val(snuDecodeHtml(row.fields));
                        $('#tbxslashorder').val(snuDecodeHtml(row.order));
                        $('#tbxslashoverwriteurl').val(snuDecodeHtml(row.overwriteurl));
                        $('#cmdformhelpprefill').hide();
                        slashCommandShowFieldField();
                    });

                }

            },
            "bLengthChange": false,
            "bSortClasses": false,
            "scrollY": "200px",
            "scrollCollapse": true,
            "paging": false

        });

        $('#tbxslashcommands').keyup(function () {
            dtSlashcommands.search($(this).val()).draw();
        }).focus().trigger('keyup');

        $('a.deletecmd').on('click', function (e) {

            event.preventDefault();
            var cmd = $(this).data('cmd');
            if (!confirm("Delete command " + cmd + "?")) return;
            delete objCustomCommands[cmd];
            $('#slashcommands').val(JSON.stringify(objCustomCommands));
            setSettings();
            getSlashcommands();
        
        });

        $('#tbxslashurl').on('change', function (e) {
            slashCommandShowFieldField();
        });

        
        if (JSON.stringify(objCustomCommands).length > 2){
            $('#downloadcommands').on('click', downloadCommands).show();
        }
        else {
            $('#downloadcommands').hide();
        }

        $('button#btnsaveslashcommand').click(function () {

            event.preventDefault();
            $('#divslashmsg').text('');
            var cmds = {};
            try {
                cmds = JSON.parse($('#slashcommands').val());
            } catch (e) { };
            var cmdname = $('#tbxslashcmd').val().replace(/[^a-zA-Z0-9]/gi, '').toLowerCase();
            if (!cmdname){
                $('#divslashmsg').text('No command name defined');
                return;
            }
            cmds[cmdname] = {
                "url": $('#tbxslashurl').val(),
                "hint": $('#tbxslashhint').val(),
                "fields" : $('#tbxslashfields').val(),
                "order" : Number($('#tbxslashorder').val()),
                "overwriteurl" : $('#tbxslashoverwriteurl').val()
            };
            $('#slashcommands').val(JSON.stringify(cmds));

            objSettings.slashcommands = cmds;

            //send the update command direct to the browser, without need for reload
            var details = {
                "action" : "updateSlashCommand",
                "cmdname" : cmdname,
                "cmd" : cmds[cmdname]
            }
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                chrome.tabs.sendMessage(tabs[0].id, { 
                    "method" : "snuUpdateSettingsEvent", 
                    "detail" : details }, 
                response => { });
            });

            setSettings();
            getSlashcommands();

        });

    });

}

//set or refresh datatable with ServiceNow tables
function setDataExplore(nme) {

    Object.entries(nme).forEach( // add check of empty fields to be able to filter out
        ([key, obj]) => {
            nme[key].hasdata = (obj.value || obj.display_value) ? "hasdata" : "";
        }
    );
    
    if (dtDataExplore) dtTables.destroy();
    //$('#dataexplore').html(nme);
    dtDataExplore = $('#dataexplore').DataTable({
        "aaData": nme,
        "aoColumns": [

            { "mDataProp": "meta.label" },
            { "mDataProp": "name" },
            {
                mRender: function (data, type, row) {
                    var reference = "<div class='refname'>" + row.meta.reference + "</div>";
                    if (reference.includes('undefined')) reference = '';
                    return row.meta.type + reference;
                },

                "bSearchable": true,
                "mDataProp": "meta.type"

            },
            { "mDataProp": "value" },
            { "mDataProp": "display_value" },
            { "mDataProp": "hasdata" }
        ],
        "language": {
            "info": "Matched: _TOTAL_ of _MAX_ fields | Hold down CMD or CTRL to keep window open after clicking a link",
            "infoFiltered": "",
            "infoEmpty": "No matches found"
        },
        "bLengthChange": false,
        "bSortClasses": false,
        "scrollY": "200px",
        "scrollCollapse": true,
        "paging": false,
        "dom": 'rti<"btns"B>',
        "buttons": [
            "copyHtml5",
            {
                text: 'Toggle Type',
                action: function (e, dt, node, config) {
                    var vis = !dtDataExplore.column(2).visible();
                    dtDataExplore.column(2).visible(vis);

                }
            }
        ]

    });
    
    dtDataExplore.column(5).visible(false);

    $('#tbxdataexplore').keyup(function () {
        var srch = ($('#cbxhideempty').prop('checked') ? "hasdata " : "") + $('#tbxdataexplore').val();
        dtDataExplore.search(srch).draw();
    }).focus().trigger('keyup');

    
    $('#cbxhideempty').change(function (e) {
        var srch = ($('#cbxhideempty').prop('checked') ? "hasdata " : "") + $('#tbxdataexplore').val();
        dtDataExplore.search(srch).draw();
    });

    $('a.referencelink').click(function () {
        event.preventDefault();
        chrome.tabs.create({ "url": $(this).attr('href'), "active": !(event.ctrlKey || event.metaKey) });
    });

    $('#waitingdataexplore').hide();

}

function slashCommandShowFieldField(){
    if ($('#tbxslashurl').val().includes('sysparm_query=')){
        $('.showfields').show();

    }
    else{
        $('.showfields').hide();
    }       
}

function downloadCommands() {
    var text = document.getElementById('slashcommands').value;
    if (text.length < 5){
        alert("No custom commands found");
        return;
    } 
    var text = JSON.stringify(JSON.parse(text),4,4);
    var element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', "slashcommands.json.txt");
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }

  function technicalNamesShowRegex(){
        // if (document.getElementById('addtechnicalnames').checked){
        //     $('#technicalnamesregexdiv').show();
        // }
        // else{
        //     $('#technicalnamesregexdiv').hide();
        // }       
    }