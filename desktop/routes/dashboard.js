var express = require('express');
var router = express.Router();
var requireLogin = require('../middleware/require-login');
var adMiddleware = require("../middleware/ad-middleware");
var _ = require('lodash');
var adHelpers = require("../lib/helpers/ad-helper");
var imageHelper = require('../lib/helpers/image-helper');
var sdk = require('@ekhanei/sdk');
var utils = require('@ekhanei/utils');
var moment = require('moment');
var filerev = require('../lib/helpers/filerev');
var logger = require('@ekhanei/logger').getLogger();


/**
 * Builds the thumbs array images
 * @param ad
 * @return {Array}
 */
function adThumbs(ad) {
  if (!adHelpers.hasBlocketImages(ad)) {
    //Normal images way of working
    // TODO: use utils
    return _.map(ad.images, function (image, i) {
      var filename = image["original"]["src"].split('/').pop();
      var imageId = filename.split('.').shift().replace(/_/g, '-');
      return {
        url: imageHelper.getListImage(imageId, i, 'square'),
        id: imageId
      };
    });
  }
  //Special care for blocket ads just get the images out
  return _.map(ad.images, function (image) {
    //XXX: This is and UGLY hack but blocket ads will leave only 30 days so i don't care
    return image["original"]["src"].replace("/images/", "/thumbs/");
  });
}

/**
 * Ad edit
 */
router.use('/ad/:slug/edit', requireLogin, adMiddleware, function (req, res, next) {
  // If user doesn't own this ad
  if (req.user.id !== req.ad.attributes.account.account_id) {
    req.flash('error', req.i18n.__("You cannot edit this ad because you are not the seller."));
    return res.redirect('/ad/' + req.params.slug);
  }
  // Check ad status
  sdk.accountAds.get({
    userId: req.user.id,
    adId: req.ad.attributes.full_ad_id,
    jwt: req.user.jwt,
    ip: req.getClientIP()
  })
  .then(function (response) {
    req.handlePigeonResponse(response);
    var adState = response.data.attributes.state;

    // TODO: Add ad states to config file. REL-355
    if ( adState ==='expired' || adState ==='refused' || adState ==='deleted' || adState ==='pending_review') {
      req.flash('error', req.i18n.__("You can not edit this ad"));
      return res.redirect('/ad/' + req.params.slug);
    }
    next();
  })
  .catch(function (err) {
    req.flash('error', req.i18n.__("This ad is in review. You can not edit this ad at this moment. Please try again later"));
    return res.redirect('/ad/' + req.params.slug);
  });
});


// Ad edit
router.get('/ad/:slug/edit', requireLogin, adMiddleware, function (req, res, next) {
  var title = req.i18n.__('Edit ad');
  var ad = req.ad.attributes;

  // Make filters data in flat format
  // e.g given { cc: 1234, brand: { id: 2, title: 'Yamaha' }, mileage: 345 }
  // Output { cc: 1234, brand: 2, mileage: 345 }
  if(ad.parameters.filter_params){
    var currentFilterParams = ad.parameters.filter_params;
    var arr ={};
    Object.keys(currentFilterParams).forEach(function(key,value) {
      if(currentFilterParams[key].id){
        arr[key]=currentFilterParams[key].id;
      } else {
        arr[key]=currentFilterParams[key];
      }
    });
    var filterObject = {filters: arr};
    Object.assign(ad, filterObject);
  }

  // Get current uploaded image
  var thumbnails = adThumbs(ad);

  res.render('dashboard/ad-renew-form', {
    title: title,
    scripts: ['/js/ad-list.js'],
    ad: req.ad,
    adSlug: req.params.slug,
    thumbnails: thumbnails,
    blankImageFields: Math.abs(thumbnails.length - 3)
  });
});

/**
 * Get user's all ads from ask
 * @param user id
 * @return {Array}
 */
function userAds(userId){
  return new Promise(function (resolve, reject) {
    var params = {
      userId: userId
    };

    sdk.ask.userAds(params)
      .then(function (results) {
        resolve(results);
      })
      .catch(function (err) {
        if (err.is(sdk.ask.errors.NOT_FOUND)) {
          return resolve([]);
        }
        reject(err);
      });
  });
}
// Dashboard
router.get('/dashboard', requireLogin, function (req, res, next) {

  // Get the user
  sdk.account.profile({
      id: req.user.id,
      jwt: req.user.jwt,
      ip: req.getClientIP()
    })

    // Render the template
    .then(function (response) {
      req.handlePigeonResponse(response);
      var profile = response.data;
      var gender = (profile.attributes.preferences.hasOwnProperty('gender') &&  profile.attributes.preferences.gender === 1) ? 'female' : 'male';

      userAds(req.user.id).then(function (results) {

        var ads = _.map(results.data, function(ad){
          var adData = {
            adId: ad.id,
            title: ad.attributes.title,
            address: ad.attributes.address,
            slug: utils.makeUrlSlug(ad.attributes.title),
            description: ad.attributes.description,
            price: ad.attributes.price,
            image: adThumbs(ad.attributes)[0],
            list_time: moment(ad.attributes.list_time).calendar(null, {
                sameElse: 'DD/MM/YYYY'
              })
          };
          return adData;
        });

        res.render('dashboard/dashboard', {
          title: 'My Ads',
          scripts: [filerev.parse('/js/ad-list.js')],
          user: {
            id: profile.id,
            name: profile.attributes.name,
            preferences: profile.attributes.preferences,
            gender: gender
          },
          ads: ads
        });
      })
      .catch(function(err) {
        logger.error("An error occurred while fetching user ads. User was shown empty ad list.", err);
        next(err);
      });
    })

    .catch(function (err) {
      // If profile doesn't exist make sure error page is 404
      if (err.is(sdk.account.errors.NOT_FOUND)) {
        var error = new Error("Profile not found");
        error.status = 404;
        return next(error);
      }

      next(err);
    });
});

module.exports = router;
