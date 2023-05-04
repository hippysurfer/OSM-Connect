function authorise() {
  try {    
    var ui = HtmlService.createTemplateFromFile('authorise')
    .evaluate()
    .setWidth(400)
    .setHeight(190)
    .setSandboxMode(HtmlService.SandboxMode.IFRAME);
    SpreadsheetApp.getUi().showModalDialog(ui, 'Enter your OSM Client ID and Client Secret.');
  } catch(e) {
    exception(e);
  }
}

function do_authorise(formObject) {
  try {
    var client_id = formObject.client_id;
    var client_secret = formObject.client_secret;

    store_creds(client_id, client_secret);
        
    onOpen();
    
    return;
    
  } catch(e) {
    Logger.log(e);
    sheet_log(e);    
    throw(e);    
  }  
};

function store_creds(client_id, client_secret) {
  var properties = PropertiesService.getUserProperties();  
  properties.setProperty('OSM_CONNECT_CLIENT_ID', client_id);
  properties.setProperty('OSM_CONNECT_CLIENT_SECRET', client_secret);
}

function remove_creds(userid, secret) {
  var properties = PropertiesService.getUserProperties();  
  properties.deleteProperty('OSM_CONNECT_CLIENT_ID');
  properties.deleteProperty('OSM_CONNECT_CLIENT_SECRET');
  onOpen();
}

function fetch_userid() {
  var properties = PropertiesService.getUserProperties();
  return properties.getProperty('OSM_CONNECT_CLIENT_ID');
}

function fetch_secret() {
  var properties = PropertiesService.getUserProperties();
  return properties.getProperty('OSM_CONNECT_CLIENT_SECRET');
}

function has_creds() {
  var properties = PropertiesService.getUserProperties();
  return (properties.getProperty('OSM_CONNECT_CLIENT_ID') != null && 
          properties.getProperty('OSM_CONNECT_CLIENT_SECRET') != null)  
}
