"use strict";
var utils = require('@ekhanei/utils');
/**
 *    TRUE if the ad comes form blocket and is NOT yet migrated
 * @param ad
 * @return {*|boolean}
 */
exports.isFromBlocket = function (ad) {
  return utils.has(ad, "parameters") && utils.has(ad["parameters"], "platform") && ad["parameters"]["platform"] == "blocket";
};

/**
 * @param ad
 * @return {*}
 */
exports.blocketThumb = function (ad) {
  if (!exports.hasBlocketImages(ad)) {
    return null;
  }
  var images = ad.images;
  //XXX: handle empty images to default category icon
  return images[0]["original"]["src"].replace('/images/', '/thumbs/');
};

/**
 *  Checks if the ad has blocket images
 * @param ad
 * @return {boolean}
 */
exports.hasBlocketImages = function (ad) {
  var images = ad.images || [];
  var imageData = "";
  for (var i = 0; i < images.length; i++) {
    imageData = images[i]["original"]["src"] || "";
    if (imageData.indexOf("img.ekhanei.com") != -1) {
      return true;
    }
  }
  return false;
};
