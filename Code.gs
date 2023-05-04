/*
  OSM Add On for Google Sheets

  Author: Richard Taylor (7th Lichfield Scout Group)

  License: GPL3

  Repo: https://github.com/hippysurfer/OSM-Connect

  Structure:

    OSM.gs - The core library for accessing OSM. (This should probably be a library)
    Oauth2.gs - Provides the authentication service.

    Most of the rest of the files are about providing a interface to Sheets to select sections
    and insert information into the sheets. (There is some stuff in here that is specific to my group
    you will need to tailor it accordingly.)

  TODO:

    Loads! :-)

    The subs download is hardcoded to my group :-( It needs the same section selection interface as
    the other resources.

    The flexi records are hardcoded to my group's 'Moving On' table. A more generalised approach is needed.

    I am certain the whole thing can be much better structured. (Pull requests welcome!)

  NOTE: If you use this by copy/pasting directly into a Google Sheet you will need to add the following
        2 libraries:
        
        OAuth2 - 1B7FSrk5Zi6L1rSxxTDgDEUsPzlukDsi4KGuTMorsTQHhGBzBkMun4iDF
        cUseful - 1EbLSESpiGkI3PYmJqWh3-rmLkYKAtCNPi1L2YCtMgo2Ut8xMThfJ41Ex

*/

var DEBUG = false;

var DEV_MODE = false;  // Set to true to use hardcoded OSM credentials for testing. (See Oauth2.gs)


function exception(e) {
  // record an exception
  debug("EXCEPTION: " + e.name + " " + e.message + " " + e.exception + " " + e.lineNumber)
}

function debug(msg) {
  Logger.log("DEBUG: " + msg);
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


// Utility functions

function search(nameKey,prop,  myArray){
    for (var i=0; i < myArray.length; i++) {
        if (myArray[i][prop] === nameKey) {
            return myArray[i];
        }
    }
}

