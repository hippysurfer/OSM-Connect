function test_mailmerge() {
  inner_action_fetch_mailmerge(["12700"]);
}

function show_fetch_mailmerge_dialog() {
  try {
    var service = getOSMService();
    var osm = OSM(service).init();

    var template = HtmlService.createTemplateFromFile('DialogFetchMailMerge');
    template.sections = osm.fetch_roles(true, 'member');
    //.setSandboxMode(HtmlService.SandboxMode.IFRAME);
    SpreadsheetApp.getUi().showModalDialog(template.evaluate(), 'Select sections.');
  } catch (e) {
    var f = e; // make exception available in debugger
    exception(e);
  }
}

function action_fetch_mailmerge(params) {
  var data = inner_action_fetch_mailmerge(params);
  SpreadsheetApp.getUi().alert('Fetch complete! Fetched:' + data.length + ' records.');
  add_data_to_sheet(data);
}

function inner_action_fetch_mailmerge(params) {
  var service = getOSMService();
  var osm = OSM(service).init();
  var all_sections = osm.fetch_roles(true, 'member');
  var sections = params.map(
    function (elem) {
      return search(elem, 'sectionid', all_sections);
    }
  );
  var data = member_data(
    function () {
      return [].concat.apply([], sections.map(
        function (section) {
          return osm.fetch_members(section);
        }
      )
      )
    }
  );
  return data;
}

function member_data(fetch_members_func) {
  try {
    // Hardcode the headers for now.
    var headers = [
      "first_name",
      "last_name",
      "member_email",
      "contact1_email",
      "contact2_email",
      "patrol",
      "section_type",
      "section_name",
      "member_id",
      "date_of_birth",
      "started",
      "joined",
      "age",
      "sex",
      "subs"];

    var data = [headers];


    data = data.concat(
      fetch_members_func().map(
        function (member) {
          var row = [];
          // loop through the header columns
          for (i in headers) {
            if (headers[i] == "Timestamp") { // special case if you include a 'Timestamp' column
              row.push(new Date());
            } else if (headers[i] == "date_of_birth") {
              row.push(new Date(member['date_of_birth']));
            } else if (headers[i] == "sex") {
              row.push(member['custom_data'][7]["34"]); // You just have to know that it is here!
            } else if (headers[i] == "subs") {
              row.push(member['custom_data'][5]["8709"]); // You just have to know that it is here!
            } else if (headers[i] == "member_email") {
              row.push(member['custom_data'][6]["12"]); // You just have to know that it is here!
            } else if (headers[i] == "contact1_email") {
              row.push(member['custom_data'][1]["12"]); // You just have to know that it is here!
            } else if (headers[i] == "contact2_email") {
              row.push(member['custom_data'][2]["12"]); // You just have to know that it is here!
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


    return data;
  } catch (e) {
    var f = e; // make exception available in debugger
    Logger.log(e);
    exception(e);
    throw (e);
  }
};

function add_data_to_sheet(data) {
  var doc = SpreadsheetApp.getActive();
  var sheet = doc.getActiveSheet();
  var nextRow = sheet.getActiveCell().getRow();

  // more efficient to set values as [][] array than individually
  sheet.getRange(nextRow, sheet.getActiveCell().getColumn(), data.length, data[0].length).setValues(data);

}
