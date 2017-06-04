var utils = require('@ekhanei/utils');
var filerev = require('../lib/helpers/filerev');

module.exports = {
  setSelect: function(actual, value) {
    if (actual == value) {
      return 'selected="selected"';
    }
    return '';
  },
  prettyNumber: function(number) {
    return utils.prettyNumber(number);
  },
  // compare function
  ifEqual: function (lvalue, rvalue, options){
    if (arguments.length < 3)
      throw new Error("Handlebars Helper equal needs 2 parameters");
    if( lvalue!=rvalue ) {
      return options.inverse(this);
    } else {
      return options.fn(this);
    }
  },
  unlessEqual: function (lvalue, rvalue, options){
    if (arguments.length < 3)
      throw new Error("Handlebars Helper unlessEqual needs 2 parameters");
    if( lvalue==rvalue ) {
      return options.inverse(this);
    } else {
      return options.fn(this);
    }
  },
  compare: function (lvalue, rvalue, options){ // {{#compare unicorns ponies operator="<"}} To do {{/compare}}
    if (arguments.length < 3){
      throw new Error("Handlerbars Helper 'compare' needs 2 parameters");
    }
    var operator = options.hash.operator;
    var operators = {
      '<':        function(l,r) { return l < r; },
      '>':        function(l,r) { return l > r; },
      '<=':       function(l,r) { return l <= r; },
      '>=':       function(l,r) { return l >= r; },
      'typeof':   function(l,r) { return typeof l == r; }
    };
    if (!operators[operator]){
      throw new Error("Handlerbars Helper 'compare' doesn't know the operator "+operator);
    }
    var result = operators[operator](lvalue,rvalue);
    if( result ) {
      return options.fn(this);
    } else {
      return options.inverse(this);
    }
  },
  json: function(context) {
    return JSON.stringify(context);
  },
  filerev: function(filepath) {
    return filerev.parse(filepath);
  },

  //truncate
  truncate: function (str, len){
    var reg = /(<([^>]+)>)/ig;
    if(utils.isDefined(str) && str.match(reg)) {
      str = str.replace(reg," ");
      str = str.replace(/\s\s+/g, " ");
    }
    if (str && str.length > len && str.length > 0) {
      var new_str = str + " ";
      new_str = str.substr (0, len);
      new_str = str.substr (0, new_str.lastIndexOf(" "));
      new_str = (new_str.length > 0) ? new_str : str.substr (0, len);
      return  new_str +'...';
    }
    return str;
  },
  // loop
  times: function(n, block) {
    var accum = '';
    for(var i = 0; i < n; ++i)
        accum += block.fn(i);
    return accum;
  },
  loopSetSelect: function (array,slug,selector){
    var select = '';
    if(!utils.isDefined(array)){
      return select;
    }
    Object.keys(array).forEach(function(key) {
      if(key === slug && array[key] === selector){
        select = 'selected="selected"';
      }
      if (!selector && key === slug) {
        select = array[key];
      }
    });
    return select;
  }
};
