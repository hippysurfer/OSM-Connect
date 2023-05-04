

function test_register() {
  var res = action_fetch_registers(["20706", "12700"]);
  res;
}

function show_fetch_registers_dialog() {
  try {   
    var service = getOSMService();
    var osm = OSM(service).init(); 

    var template = HtmlService.createTemplateFromFile('DialogFetchRegisters');
    template.sections = osm.fetch_roles(true, 'register');    
    //.setSandboxMode(HtmlService.SandboxMode.IFRAME);
    SpreadsheetApp.getUi().showModalDialog(template.evaluate(), 'Select sections.');
  } catch(e) {
    exception(e);
  }
}


function action_fetch_registers(params) {
  try {
    var service = getOSMService();
    var osm = OSM(service).init(); 
    var all_sections = osm.fetch_roles(true, 'register');
    var sections = params.map(
      function(elem) {
        return search(elem, 'sectionid', all_sections);
      }
    );
    return register(
      function() {
        return [].concat.apply([], sections.map(
          function(section) {
            return osm.fetch_register_all_terms(section);
          }
          ));
      }
    );
  } catch(e) {
    exception(e);
    throw(e);
  }
}


function register(fetch_register_func) {
  // Get the list of flexi record tables and look for "Moving On"
  try {
    var section_data = fetch_register_func();
    var headers = [
      "section_type",
      "section_name",
      "date",
      "meeting",
      "total",
      "leaders",
      "young leaders",
      "members"];       
    var data = [headers];
    
    data = data.concat(section_data);
    
    // more efficient to set values as [][] array than individually        
    try {
      var doc = SpreadsheetApp.getActive();  
      var sheet = doc.getActiveSheet();       
      var nextRow = sheet.getActiveCell().getRow();
      sheet.getRange(nextRow, sheet.getActiveCell().getColumn(), data.length, data[0].length).setValues(data);
      SpreadsheetApp.getUi().alert('Fetch complete! Fetched:'+ data.length +' records.');
    } catch (e) {
      exception(e);
      SpreadsheetApp.getUi().alert('Fetch failed! '+ nextRow + ', ' + data.length + ', ' + data[0].length + e.name + ' ' + e.message);
    }
    
    return nextRow + data.length;  
  } catch(e) {
    exception(e);
    throw(e);
  }  
};


