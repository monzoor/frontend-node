var express = require('express');
var router = express.Router();
var passport = require('passport');
var fs = require('fs');
var multer = require('multer');
var logger = require('@ekhanei/logger').getLogger();
var _ = require('lodash');
var sdk = require('@ekhanei/sdk');
var utils = require('@ekhanei/utils');
var Promise = require('promise');
var imageConfig = require('../config/image');
var moment = require('moment');


// Configure Multer Middleware
var upload = multer({
  dest: imageConfig.ad.tmp_upload_path,
  fileFilter: function (req, file, cb) {
    var mimeType = file.mimetype || "";
    if (mimeType.indexOf('image') === -1) {
      return cb(null, false);
    }

    cb(null, true);
  }
});

/**
 * Upload photos
 * Accepts a request object (where multer middleware has
 * already attached files), uploads photos to sdk, and
 * returns a promise resolved with an array of photo ids.
 */
var uploadPhotos = function (req) {

  // Upload all photos in parallel
  var resolve = [];
  for (var i = 0; i < req.files.length; i++) {
    var promise = sdk.image.upload({
      ip: req.getClientIP(),
      jwt: req.user.jwt,
      source: req.getDevice(),
      image: fs.createReadStream(req.files[i].path)
    });

    resolve.push(promise);
  }

  return Promise.all(resolve).then(function (responses) {
    // Unlink temporary images (async)
    for (var i = 0; i < req.files.length; i++) {
      fs.unlink(req.files[i].path);
    }

    // Create array of photo IDs
    var photoIds = _.map(responses, function (response) {
      return response.data.id;
    });

    if(req.body.images) {
      // Make image id object only when ad has only one image
      if(utils.isString(req.body.images)){
        req.body.images = [req.body.images];
      }
      // Concat preloaded image ad and new uploaded image id
      photoIds = req.body.images.concat(photoIds);
    }

    return photoIds;
  });
};

/**
 * Validate submission
 * Returns true if the ad submission is well formed, false
 * if not. Checks photos and form data.
 */
var validateSubmission = function (req) {
  // If there are no photos
  // Users shouldn't ever encounter these errors due to
  // client-side validation, but can never be too sure!
  if (!req.files) {
    req.flash('form', req.body);
    req.flash('errors', {
      photos: req.i18n.__("You must upload at least 1 photo")
    });
    return false;
  }
  // trim space from price
  req.body.price = req.body.price.replace(/\s/g, "");

  // Validate form input
  var invalid = req.validateForm(global.validate.adEdit);

  if (invalid) {
    req.flash('errors', invalid.errors);
    req.flash('form', req.body);
    return false;
  }

  return true;
};

/*
* Make filter aparameters data according to Pegion's format
* @param {object}
* @return {object||null}
*/
var getFilterParams = function (req){
  var categoryId = parseInt(req.body.category),
      filterParams = _.clone(req.body.filters),
      categories = req.categories;

  if(typeof req.body.filters !== 'undefined'){
    Object.keys(filterParams).forEach(function (key,value){
      var param = flatten(getFiltersValues(categories,categoryId,key,filterParams[key]));
      param = _.map(param, function(f){
        return _.omit(f, 'child_slug');
      });
      filterParams[key] = param[0]||filterParams[key];
    });
  }
  return filterParams||null;
};

/*
* Return all filter params from pinion for the category
* @param {object,integer,string,integer}
* @return {object}
*/
var getFiltersValues = function (categories,catId,slug,filterId){
  var filterDatas = categories.filter(function(catObject) {
    return catObject.id === catId;
  })
  .map(function(category){
    return category.filters.map(function(slugName){
      return _.filter(slugName.filter_options, function(filterData){
        return (filterData.id === filterId && slugName.type === 'select' && slugName.slug === slug);
      });
    });
  });
  return _.without(_.flatten(filterDatas),undefined);
};

// Make data flat
var flatten = function (items){
  return _.flatMap(items, function(item) {
    return item.items ? flatten(item.items) : item;
  });
};

/*
* Get current ad state and expire time
* @param {object}
* @return {boolean||integer}
*/
var adStatus = function (req){
  return sdk.accountAds.get({
      userId: req.user.id,
      adId: req.body.adId,
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
        return {
          exprireTime: moment().add(30, 'days').format(), // Current time + 30days
          state: adState
        };
      }
      // TODO: Refactor states to config file. REL-255
      else if ( adState ==='expired' || adState ==='refused' || adState ==='deleted' || adState ==='pending_review') {
        return false;
      }
      return {
        state: adState
      };
    })
    .catch(function (err) {
      return false;
    });
};
// Require login
router.use('/', require('../middleware/require-login'));

// Main ad insertion logic
router.post('/', upload.array('photo', 3), function (req, res, next) {

  // Make all filters data integer
  if(typeof req.body.filters !== 'undefined'){
    var filters = req.body.filters;
    filters = Object.keys(filters).reduce(function (obj, key) {
      obj[key] = filters[key].match('^\\d+$')? parseInt(filters[key], 10): filters[key];
      return obj;
    }, {});
    req.body.filters = filters;
  }

  var filterParams = getFilterParams(req)|| null;

  // Validate submission
  if (!validateSubmission(req)) {
    return res.redirect('/ad/'+req.body.adslug+'/edit/?postad=true');
  }

  // Get ad state, Upload the photos and update the user's profile
  // location in parallel
  Promise.all([
      adStatus(req),
      uploadPhotos(req)
    ])

    // Create the ad
    .then(function (responses) {
      if(responses[0] === false){
        req.flash('alert', req.i18n.__("Sorry you can not edit the ad"));
        return res.redirect('/ad/'+req.body.adslug);
      }
      var imageIds = responses[1],
          expirationTime = responses[0].exprireTime || null,
          adState = responses[0].state || null;


      return sdk.accountAds.update({
        userId: req.user.id,
        jwt: req.user.jwt,
        ip: req.getClientIP(),
        userAgent: req.headers['user-agent'],
        source: req.getDevice(),
        language: 'en', // @TODO: grab language
        ad: {
          description: req.body.description,
          title: req.body.title,
          price: req.body.price,
          category: req.body.category,
          address: req.body.address,
          images: imageIds,
          expiration_time: expirationTime,
          parameters: {
            filter_params: filterParams,
            edit_before_state: adState
          }
        },
        adId: req.body.adId,
      });
    })

    // The ad was successfully submitted
    .then(function (response) {
      req.handlePigeonResponse(response);

      req.flash('thank_you', true);
      req.flash('adpostSelecetedCategory', req.body.category);
      res.redirect('/');
    })
    .catch(function (err) {
      // If the ad was rejected we shouldn't give the user
      // any indication that this is the case
      if ((err.is(sdk.accountAds.errors.AD_REJECTED)) || (err.is(sdk.accountAds.errors.FORBIDDEN))) {
        req.flash('thank_you', true);
        res.redirect('/');
      }else{
        next(err);
      }

    });
});

module.exports = router;
