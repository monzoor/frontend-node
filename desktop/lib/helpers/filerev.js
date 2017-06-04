"use strict";
var config = require('../../config/filerev');

module.exports.parse = function(filepath) {
  if (process.env.NODE_ENV == 'development') {
    return filepath;
  }
  
  if (config.hasOwnProperty(filepath)) {
    return config[filepath];
  } else {
    return filepath;
  }
};