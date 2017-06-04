var express = require('express');
var router = express.Router();
var sdk = require('@ekhanei/sdk');
var logger = require('@ekhanei/logger').getLogger();
var request = require('request');

/**
 * Legal information
 */
router.get('/legal', function (req, res, next) {
  res.render('misc/legal', {
    title: req.i18n.__('Legal'),
  });
});

/**
 * Contact us
 */
router.get('/contact', function (req, res, next) {
  // Fetching contact us reasons from rat
  sdk.support.contactReason({
      ip: req.getClientIP()
    })
    .then(function (response) {
      var reasons = [];
      for (var i in response) {
        if (response.hasOwnProperty(i)) {
          var reason = response[i].attributes;
          reasons.push(reason);
        }
      }
      res.render('misc/contact', {
        title: req.i18n.__('Contact us'),
        reasons: reasons
      });
    })
    .catch(function (err) {
      logger.error("Couldn't fetch contact us reasons: ", err.message);
      req.flash('error', req.i18n.__("Sorry, some technical problems happened. Please try again after some time"));
      res.redirect('/');
    });
});

// Send contact
router.post('/contact', function (req, res, next) {
  // Validate input
  var invalid = req.validateForm(global.validate.contact);

  // Is invalid?
  if (invalid) {
    req.flash('errors', invalid.errors);
    req.flash('form', req.body);
    return res.redirect(req.originalUrl);
  }

  sdk.support.contact({
      name: req.body.name,
      contact: req.body.contact,
      message: req.body.message,
      reason: req.body.reason,
      ip: req.getClientIP()
    })
    .then(function () {
      req.flash('success', req.i18n.__("Thanks, your message has been sent and our team will respond soon."));
      res.redirect(req.originalUrl);
    })
    .catch(function (err) {
      logger.error("Couldn't send support message: ", err.message);
      req.flash('error', req.i18n.__("Sorry, your message couldn't be sent due to an error with our system. Please try again later or call us on the number below."));
      res.redirect(req.originalUrl);
    });
});

/**
 * Onboarding page
 */
router.get('/welcome', function (req, res, next) {
  res.render('misc/welcome', {
    title: req.i18n.__('Welcome to the new and improved Ekhanei'),
    disableAuthOverlay : true
  });
});

/**
 * Facebook dialog callback
 */
router.get('/_fb_share_callback', function(req, res, next) {
  res.render('misc/_fb_share_callback', {
    layout: null
  });
});

/**
 * Sitemap
 */
router.get('/sitemap*.xml', function (req, res, next) {
  var xmlUrl=process.env.SITEMAP_BASE_URL+req.url.replace('/','');
  request(xmlUrl).pipe(res);
});


module.exports = router;
