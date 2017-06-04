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

var gaEventCategory = "Ad Insertion";

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

    return photoIds;
  });
};

/**
 * Update profile location
 * Keeps user's profile location current. If location is
 * not set on the user's profile then use the location
 * provided in the form
 */
var updateProfileLocation = function (req) {
  return sdk.account.profile({
      id: req.user.id,
      jwt: req.user.jwt,
      ip: req.getClientIP()
    })
    .then(function (response) {
      req.handlePigeonResponse(response);

      // Get user preferences
      var prefs = response.data.attributes.preferences;

      // User already has location set on their profile
      if (prefs.hasOwnProperty('location') && prefs.location.length) {
        return true; // Resolve
      }

      // Otherwise set the location on user's profile
      prefs.location = req.body.address;
      return sdk.account.update({
        id: req.user.id,
        ip: req.getClientIP(),
        jwt: req.user.jwt,
        data: {
          parameters: {
            userAgent: req.headers['user-agent'],
            source: req.getDevice(),
          },
          preferences: prefs
        }
      }).then(function (response) {
        req.handlePigeonResponse(response);
      });
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
  var invalid = req.validateForm(global.validate.postAd);

  if (invalid) {
    req.flash('errors', invalid.errors);
    req.flash('form', req.body);
    return false;
  }

  return true;
};


// Get filters data
function getFilterParams (req){
  var categoryId = parseInt(req.body.category),
      filterParams = _.clone(req.body.filters),
      categories = req.categories;

  if(typeof req.body.filters !== 'undefined'){
    Object.keys(filterParams).forEach(function(key,value) {
      var param = flatten(getFiltersValues(categories,categoryId,key,filterParams[key]));
      filterParams[key] = param[0]||filterParams[key];
    });
  }
  // remove child_slug key
  if(filterParams && typeof filterParams.gender !== 'undefined'){
    filterParams.gender=_.omit(filterParams.gender, 'child_slug');
  }
  return filterParams;
}
// Return all filter params for the category
function getFiltersValues(categories,catId,slug,filterId) {
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
}

// Make data flat
function flatten(items) {
  return _.flatMap(items, function(item) {
    return item.items ? flatten(item.items) : item;
  });
}

// Require login
router.use('/', require('../middleware/require-login'));

// Main ad insertion logic
router.post('/', upload.array('photo', 3), function (req, res, next) {
  
  // Make all filters data int
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
    return res.redirect('/?postad=true');
  }

  // Upload the photos and update the user's profile
  // location in parallel
  Promise.all([
      uploadPhotos(req),
      updateProfileLocation(req)
    ])

    // Create the ad
    .then(function (responses) {
      var imageIds = responses[0];

      return sdk.accountAds.create({
        userId: req.user.id,
        jwt: req.user.jwt,
        images: imageIds,
        ip: req.getClientIP(),
        userAgent: req.headers['user-agent'],
        source: req.getDevice(),
        language: 'en', // @TODO: grab language
        ad: {
          description: req.body.description,
          price: req.body.price,
          category: req.body.category,
          address: req.body.address
        },
        filterParams: filterParams
      });
    })

    // The ad was successfully submitted
    .then(function (response) {
      req.handlePigeonResponse(response);

      var status = response.data.attributes.status;

      if (status == 'pending_review') {
        // Track event
        req.visitor.event(gaEventCategory, 'Post Ad', 'Pending Review').send();
      }
      else if (status == 'post_review') {
        // Track event
        req.visitor.event(gaEventCategory, 'Post Ad', 'Post Review').send();

      }
      else {
        throw new Error("Unrecognized ad status");
      }

      req.flash('thank_you', true);
      req.flash('adpostSelecetedCategory', req.body.category);
      res.redirect('/');
    })
    .catch(function (err) {
      // If the ad was rejected we shouldn't give the user
      // any indication that this is the case
      if (err.is(sdk.accountAds.errors.AD_REJECTED)) {
        // Track event
        req.visitor.event(gaEventCategory, 'Post Ad', 'Rejected').send();
        req.flash('thank_you', true);
        res.redirect('/');
      }else {
        next(err);
      }
    });
});

module.exports = router;
