function test_fetch_all_events() {
  //logout();  // Reset Oauth tokens
  fetch_all_events();
}

function fetch_all_events() {
  var service = getOSMService();
  var osm = OSM(service).init();

  return osm.fetch_all_events(true, 'events');
}




function show_fetch_event_dialog() {
  try {
    var service = getOSMService();
    var osm = OSM(service).init();

    var template = HtmlService.createTemplateFromFile('DialogFetchEvent');
    template.events = osm.fetch_uniq_event_names();
    SpreadsheetApp.getUi().showModalDialog(template.evaluate(), 'Select event.');
  } catch (e) {
    exception(e);
  }
}

function test_fetch_event() {
  action_fetch_event("Remembrance Day Parade");
}

function action_fetch_event(event_name) {
  var service = getOSMService();
  var osm = OSM(service).init();

  // Get list of all sections that contain the event
  var events = osm.fetch_all_events();
  events = events.filter(
    function (value, index, self) {
      return value.name === event_name;
    }
  );

  // Fetch the event details and populate spreadsheet
  return event(
    function () {
      return [].concat.apply([], events.map(
        function (elem) {
          return osm.fetch_event_details(elem);
        }
      ));
    }
  );
}

//function test_fetch() {
//  var patrols = fetch("ext/settings/patrols/?action=get&sectionid=20706").patrols; 
//  var patrol = search('-2', 'patrolid', patrols);
//  var result = fetch("ext/events/event/?action=getAttendance&eventid=348808&sectionid=20706&termid=172620");
//  patrol = search(result.items[0].patrolid.toString(), 'patrolid', patrols);
//  1+1
//}

function findall_keys(list_of_objects) {
  // Returns the unique list of all keys in all of the objects in 
  // the list_of_objects.
  function removeDups(array) {
    var outArray = [];
    array.sort();
    outArray.push(array[0]);
    for (var n in array) {
      if (outArray[outArray.length - 1] != array[n]) {
        outArray.push(array[n]);
      }
    }
    return outArray;
  }

  var res = [];
  list_of_objects.forEach(
    function (obj) {
      for (k in obj) {
        res.push(k);
      }
    }
  );
  return removeDups(res);
}


function event(fetch_func) {
  // var ss = SpreadsheetApp.getActive();
  //  
  // var log_sheet = ss.getSheetByName("Log");
  //  
  // var log = function(message) {
  //   var rowData = [];
  //   rowData.push(new Date());
  //   rowData.push(message);
  //   log_sheet.appendRow(rowData);
  // }
  // Get the list of flexi record tables and look for "Moving On"
  try {
    var event_data = fetch_func();
    var headers = findall_keys(event_data);
    var data = [headers];

    data = data.concat(event_data.map(function (member) {
      var row = [];
      // loop through the header columns
      for (i in headers) {
        if (headers[i] == "Timestamp") { // special case if you include a 'Timestamp' column
          row.push(new Date());
        } else if (headers[i] == "dob") {
          row.push(new Date(member[headers[i]]));
        } else if (headers[i] == "section_name") {
          row.push(section_name);
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
    }));

    // Find max number of columns
    var max_column = data.reduce(function (prev, elem) {
      return Math.max(prev, elem.length);
    }, 0);

    // Find min number of columns
    var min_column = data.reduce(function (prev, elem) {
      return Math.min(prev, elem.length);
    }, Infinity);

    // If any rows are shorter than max, pad them with extra empty element.

    data = data.map(function (member) {
      if (member.length < max_column) {
        var count = max_column - member.length;
        while (count > 0) {
          member.push("");
          count--;
        };
      }
      return member;
    });

    // Find min number of columns
    min_column = data.reduce(function (prev, elem) {
      return Math.min(prev, elem.length);
    }, Infinity);

    // more efficient to set values as [][] array than individually        
    try {
      var doc = SpreadsheetApp.getActive();
      var sheet = doc.getActiveSheet();
      var nextRow = sheet.getActiveCell().getRow();
      sheet.getRange(nextRow, sheet.getActiveCell().getColumn(), data.length, data[0].length).setValues(data);
      SpreadsheetApp.getUi().alert('Fetch complete! Fetched:' + data.length + ' records.');
    } catch (e) {
      exception(e);
      SpreadsheetApp.getUi().alert('Fetch failed! ' + nextRow + ', ' + data.length + ', ' + data[0].length + e.name + ' ' + e.message);
    }

    return nextRow + data.length;
  } catch (e) {
    exception(e);
    throw (e);
  }
};

