"use strict";
var express = require('express');
var router = express.Router();
var sdk = require('@ekhanei/sdk');
var logger = require('@ekhanei/logger').getLogger();
var utils = require('@ekhanei/utils');
var _ = require('lodash');
var Promise = require('promise');
var querystring = require('querystring');
var searchHints = require('../config/search-hints');
var config = require('../config/ads');
var surveyUrls = require('../config/surveyurl');
var adHelpers = require("../lib/helpers/ad-helper");
var imageHelper = require('../lib/helpers/image-helper');

/**
 * @param request
 * @return {Number|number}
 */
function getCurrentPage(request) {
  return parseInt(request.query.page, 10) || 1;
}

/**
 * Sends the search request to ASK
 * @param request
 * @return {*}
 */
function search(request) {
  var  currentCategory = getCurrentCategory(request);
  // Construct filter query. Wrap it in a promise so we can
  // catch errors here
  return new Promise(function (resolve, reject) {
    var params = {
      filter: {
        q: request.query.q || 'all',
        category: request.query.cat || null,
        ip: request.getClientIP(),
        price: {
          min: request.query["low-price"]||null,
          max: request.query["high-price"]||null
        },
        mileage: (request.query["mileage-id"])?getFiltersMaxMin(request, currentCategory, 'mileage'):null,
        cc: (request.query["cc-id"])?getFiltersMaxMin(request, currentCategory, 'cc'):null,
        brand: request.query["brand-ids"]?(request.query["brand-ids"].length === 1?[request.query["brand-ids"]]:request.query["brand-ids"]):null,
        gender: request.query["gender-id"]||null,
        fashion_category_women: request.query["fashion_category_women-ids"]?(typeof request.query["fashion_category_women-ids"] === 'string'?[request.query["fashion_category_women-ids"]]:request.query["fashion_category_women-ids"]):null,
        fashion_category_men: request.query["fashion_category_men-ids"]?(typeof request.query["fashion_category_men-ids"] === 'string'?[request.query["fashion_category_men-ids"]]:request.query["fashion_category_men-ids"]):null,
      },
      page: {
        number: getCurrentPage(request),
        size: config.pageSize
      },
      ip: request.getClientIP()
    };

    sdk.ask.search(params)
      .then(function (results) {
        resolve(results);
      })
      .catch(function (err) {
       if (err.is(sdk.ask.errors.NOT_FOUND)) {
           resolve([]);
        }
        reject(err);
      });
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
    return _.map(ad.attributes.images, function (image) {
      var filename = image["original"]["src"].split('/').pop();
      return filename.split('.').shift().replace(/_/g, '-');
    });
  }
  //Special care for blocket ads just get the images out
  return _.map(ad.attributes.images, function (image) {
    //XXX: This is and UGLY hack but blocket ads will leave only 30 days so i don't care
    return image["original"]["src"].replace("/images/", "/thumbs/");
  });
}

/**
 *  Builds the Ad object to inject in the view
 * @param searchResults
 * @return {Array}
 */
function adsForList(searchResults) {
  return _.map(searchResults.data, function (ad) {
    return {
      id: ad.id,
      slug: utils.makeUrlSlug(ad.attributes.title),
      title: ad.attributes.title,
      thumbnail: adThumbs(ad)[0],
      description: ad.attributes.description,
      price: ad.attributes.price,
      location: ad.attributes.address,
      isFromBlocket: adHelpers.isFromBlocket(ad.attributes),
      blocketThumb: adHelpers.blocketThumb(ad.attributes),
      hasBlocketImages: adHelpers.hasBlocketImages(ad.attributes)
    };
  });
}

/**
 * Returns category array with links to change category
 * while keeping other query params the same, apart
 * from page number which is reset
 * @param request
 * @return {Array}
 */
function getCategoryLinks(request) {
  var arr = [];
  // All categories (reset)
  var q = _.clone(request.query);
  if (q.page) {
    delete q.page;
  }

  // Delete all query string except search and category
  Object.keys(q).forEach(function(key,value) {
    if(key != 'q' && key != 'cat'){
      delete q[key];
    }
  });
  // Categories
  for (var i in request.categories) {
    var category = request.categories[i];
    // Create query string
    if (category.default) {
      delete q.cat;
    } else {
      q.cat = category.id;
    }
    category.link = '/?' + querystring.stringify(q);
    arr.push(category);
  }
  // Category order by order asc
  arr = _.orderBy(arr, ['order'], ['asc']);
  return arr;
}

/**
 *    Builds the current category data
 * @param request
 * @return {*}
 */
function getCurrentCategory(request) {
  var allCategories = request.categories[0];

  var category = _.find(request.categories, ['id', parseInt(request.query.cat, 10)]);
  if (category) {
    return category;
  } else {
    return allCategories;
  }
}

/**
 * Determines the title to use for ad listings.
 * @param currentCategory
 * @param request
 * @return {*}
 */
function getPageTitle(currentCategory, request) {
  if (currentCategory.id !== 0) {
    var localizedName = request.i18n.__(currentCategory.name).toLowerCase();
    return request.i18n.__("Buy and sell %s in Bangladesh", localizedName);
  }
  return request.i18n.__("Buy and sell in Bangladesh");
}

/**
 * Builds a random search hint string
 * @param request
 * @return {*}
 */
function getSearchHint(request) {
  return request.i18n.__("E.g. %s in %s", utils.randomItem(searchHints.keywords), utils.randomItem(searchHints.places));
}

/**
 * Builds the pagination link
 * @param request
 * @param page
 * @param totalPages
 * @return {*}
 */
function getPageLink(request, page, totalPages) {
  var q = _.clone(request.query);
  q.page = page;
  if (page > 0 && page <= totalPages) {
    return '/?' + querystring.stringify(q);
  }
  return null;
}

/**
 * Returns URL for the search form action
 * @param req
 * @return {string}
 */
function getSearchAction(req) {
  var q = _.clone(req.query);
  if (q.page) {
    delete q.page;
  }
  return '/?' + querystring.stringify(q);
}
/**
 * Returns URL for survey
 * @param req
 * @return {string}
 */
function surveyUrl (req){
  var adpostSelectedCategory = req.flash('adpostSelecetedCategory')[0];
  if(typeof adpostSelectedCategory !== "undefined" && adpostSelectedCategory) {
    // Serve survey moneky fashion url
    if(parseInt(adpostSelectedCategory) === 2) {
      return surveyUrls.sellers.fashion.url;
    }
    // Serve survey moneky bike url
    else if(parseInt(adpostSelectedCategory) === 6) {
      return surveyUrls.sellers.bike.url;
    }
    // Serve survey moneky other url
    else {
      return surveyUrls.sellers.others.url;
    }
  }
}

function getFiltersMaxMin (req, currentCategory, slug){

  var filterId = parseInt(req.query[slug+"-id"]);

  var filterDatas = _.map(currentCategory.filters,function(filters){
    return _.filter(filters.filter_options,function(filterOptions){
      return (filterOptions.id === filterId && filters.slug === slug);
    });
  });
  var minMax = _.map(_.flatten(filterDatas), function (n){
    return {
      "min" : n.min,
      "max" : n.max
    };
  });
  return minMax[0];
}

/**
 * Get current user
 */
router.use('/', function (req, res, next) {

  res.locals.categories = req.categories;

  // Remove "All Category" from the ad insertion category list
  var aiCategories = _.clone(req.categories);
  res.locals.aiCategories = _.filter(aiCategories, function(n) {
    return n.id !== 0;
  });

  if (req.user) {
    sdk.account.profile({
        id: req.user.id,
        jwt: req.user.jwt,
        ip: req.getClientIP()
      })
      .then(function (response) {
        req.handlePigeonResponse(response);
        var profile = response.data;

        var prefs = profile.attributes.preferences;
        // If business seller
        if (prefs.type.id == 'Business') {
          // Determine which categories to show
          var categoryId = parseInt(prefs.type.categories[0], 10);
          res.locals.aiCategories = _.filter(aiCategories, ['id', categoryId]);

          // Force select the category
          res.locals.form = res.locals.form || {};
          res.locals.form.category = categoryId;
        }

        // Should we pre-populate the location?
        res.locals.location = prefs.hasOwnProperty('location') ? prefs.location : null;
        next();
      })
      .catch(function (err) {
        next(err);
      });
  } else {
    next();
  }
});

/**
 * Ad listing
 */
router.get('/', function (req, res, next) {
  req.session.adDetailsBackLink = req.originalUrl;
  var currentPage = getCurrentPage(req);
  var totalPages = null; // Populated later
  var currentCategory = getCurrentCategory(req);

  new Promise(function(resolve, reject) {
    search(req).then(function (results) {
      if (Array.isArray(results) && results.length === 0) {
        return resolve([]);
      }
      // Calculate total pages
      var adCount = results.meta.total;
      totalPages = Math.ceil(adCount / config.pageSize);
      resolve(adsForList(results));
    })
    .catch(function(err) {
      logger.error("An error occurred while fetching ads. User was shown empty ad list.", err);
      resolve([]);
    });
  })
  // Set view data and render
  .then(function (ads) {
    // Standardize blocket/non-blocket images
    ads = _.map(ads, function(ad, index) {
      if (ad.hasBlocketImages) {
        ad.thumb = ad.blocketThumb;
      } else {
        ad.thumb = imageHelper.getListImage(ad.thumbnail, index, 'thumb');
      }
      return ad;
    });

    res.render('ads/index', {
      title: getPageTitle(currentCategory, req),
      scripts: ['/js/ad-list.js'],
      categoryLinks: getCategoryLinks(req),
      currentCategory: currentCategory,
      loadCriteo: ((parseInt(currentCategory.id, 10) > 0)||(currentPage > 1))? true : false,
      searchQuery: req.query.q || null,
      searchHint: getSearchHint(req),
      searchAction: getSearchAction(req),
      ads: ads,
      thankyouView: req.flash('thank_you'),
      adpostSurveyUrl: surveyUrl(req) || '/',
      pages: {
        current: currentPage,
        next: getPageLink(req, currentPage + 1, totalPages),
        prev: getPageLink(req, currentPage - 1, totalPages)
      },
      currentPriceFilter: {
        min: req.query["low-price"],
        max: req.query["high-price"]
      }
    });
  })
  .catch(function (err) {
    next(err);
  });
});

module.exports = router;
