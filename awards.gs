
function test_awards() {
 
  //logout();  // Reset Oauth tokens
 
  action_fetch_awards(["12700"]);
}

function show_fetch_awards_dialog() {
  logout();
  var service = getOSMService();
  var osm = OSM(service).init();
  try {    
    var template = HtmlService.createTemplateFromFile('DialogFetchAwards');
    template.sections = osm.fetch_roles(true, 'badge');    
    //.setSandboxMode(HtmlService.SandboxMode.IFRAME);
    SpreadsheetApp.getUi().showModalDialog(template.evaluate(), 'Select sections.');
  } catch(e) {
    exception(e);
  }
}

function action_fetch_awards(params) {
  var service = getOSMService();
  var osm = OSM(service).init();

  var all_sections = osm.fetch_roles(true, 'badge');

  var sections = params.map(
    function(elem) {
      return search(elem, 'sectionid', all_sections);
    }
  );
  return awards(
    function() {
      return [].concat.apply([], sections.map(
        function(elem) {
          return osm.fetch_awards(elem);
          }
        ));
    }
  );
}



function awards(fetch_awards_func) {
  try{        
    // Hardcode the headers for now.
    var headers = [
      "section_type",
      "section_name",
      "scoutid",
      "firstname",
      "lastname",
      "completed",
      "awarded",
      "awardeddate",
      "award_name"
      ];

    var data = [headers];
    
   
    data = data.concat(
      fetch_awards_func().map(
        function(member) {        
          var row = []; 
          // loop through the header columns
          for (var i in headers){
            if (headers[i] == "awardeddate") {
              row.push(new Date(member['awardeddate']));            
            } else { // else use header name to get data
              var cell = member[headers[i]];
              if (cell != undefined) {
                row.push(cell);
              } else {
                row.push('');
              };
            };
          }
          return row;
        }
      )
    );
    
    var doc = SpreadsheetApp.getActive();
    var sheet = doc.getActiveSheet(); 
    var nextRow = sheet.getActiveCell().getRow();
    
    // more efficient to set values as [][] array than individually
    sheet.getRange(nextRow, sheet.getActiveCell().getColumn(), data.length, data[0].length).setValues(data);
    
    SpreadsheetApp.getUi().alert('Fetch complete! Fetched:'+ data.length +' records.');
    
    return nextRow + data.length;
  } catch(e) {
    var f = e; // make exception available in debugger
    Logger.log(e);
    exception(e);
    throw(e);
  }  
};

