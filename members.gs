function OSMFETCHMEMBERS() {
  var result = [];
  result.push(["one","two"]);
  return result;
}

function test_members() {
 
  //logout();  // Reset Oauth tokens
 
  action_fetch_members(["12700"]);
}

function show_fetch_members_dialog() {
  logout();
  var service = getOSMService();
  var osm = OSM(service).init();
  try {    
    var template = HtmlService.createTemplateFromFile('DialogFetchMembers');
    template.sections = osm.fetch_roles(true, 'member');    
    //.setSandboxMode(HtmlService.SandboxMode.IFRAME);
    SpreadsheetApp.getUi().showModalDialog(template.evaluate(), 'Select sections.');
  } catch(e) {
    exception(e);
  }
}

function action_fetch_members(params) {
  var service = getOSMService();
  var osm = OSM(service).init();

  var all_sections = osm.fetch_roles(true, 'member');

  var sections = params.map(
    function(elem) {
      return search(elem, 'sectionid', all_sections);
    }
  );
  return members(
    function() {
      return [].concat.apply([], sections.map(
        function(elem) {
          return osm.fetch_members(elem);
          }
        ));
    }
  );
}



function members(fetch_members_func) {
  try{        
    // Hardcode the headers for now.
    var headers = [
      "section_type",
      "section_name",
      "member_id",
      "first_name",
      "last_name",
      "date_of_birth",
      "patrol",
      "started",
      "joined",
      "age",
      "sex",
      "subs"];

    var data = [headers];
    
   
    data = data.concat(
      fetch_members_func().map(
        function(member) {        
          var row = []; 
          // loop through the header columns
          for (i in headers){
            if (headers[i] == "Timestamp"){ // special case if you include a 'Timestamp' column
              row.push(new Date());
            } else if (headers[i] == "date_of_birth") {
              row.push(new Date(member['date_of_birth']));
            } else if (headers[i] == "sex") {
              row.push(member['custom_data'][7]["34"]); // You just have to know that it is here!
            } else if (headers[i] == "subs") {
              row.push(member['custom_data'][5]["8709"]); // You just have to know that it is here!
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

