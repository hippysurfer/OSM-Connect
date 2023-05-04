function show_fetch_movers_dialog() {
  try {
    var service = getOSMService();
    var osm = OSM(service).init();

    var template = HtmlService.createTemplateFromFile('DialogFetchMovers');
    template.sections = osm.fetch_roles();
    SpreadsheetApp.getUi().showModalDialog(template.evaluate(), 'Select sections.');
  } catch (e) {
    exception(e);
  }
}

function test_movers() {
  action_fetch_movers(["12700"]);
}

function action_fetch_movers(params) {
  var service = getOSMService();
  var osm = OSM(service).init();

  var all_sections = osm.fetch_roles(true, 'flexi');

  var sections = params.map(
    function (elem) {
      return search(elem, 'sectionid', all_sections);
    }
  );

  return movers(
    function () {
      return [].concat.apply([], sections.map(
        function (elem) {
          return osm.fetch_movers(elem);
        }
      ))
    }
  );
}


function movers(fetch_members_func) {
  // Get the list of flexi record tables and look for "Moving On"
  try {
    var section_data = fetch_members_func();
    var headers = Object.keys(section_data[0]);
    var data = [headers];



    data = data.concat(section_data.map(function (member) {
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
            row.push("");
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


