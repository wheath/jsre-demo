function onLoad() {
        document.addEventListener("deviceready", onDeviceReady, false);
    }

// Cordova is loaded and it is now safe to make calls Cordova methods
function onDeviceReady() {
// Now safe to use the Cordova API
   var re = setup_re();
   var q_ram = new Rule('choose_ram');
   var term_X = new Term('X');
   q_ram.addArg(term_X);
   re.fireRule(q_ram);
   
   re.handleQueryResult(q_ram);
}
