

function onLoad() {
  document.addEventListener("deviceready", onDeviceReady, true);
}

function onDeviceReady() {
  window.alert = navigator.notification.alert;
  alert("PhoneGap version 1.0.8");
}

// Cordova is loaded and it is now safe to make calls Cordova methods
// Now safe to use the Cordova API
   //var re = setup_re();
   //var q_ram = new Rule('choose_ram');
   //var term_X = new Term('X');
   //q_ram.addArg(term_X);
   //re.fireRule(q_ram);
   
   //re.handleQueryResult(q_ram);
