"use strict";
var qs = require('querystring');
var logger = require('@ekhanei/logger').getLogger();
var deviceSDK = require("@ekhanei/device-info");
const util = require("util");

/**
 *  Builds the redirection based on the protocol
 * @param request
 */
function getSmartPhoneURL(request) {
  var protocol = request.protocol;
  if(process.env.NODE_ENV && process.env.NODE_ENV == 'production') {
    protocol = 'https'; // For preventing double redirection we have to put https manually.
  }
  var url = util.format("%s://%s", protocol, process.env.SMARTPHONE_SITE);
  url += request.originalUrl;
  return url;
}

/**
 *  Builds the url to redirect to featurephone
 * @param request
 */
function getFeaturePhoneURL(request) {
  //We are doing HTTP here because featurephone is pretty basic and putting HTTPS here can make stuff go bad
  var url = util.format("http://%s", process.env.FEATUREPHONE_SITE);
  url += request.originalUrl;
  return url;
}

/**
 *  Does the logic of detection and redirection if needed
 * @param request
 * @param response
 * @param next
 * @return {*}
 */

//stay in desktop and drop the cookie
function createCookie (request, response){
  response.cookie("ekhanei.flavour", "desktop", {
    maxAge: 1000 * 60 * 60 * 24 * 30 * 12, // One year,
    path: "/",
    httpOnly: true,
    domain: "." + request.hostname
  });
}

function detectAndRedirect(request, response, next) {
  // Don't detect if this is present (but don't set cookie either)
  if (request.query.hasOwnProperty('noredir')) {
    return next();
  }

  // If the site requested from smartphone
  if (request.query.rdf === 'sm') {
    createCookie(request, response);
    return next();
  }
  if (request.cookies["ekhanei.flavour"]) {
    //If the user has the cookie then we don't run logic, we must save those precious milliseconds (My precious.....)
    logger.debug("Site flavour cookie found: %s", request.cookies["ekhanei.flavour"]);
    return next();
  }
  var deviceInfo = deviceSDK.info(request.headers["user-agent"]);
  if (deviceInfo === null) {
    logger.crit("There was an error while trying to get the device information so we can not redirect");
    return next();
  }
  logger.debug("Device found: %s", JSON.stringify(deviceInfo));
  //XXX: Opera mini wins :'(
  if (deviceInfo["is_opera_mini"] || deviceInfo["is_smartphone"]) {
    return response.redirect(302, getSmartPhoneURL(request));
  }
  if (deviceInfo["is_featurephone"]) {
    return response.redirect(302, getFeaturePhoneURL(request));
  }

  createCookie(request, response);
  next();
}

module.exports = detectAndRedirect;
