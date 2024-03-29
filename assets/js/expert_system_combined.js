var Util = (function () {
    function Util() { }
    Util.is_in_browser = function is_in_browser() {
        return !(typeof window === 'undefined');
    }
    Util.output = function output(s) {
        if(Util.is_in_browser()) {
            document.getElementById('output_div').innerHTML = s;
        } else {
            console.log(s + '\n');
        }
    }
    Util.input = function input(re) {
        re.async_hold = true;
        if(is_debug) {
            console.log("_dbg in input");
            console.log("_dbg rule_firing # b_args: " + re.rule_firing.b_args.length);
        }
        if(Util.is_in_browser()) {
            var input_str = window.prompt("Enter input", "Type your input here");
            re.handleAsyncInput(input_str);
        } else {
            var prompt = require('prompt');
            prompt.start();
            prompt.get([
                'input_str'
            ], function (err, result) {
                if(err) {
                    return onErr(err);
                }
                if(is_debug) {
                    console.log('Command-line input received:');
                    console.log('  input_str: ' + result.input_str);
                }
                re.handleAsyncInput(result.input_str);
            });
            function onErr(err) {
                console.log(err);
                return 1;
            }
        }
    }
    return Util;
})();
var is_debug = true;
var Types = (function () {
    function Types() { }
    Types.types = [];
    Types.registerType = function registerType(clsName, classDcl) {
        Types.types[clsName] = classDcl;
    }
    return Types;
})();
var Atom = (function () {
    function Atom(name) {
        this.name = name;
    }
    Atom.prototype.deepcopy = function () {
        var atom_copy = new Atom(this.name);
        return atom_copy;
    };
    return Atom;
})();
Types.registerType('Atom', Atom);
var Term = (function () {
    function Term(name) {
        this.name = name;
        this.grounded = this;
    }
    Term.prototype.deepcopy = function () {
        var term_copy = new Term(this.name);
        term_copy.name = this.name;
        if(!this.isGrounded()) {
            term_copy.grounded = this.grounded;
        } else {
            term_copy.grounded = term_copy;
        }
        return term_copy;
    };
    Term.prototype.isBoundorAliased = function () {
        var ret_val = false;
        if(RuleEngine.getTypeName(this.grounded) == 'Atom') {
            ret_val = true;
        }
        if(RuleEngine.getTypeName(this.grounded) == 'Term') {
            ret_val = true;
        }
        return ret_val;
    };
    Term.prototype.isFree = function () {
        if(this.grounded == this) {
            return true;
        } else {
            return false;
        }
    };
    Term.prototype.isGrounded = function () {
        var is_grounded = true;
        if(this.grounded == this) {
            is_grounded = false;
        } else {
            if(this.isBoundorAliased()) {
                is_grounded = this.grounded.isGrounded();
            }
        }
        return is_grounded;
    };
    Term.prototype.reset = function () {
        this.grounded = this;
    };
    Term.prototype.unify = function (t) {
        if(is_debug) {
            console.log("_dbg in unify");
        }
        var unified = false;
        if(this.isFree()) {
            if(is_debug) {
                console.log("_dbg term is free, assigning grounded");
            }
            this.grounded = t;
            unified = true;
        } else {
            if(this.isBoundorAliased()) {
                unified = this.grounded.unify(t);
            } else {
                unified = false;
            }
        }
        if(unified) {
            RuleEngine.choices.push(this);
        }
        return unified;
    };
    Term.prototype.getGrounded = function () {
        if(is_debug) {
            console.log("_dbg in getGrounded()");
        }
        if(this.isFree()) {
            return this;
        }
        var ret_val = this.grounded;
        if(this.isBoundorAliased()) {
            if(is_debug) {
                console.log("_dbg aliased or bounded, searching chain...");
            }
            ret_val = this.grounded.getGrounded();
        }
        return ret_val;
    };
    return Term;
})();
Types.registerType('Term', Term);
var Rule = (function () {
    function Rule(name) {
        this.args = [];
        this.b_args = [];
        this.rules = [];
        this.non_call_regex = /=|fail|!|o\(|i\(/;
        this.solutions = [];
        this.name = name;
        this.proven = false;
    }
    Rule.prototype.deepcopy = function () {
        var rule_copy = new Rule(this.name);
        for(var i = 0; i < this.args.length; i++) {
            rule_copy.args.unshift(this.args[i].deepcopy());
        }
        for(var r = 0; r < this.rules.length; r++) {
            var call_copy = new Rule(this.rules[r].name);
            for(var a = 0; a < this.rules[r].args.length; a++) {
                call_copy.args.unshift(this.rules[r].args[a].deepcopy());
            }
            for(var b = 0; b < this.rules[r].b_args.length; b++) {
                call_copy.b_args.unshift(this.rules[r].b_args[b].deepcopy());
            }
            rule_copy.rules.unshift(call_copy);
        }
        rule_copy.proven = this.proven;
        rule_copy.solutions = this.solutions;
        return rule_copy;
    };
    Rule.prototype.addArg = function (arg) {
        this.args.push(arg);
    };
    Rule.prototype.addBarg = function (b_arg) {
        this.b_args.push(b_arg);
    };
    Rule.prototype.addRule = function (rule) {
        this.rules.unshift(rule);
    };
    Rule.prototype.is_query = function () {
        return !this.rules.length && this.args.length && !this.non_call_regex.test(this.name);
    };
    Rule.prototype.is_non_call = function () {
        return !this.rules.length && !this.args.length && this.non_call_regex.test(this.name);
    };
    return Rule;
})();
Types.registerType('Rule', Rule);
var Choice = (function () {
    function Choice(query, rule) {
        this.query = query;
        this.rule = rule;
    }
    return Choice;
})();
Types.registerType('Choice', Choice);
var RuleEngine = (function () {
    function RuleEngine() {
        this.rules = [];
        this.body_rules = [];
        this.async_hold = false;
    }
    RuleEngine.choices = [];
    RuleEngine.prototype.addBodyRule = function (rule) {
        this.body_rules.unshift(rule);
    };
    RuleEngine.prototype.addRule = function (rule) {
        this.rules.unshift(rule);
    };
    RuleEngine.getTypeName = function getTypeName(inst) {
        var typeName = undefined;
        for(var clsName in Types.types) {
            if(inst instanceof Types.types[clsName]) {
                typeName = clsName;
            }
        }
        return typeName;
    }
    RuleEngine.prototype.findArg = function (name, args) {
        for(var i = 0; i < args.length; i++) {
            if(name == args[i].name) {
                return args[i];
            }
        }
    };
    RuleEngine.prototype.backTrack = function () {
        var is_backTracked = false;
        var found_choice = undefined;
        this.rule_firing = undefined;
        this.body_rule_firing = undefined;
        this.body_rules = [];
        while(!is_backTracked) {
            if(RuleEngine.choices.length > 0) {
                var choice_or_term = RuleEngine.choices.pop();
                if(RuleEngine.getTypeName(choice_or_term) == 'Term') {
                    choice_or_term.reset();
                } else {
                    if(RuleEngine.getTypeName(choice_or_term) == 'Choice') {
                        found_choice = choice_or_term;
                        is_backTracked = true;
                    } else {
                        throw new TypeError("BackTrack error, unknown type popped from choice point stack");
                    }
                }
            } else {
                is_backTracked = true;
            }
        }
        if(found_choice) {
            var rule_copy = this.prepareToFire(found_choice.query, found_choice.rule);
            this.fireRule(rule_copy);
        } else {
            if(is_debug) {
                console.log("_dbg backTrack found no choices to fire on choice point stack");
            }
        }
    };
    RuleEngine.prototype.isArgsMatch = function (args1, args2) {
        var match = true;
        if(args1.length == args2.length) {
            if(is_debug) {
                console.log("_dbg num args match\n");
            }
        } else {
            match = false;
        }
        return match;
    };
    RuleEngine.prototype.searchRules = function (rules, name, args) {
        if(is_debug) {
            console.log("_dbg in searchRules\n");
            console.log("_dbg num rules searching: " + rules.length + "\n");
            console.log("_dbg searching for name: " + name + "\n");
        }
        var foundRules = [];
        for(var i in rules) {
            if(is_debug) {
                console.log("_dbg rule name: " + rules[i].name + "\n");
            }
            if(name == rules[i].name) {
                if(is_debug) {
                    console.log("_dbg found rule\n");
                }
                if(this.isArgsMatch(rules[i].args, args)) {
                    if(is_debug) {
                        console.log("_dbg args match\n");
                    }
                    foundRules.push(rules[i]);
                }
            }
        }
        return foundRules;
    };
    RuleEngine.prototype.unifyRuleHeaders = function (r1, r2) {
        if(is_debug) {
            console.log("_dbg in unifyRuleHeaders");
        }
        for(var i = 0; i < r1.args.length; i++) {
            if(RuleEngine.getTypeName(r1.args[i]) == 'Term') {
                if(is_debug) {
                    console.log("_dbg calling unify on r1");
                }
                r1.args[i].unify(r2.args[i]);
                if(is_debug) {
                    console.log("_dbg r1.args[i].grounded type: " + RuleEngine.getTypeName(r1.args[i].grounded));
                }
            } else {
                if(RuleEngine.getTypeName(r2.args[i]) == 'Term') {
                    if(is_debug) {
                        console.log("_dbg calling unify on r2");
                    }
                    r2.args[i].unify(r1.args[i]);
                }
            }
        }
        if(is_debug) {
            console.log("_dbg exiting unifyRuleHeaders");
        }
    };
    RuleEngine.prototype.handleFoundRules = function (query, foundRules) {
        for(var i = 1; i < foundRules.length; i++) {
            var choice = new Choice(query, foundRules[i]);
            RuleEngine.choices.push(choice);
        }
    };
    RuleEngine.prototype.prepareToFire = function (query, rule) {
        var rule_copy = rule.deepcopy();
        this.unifyRuleHeaders(query, rule_copy);
        return rule_copy;
    };
    RuleEngine.prototype.popBodyRule = function () {
        if(!this.async_hold) {
            if(is_debug) {
                console.log("_dbg about to pop a body rule");
                console.log("_dbg this.body_rules.length: " + this.body_rules.length);
            }
            this.body_rule_firing = this.body_rules.pop();
        }
    };
    RuleEngine.prototype.handleAsyncInput = function (input_str) {
        if(is_debug) {
            console.log("_dbg in handleAsyncInput");
        }
        this.async_hold = false;
        var header = this.rule_firing;
        var bodyRule = this.body_rule_firing;
        var r = /^i\((.*)\)/;
        var arg_name = bodyRule.name.match(r)[1];
        console.log("\n");
        var arg = this.findArg(arg_name, header.args);
        if(!arg) {
            arg = this.findArg(arg_name, header.b_args);
        }
        if(!arg) {
            if(is_debug) {
                console.log("_dbg Term variable with name: " + arg_name + " not found, creating and adding to body args of header rule name:" + header.name);
            }
            arg = new Term(arg_name);
            header.addBarg(arg);
        }
        if(is_debug) {
            console.log("_dbg unifying value: " + input_str + " with arg name: " + arg.name);
        }
        arg.unify(input_str);
        if(is_debug) {
            console.log("_dbg num header.b_args: " + header.b_args.length);
        }
        this.handleNonCallAsync(false);
    };
    RuleEngine.prototype.handleNonCallBodyRule = function (header, bodyRule) {
        if(is_debug) {
            console.log("_dbg in handleNonCallBodyRule\n");
            console.log("_dbg header.name: " + header.name);
        }
        var is_fail = false;
        if(bodyRule.name.indexOf('==') > -1) {
            var n = bodyRule.name.split('==');
            if(is_debug) {
                console.log("_dbg n: " + JSON.stringify(n) + "\n");
                console.log("_dbg num header args: " + header.args.length + "\n");
                console.log("_dbg num header b_args: " + header.b_args.length + "\n");
            }
            var arg = this.findArg(n[0], header.args);
            if(!arg) {
                if(is_debug) {
                    console.log("_dbg header.b_args: " + JSON.stringify(header.b_args) + "\n");
                }
                arg = this.findArg(n[0], header.b_args);
            }
            if(is_debug) {
                console.log("_dbg arg name: " + arg.name + "\n");
                console.log("_dbg == arg.getGrounded(): " + arg.getGrounded() + "\n");
            }
            if(arg.getGrounded() != n[1]) {
                is_fail = true;
            }
        } else {
            if(bodyRule.name.indexOf('=') > -1) {
                var n = bodyRule.name.split('=');
                var arg = this.findArg(n[0], header.args);
                if(!arg) {
                    arg = this.findArg(n[0], header.b_args);
                }
                if(!arg) {
                    if(is_debug) {
                        console.log("_dbg Term variable with name: " + n[0] + " not found, creating and adding to body args of header rule");
                    }
                    arg = new Term(n[0]);
                    header.addBarg(arg);
                }
                if(is_debug) {
                    console.log("_dbg arg name: " + arg.name + "\n");
                }
                arg.unify(n[1]);
            } else {
                if(bodyRule.name.indexOf('!') > -1) {
                    console.log("_dbg executing cut, emptying choice points");
                    RuleEngine.choices = [];
                } else {
                    if(bodyRule.name.indexOf('fail') > -1) {
                        if(is_debug) {
                            console.log("_dbg executing fail");
                        }
                        is_fail = true;
                    } else {
                        if(bodyRule.name.indexOf('o(') > -1) {
                            var r = /^o\((.*)\)/;
                            Util.output(bodyRule.name.match(r)[1]);
                        } else {
                            if(bodyRule.name.indexOf('i(') > -1) {
                                var r = /^i\((.*)\)/;
                                var arg_name = bodyRule.name.match(r)[1];
                                if(is_debug) {
                                    console.log("_dbg input into varible: " + arg_name);
                                }
                                Util.input(this);
                            }
                        }
                    }
                }
            }
        }
        if(is_debug) {
            console.log("_dbg about to call handleNonCallAsync");
            console.log("_dbg is_fail: " + is_fail);
        }
        this.handleNonCallAsync(is_fail);
    };
    RuleEngine.prototype.prepareToCall = function (call_rule) {
        if(is_debug) {
            console.log("_dbg processing rule name: " + call_rule.name + " as a call");
        }
        var foundRules = this.searchRules(this.rules, call_rule.name, call_rule.args);
        if(is_debug) {
            console.log("_dbg num rules found: " + foundRules.length + "\n");
        }
        this.handleFoundRules(call_rule, foundRules);
        if(foundRules.length) {
            var rule_copy = this.prepareToFire(call_rule, foundRules[0]);
            return rule_copy;
        }
    };
    RuleEngine.prototype.handleNonCallAsync = function (is_fail) {
        if(is_debug) {
            console.log("_dbg in handleNonCallAsync");
            console.log("_dbg this.async_hold: " + this.async_hold);
            if(this.rule_firing.b_args.length > 0) {
                console.log("this.rule_firing.b_args[0].getGrounded(): " + this.rule_firing.b_args[0].getGrounded());
            }
        }
        if(this.async_hold) {
            return;
        }
        if(!this.async_hold) {
            if(is_debug) {
                console.log("_dbg this.async_hold is false");
            }
            if(is_fail) {
                if(is_debug) {
                    console.log("_dbg fail detected in bodyRules execution, backtracking...");
                }
                this.backTrack();
            }
            this.popBodyRule();
            if(is_debug) {
                console.log("_dbg about to call handleBodyRule");
            }
            this.handleBodyRule();
        }
    };
    RuleEngine.prototype.handleBodyRule = function () {
        if(this.async_hold) {
            return;
        }
        var header = this.rule_firing;
        var bodyRule = this.body_rule_firing;
        if(!bodyRule) {
            return;
        }
        if(!bodyRule.is_non_call()) {
            var rule_copy = this.prepareToCall(bodyRule);
            this.fireRule(rule_copy);
        } else {
            if(is_debug) {
                console.log("_dbg processing non call rule name: " + bodyRule.name);
            }
            this.handleNonCallBodyRule(header, bodyRule);
        }
    };
    RuleEngine.prototype.fireRule = function (r) {
        this.rule_firing = r;
        if(is_debug) {
            console.log("_dbg firing rule: " + r.name + "\n");
            console.log("_dbg1 r.args[0]: " + RuleEngine.getTypeName(r.args[0]));
        }
        if(r.is_query()) {
            if(is_debug) {
                console.log("_dbg executing query rule: " + r.name + "\n");
            }
            var rule_copy = this.prepareToCall(r);
            this.fireRule(rule_copy);
            if(this.async_hold) {
                return;
            }
        }
        for(var l in r.rules) {
            var bodyRule = r.rules[l];
            this.addBodyRule(bodyRule);
        }
        this.popBodyRule();
        this.handleBodyRule();
        if(is_debug) {
            console.log("_dbg after handleBodyRule in fireRule");
        }
    };
    RuleEngine.prototype.isQuerySolved = function (r_args) {
        var is_solved = true;
        for(var i = 0; i < r_args.length; i++) {
            if(!r_args[i].isGrounded()) {
                is_solved = false;
            }
        }
        return is_solved;
    };
    return RuleEngine;
})();
function setup_re() {
  var re = new RuleEngine();

  var small_ram_term = new Term('X');
  var small_ram_rule = new Rule('choose_ram');
  small_ram_rule.addArg(small_ram_term);

  var small_o1 = new Rule('o(Do you want a small amount of Ram?)');
  re.addRule(small_o1);
  small_ram_rule.addRule(small_o1);

  var small_i1 = new Rule('i(Y)');
  re.addRule(small_i1);
  small_ram_rule.addRule(small_i1);

  var small_i1_eq_yes = new Rule('Y==yes');
  re.addRule(small_i1_eq_yes);
  small_ram_rule.addRule(small_i1_eq_yes);

  var small_X = new Rule('X=small');
  re.addRule(small_X);
  small_ram_rule.addRule(small_X);

  re.addRule(small_ram_rule);

  var med_ram_term = new Term('X');
  var med_ram_rule = new Rule('choose_ram');
  med_ram_rule.addArg(med_ram_term);

  var med_o1 = new Rule('o(Do you want a medium amount of Ram?)');
  re.addRule(med_o1);
  med_ram_rule.addRule(med_o1);

  var med_i1 = new Rule('i(Y)');
  re.addRule(med_i1);
  med_ram_rule.addRule(med_i1);

  var med_i1_eq_yes = new Rule('Y==yes');
  re.addRule(med_i1_eq_yes);
  med_ram_rule.addRule(med_i1_eq_yes);

  var med_X = new Rule('X=medium');
  re.addRule(med_X);
  med_ram_rule.addRule(med_X);

  re.addRule(med_ram_rule);

  var large_ram_term = new Term('X');
  var large_ram_rule = new Rule('choose_ram');
  large_ram_rule.addArg(med_ram_term);

  var large_o1 = new Rule('o(Do you want a large amount of Ram?)');
  re.addRule(large_o1);
  large_ram_rule.addRule(large_o1);

  var large_i1 = new Rule('i(Y)');
  re.addRule(large_i1);
  large_ram_rule.addRule(med_i1);

  var large_i1_eq_yes = new Rule('Y==yes');
  re.addRule(large_i1_eq_yes);
  large_ram_rule.addRule(large_i1_eq_yes);

  var large_X = new Rule('X=large');
  re.addRule(large_X);
  large_ram_rule.addRule(large_X);

  re.addRule(large_ram_rule);

  return re;
}

