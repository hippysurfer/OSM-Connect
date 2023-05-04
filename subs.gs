function action_payments() {  
  var service = getOSMService();
  var osm = OSM(service).init();

  var adult_section_id = 33593;
  var schemes = osm.fetch_schemes(adult_section_id);
 
  return payments(
    function() {
      return [].concat.apply([], schemes.map(
        function(elem) {
          return osm.fetch_payments(adult_section_id, elem);
        }))
    }
  );
  return payments;
}


function payments(fetch_payments_func) {
  try{        
    // Hardcode the headers for now.
    var headers = [
      "scoutid",
      "firstname",
      "lastname",
      "schedule",
      "payment",
      "payment_date",
      "payment_amount",
      "status"];

    var data = [headers]; 
   
    data = data.concat(
      fetch_payments_func().map(
        function(member) {        
          var row = []; 
          // loop through the header columns
          for (i in headers){
            if (headers[i] == "payment_date") {
              row.push(new Date(member['payment_date']));
            } else {
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
    exception(e);
    throw(e);
  }  
};
