var express = require('express');
var router = express.Router();
var sdk = require('@ekhanei/sdk');
var utils = require('@ekhanei/utils');
var querystring = require('querystring');
var requireLogin = require('../middleware/require-login');
var config = require('../config/ads');
var adMiddleware = require("../middleware/ad-middleware");
var reportReasons = require('../config/report-reasons');
var moment = require('moment');

function deleteAd (req, res, next){
  // Send the reason
  sdk.accountAds.update({
      userId: req.user.id,
      adId: req.ad.attributes.full_ad_id,
      jwt: req.user.jwt,
      ip: req.getClientIP(),
      userAgent: req.headers['user-agent'],
      source: 'desktop',
      ad: {
        parameters: {
          deleteReason: req.body.reason
        }
      }
    })

    // Now delete the ad
    .then(function (response) {
      req.handlePigeonResponse(response);
      // when we update an Ad, full ad is is updated
      return sdk.accountAds.delete({
        userId: req.user.id,
        adId: response.data.id,
        ip: req.getClientIP(),
        jwt: req.user.jwt
      });
    })

    // Deleted
    .then(function (response) {
      req.handlePigeonResponse(response);
      // Track event
      req.visitor.event('Ad delete', 'Delete Ad', req.body.reason).send();
      req.flash('success', req.i18n.__("Your ad was successfully deleted"));
      res.redirect('/');
    })
    .catch(function (err) {
      req.flash('error', req.i18n.__("You cannot delete this ad at this moment. Please try again later."));
      res.redirect('/ad/' + req.params.slug);
      logger.error("Could not delete ad of user %s, ad %s error: %s", req.user.id, req.ad.attributes.full_ad_id, JSON.stringify(err));
    });
}
/**
 * Complain about ad
 */
router.get('/ad/:slug/report', adMiddleware, function (req, res, next) {
  var title = req.i18n.__('Report ad');

  // Render the view
  res.render('ads/complain', {
    title: title,
    header: {
      title: title
    },
    ad: req.ad,
    reasons: reportReasons
  });
});

/**
 * Submit complaint
 */
router.post('/ad/:slug/report', adMiddleware, function (req, res, next) {
  // Validate input
  var invalid = req.validateForm(global.validate.reportAd);

  // Is invalid?
  if (invalid) {
    req.flash('errors', invalid.errors);
    req.flash('form', req.body);
    return res.redirect(req.originalUrl);
  }

  sdk.accountAds.report({
      fullAdId: req.ad.attributes.full_ad_id,
      reporterId: (req.user) ? req.user.id : null,
      reason: req.body.reason,
      comments: req.body.comments,
      ip: req.getClientIP()
    })
    .then(function (response) {
      req.flash('info', req.i18n.__("Thank you. Your complaint was submitted for our customer service team to review."));
      res.redirect('/ad/' + encodeURI(req.params.slug));
    })
    .catch(function (err) {
      next(err);
    });
});


/**
 * Ad deletion
 */
router.use('/ad/:slug/delete', requireLogin, adMiddleware, function (req, res, next) {
  // If user doesn't own this ad
  if (req.user.id !== req.ad.attributes.account.account_id) {
    req.flash('error', req.i18n.__("You cannot delete this ad because you are not the seller."));
    return res.redirect('/ad/' + req.params.slug);
  }
  next();

});


/**
 * Delete confirmation
 */
router.get('/ad/:slug/delete', function (req, res, next) {
  var title = req.i18n.__('Delete ad');

  res.render('ads/delete', {
    title: title,
    adSlug: req.params.slug
  });
});

// Delete ad
router.post('/ad/:slug/delete', function (req, res, next) {
  // Validate input
  var invalid = req.validateForm(global.validate.deleteAd);

  // Is invalid?
  if (invalid) {
    req.flash('errors', invalid.errors);
    req.flash('form', req.body);
    return res.redirect(req.originalUrl);
  }
  deleteAd (req, res, next);
});

/**
 * Ad renew
 */
router.use('/ad/:slug/renew', requireLogin, adMiddleware, function (req, res, next) {
  // If user doesn't own this ad
  if (req.user.id !== req.ad.attributes.account.account_id) {
    req.flash('error', req.i18n.__("You cannot renew this ad because you are not the seller."));
    return res.redirect('/ad/' + req.params.slug);
  }
  next();
});


// Ad renew
router.get('/ad/:slug/renew', requireLogin, adMiddleware, function (req, res, next) {
  var title = req.i18n.__('Renew ad');

  // get ad expiry time and ad state 
  sdk.accountAds.get({
      userId: req.user.id,
      adId: req.ad.attributes.full_ad_id,
      jwt: req.user.jwt,
      ip: req.getClientIP()
    })

    .then(function (response) {
      req.handlePigeonResponse(response);
      // get ad expiry time
      var adState = response.data.attributes.state, // get ad state
          expiryTime = response.data.attributes.expiration_time, // get ad expiry time
          startDate = moment(new Date()).format("YYYY-MM-DD"),
          endDate = moment(new Date(expiryTime)).format("YYYY-MM-DD"),
          remainingDays = moment(startDate).diff(endDate, 'days'); // get remaining ad time to

      if ((parseInt(remainingDays) <= 0) && (adState === 'extended')) {
        // Render the view
        res.render('ads/renew', {
          title: title,
          ad: req.ad
        });
      } else {
        req.flash('error', req.i18n.__("You can not renew this ad"));
        res.redirect('/ad/' + req.params.slug);
      }
    })
    .catch(function (err) {
      // TODO: Grab proper error message from sdk. REL-355
      err.status = 404;
      next(err);
    });
  
});

// Submit renew and delete
router.post('/ad/:slug/renew',requireLogin, function (req, res, next) {
  // Validate input
  var invalid = req.validateForm(global.validate.renewAd);

  // Is invalid?
  if (invalid) {
    req.flash('errors', invalid.errors);
    req.flash('form', req.body);
    return res.redirect(req.originalUrl);
  }
  var reason = req.body.reason ;

  if (reason !== 'published') {
    deleteAd (req, res, next);
  }
  else {
    res.redirect('/ad/'+req.params.slug+'/edit/?postad=true');
  }
});


module.exports = router;
