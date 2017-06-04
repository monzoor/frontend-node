"use strict";
var express = require('express');
var router = express.Router();
var sdk = require('@ekhanei/sdk');
var utils = require('@ekhanei/utils');
var _ = require('lodash');
var moment = require('moment');
var adMiddleware = require("../middleware/ad-middleware");
var adHelpers = require("../lib/helpers/ad-helper");
var imageHelper = require('../lib/helpers/image-helper');
var surveyUrls = require('../config/surveyurl');

/**
 *   Builds the proper phone information to show on the view
 * @param ad
 * @return {{full: *, pretty: *}}
 */
function phoneNumber(ad) {
  if (!adHelpers.isFromBlocket(ad)) {
    return {
      full: ad["account"]["phone"][0],
      pretty: utils.prettyPhoneNumber(ad["account"]["phone"][0])
    }
  }
  //Special care for those ads that are from blocket
  return {
    full: ad["parameters"]["blocket_phone"],
    pretty: utils.prettyPhoneNumber(ad["parameters"]["blocket_phone"])
  }
}

/**
 *    Builds the image array depending on where the ad comes from
 * @param ad
 * @return {Array}
 */
function adImages(ad) {
  if (!adHelpers.hasBlocketImages(ad)) {
    //Normal images way of working
    return _.map(ad.images, function (image, i) {
      var filename = image["original"]["src"].split('/').pop();
      var imageId = filename.split('.').shift().replace(/_/g, '-');
      return imageHelper.getListImage(imageId, i, 'medium');
    });
  }
  //Special care for blocket ads just get the images out
  return _.map(ad.images, function (image) {
    //XXX: This is and UGLY hack but blocket ads will leave only 30 days so i don't care
    return image["original"]["src"];
  });
}

/**
 * Builds the thumbs array images
 * @param ad
 * @return {Array}
 */
function adThumbs(ad) {
  if (!adHelpers.hasBlocketImages(ad)) {
    //Normal images way of working
    return _.map(ad.images, function (image, i) {
      var filename = image["original"]["src"].split('/').pop();
      var imageId = filename.split('.').shift().replace(/_/g, '-');
      return imageHelper.getListImage(imageId, i, 'square');
    });
  }
  //Special care for blocket ads just get the images out
  return _.map(ad.images, function (image) {
    //XXX: This is and UGLY hack but blocket ads will leave only 30 days so i don't care
    return image["original"]["src"].replace("/images/", "/thumbs/");
  });
}

/**
 * Returns URL for survey
 * @param category id
 * @return {string}
 */
function surveyUrl (cat){
  // Serve survey moneky fashion url
  if(cat === 2) {
    return surveyUrls.buyers.fashion.url;
  }
  // Serve survey moneky bike url
  else if(cat === 6) {
    return surveyUrls.buyers.bike.url;
  }
  // Serve survey moneky other url
  else {
    return surveyUrls.buyers.others.url;
  }
}

/**
 * Ad view
 */
router.get('/ad/:slug', adMiddleware, function (req, res, next) {
  var ad = req.ad.attributes;

  ad.id = req.ad.id;
  // Add line breaks to ad description
  ad.description = ad.description.replace(/(?:\r\n|\r|\n)/g, '<br />');
  ad.list_time = moment(ad.list_time).calendar(null, {
    sameElse: 'DD/MM/YYYY'
  });

  // Construct array of image ids from the sources
  var images = adImages(ad),
      thumbnails = adThumbs(ad),
      ogImage = images[0].replace('medium','opengraph');

  var viewData = {
    title: ad.title,
    scripts: ['/js/ad-view.js'],
    adSlug: req.params.slug,
    ad: ad,
    phoneNumber: phoneNumber(ad),
    images: images,
    thumbnails: thumbnails,
    multipleImages: (images.length > 1),
    ogImage: ogImage,
    chatLink: '/messages/' + req.ad.id,
    isOwn: (req.user && ad.account.account_id === req.user.id),
    isFromBlocket: adHelpers.isFromBlocket(ad),
    hasBlocketImages: adHelpers.hasBlocketImages(ad),
    surveyUrl: surveyUrl(ad.category.id) || '/'
  };
  // Render the view
  res.render('ads/single', viewData);
});

module.exports = router;
