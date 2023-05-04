
var DEBUG = true;

var DEV_MODE = false;
// var DEV_MODE = true;   // Set to true to use hardcoded OSM credentials for testing.

function exception(e) {
  // record an exception
  debug("EXCEPTION: " + e.name + " " + e.message + " " + e.exception + " " + e.lineNumber)
}

function api_error(url, options, error) {
  Logger.log("API ERROR: url="+ url + " keys="+ options + " code=" + error["code"] + " message=" + error["message"]);
}

function debug(msg) {
  Logger.log("DEBUG: " + msg);
}

function sheet_log(message) {
  try {
    var ss = SpreadsheetApp.getActive();  
    var log_sheet = ss.getSheetByName("Log");
    var rowData = [];
    rowData.push(new Date());
    rowData.push(message);
    log_sheet.appendRow(rowData);
  } catch(e) {
    Logger.log("SHEET_LOG: "+ message);
  }
}

function onInstall(e) {
  opOpen(e);
}

function use() {
  // Caused authorisation dialog to prompt user.
  onOpen();
}

function onOpen(e) {
  try {
    var ui = SpreadsheetApp.getUi();
    var menu = ui.createMenu('OSM');
    
    if (e && (e.authMode == ScriptApp.AuthMode.NONE )) {
      menu.addItem("Enable", "use");
    } else if (!has_creds()) {      
      menu.addItem('Authorise', 'authorise');      
    } else {      
      menu.addItem("Fetch Members ...", "show_fetch_members_dialog");
      menu.addItem("Fetch Movers ...", "show_fetch_movers_dialog");
      menu.addItem("Fetch Event ...", "show_fetch_event_dialog");
      menu.addItem("Fetch Registers ...", "show_fetch_registers_dialog");
      menu.addItem("Fetch Payments ...", "action_payments");
      menu.addItem("Fetch MailMerge ...", "show_fetch_mailmerge_dialog");
      menu.addSeparator();
      menu.addItem("De-authorise", "remove_creds");      
    }
    menu.addToUi();
  } catch(e) {
    exception(e);
  }
}



function search(nameKey,prop,  myArray){
    for (var i=0; i < myArray.length; i++) {
        if (myArray[i][prop] === nameKey) {
            return myArray[i];
        }
    }
}

