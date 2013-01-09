$(function() {
   var re = setup_re();
   var q_ram = new Rule('choose_ram');
   var term_X = new Term('X');
   q_ram.addArg(term_X);
   re.fireRule(q_ram);
   
   re.handleQueryResult(q_ram);
});
                   
