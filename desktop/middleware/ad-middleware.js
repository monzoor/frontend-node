"use strict";
var sdk = require('@ekhanei/sdk');
var jwtApiCredentials = require('@ekhanei/jwt-api-credentials');
var filerev = require('../lib/helpers/filerev');

/**
 * Extract lowercase title from slug
 * @param {string} slug The ad slug
 * @returns {string} The title string
 */
function extractTitle(slug) {
  var uuidLength = 36;
  var title = slug.substr(0, slug.length - (uuidLength+1));
  return title.replace(/-/g, ' ');
}

/**
 * Test for valid slug (title+uuid)
 * @param {string} slug The ad slug
 * @returns {boolean} Valid or invalid
 */
function validSlug(slug) {
  var regex = /^.+[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  return regex.test(slug);
}

/**
 * Middleware to get ad and attach to request
 */
module.exports = function (req, res, next) {
  sdk.ask.getAd({
      id: req.params.slug.slice(-36),
      ip: req.getClientIP()
    })
    .then(function (result) {
      req.ad = result.data;

      // Get the user's account info
      sdk.account.getAccount({
        id: result.data.attributes.account.account_id,
        ip: req.getClientIP()
      })
      .then(function(response) {
        req.handlePigeonResponse(response);
        if (response.data.attributes.preferences.hidePhone) {
          req.ad.attributes.hidePhone = response.data.attributes.preferences.hidePhone;
        }

        req.ad.attributes.avatar = 'default';
        if(response.data.attributes.preferences.avatarImageId) {
          req.ad.attributes.avatar = response.data.attributes.preferences.avatarImageId;
        }
        next();
      })
      .catch(function(err) {
        next();
      });
    })
    .catch(function (err) {
      if (err.is(sdk.ask.errors.NOT_FOUND)) {
        // If slug is incorrect format then this is definitely 404
        if (!validSlug(req.params.slug)) {
          // If the user delete the ad and user land on the ad view page by clicking 
          // on the notification link
          if(req.query.nid) {
            req.flash('success', req.i18n.__("Your ad was successfully deleted"));
            return res.redirect('/');
          }
          var error = new Error("Ad Not Found");
          error.status = 404;
          return next(error);
        }

        // If slug is valid then this is likely an expired/deleted ad
        // req.visitor.event('Ad View', 'Expired', req.originalUrl).send();
        return res.render('ads/expired', {
          title: req.i18n.__("Ad no longer exists"),
          scripts: [filerev.parse('/js/ad-view.js')],
          similarAdsLink: '/?q='+encodeURI(extractTitle(req.params.slug))
        });
      }

      next(err);
    });
};