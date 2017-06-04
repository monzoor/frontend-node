var express = require("express");
var router = express.Router();
var sdk = require("@ekhanei/sdk");
var logger = require("@ekhanei/logger").getLogger();
var request = require("request");
var fs = require("fs");
var _ = require("lodash");
var imageController = require("./controllers/images/images-controller");
var imageConfig = require("../config/image");

/**
 * String interpolation helper.
 * @TODO: move to @ekhanei/utils?
 */
var _interpolate = function (str, options) {
  for (var key in options) {
    str = str.replace("{" + key + "}", options[key]);
  }

  return str;
};

/**
 * Generates and returns a size key (i.e. thumbnail_w100_h100)
 * based on the image size config
 */
var _getSizeKey = function (config) {
  if (config.type == "thumbnail") {
    return _interpolate("thumbnail_w{width}_h{height}", {
      "width": config.attributes.width,
      "height": config.attributes.height
    });
  }
  else if (config.type == "watermark") {
    return _interpolate("watermark_{type}_{position}_w{width}_h{height}", {
      "type": config.attributes.type,
      "position": _.snakeCase(config.attributes.position),
      "width": config.attributes.resize.width,
      "height": config.attributes.resize.height
    });
  }
};

/**
 * Gets the image url for the required size, transforming
 * if necessary. Returns a promise.
 */
var _getImageSrc = function (params) {
  params = _.merge({
    id: null,
    config: null,
    ip: null
  }, params);

  // Get the image info
  return sdk.image.getInfo({
      id: params.id,
      ip: params.ip
    })

    // If the image exists in the required size then return
    // the src, otherwise transform it and then return the src
    .then(function (imageInfo) {
      // If this size already exists then return the src
      var sizeKey = _getSizeKey(params.config);
      if (imageInfo.data.attributes.hasOwnProperty(sizeKey)) {
        return imageInfo.data.attributes[sizeKey].src;
      }

      // Otherwise do the image transform
      return sdk.image.transform({
          id: params.id,
          type: params.config.type,
          attributes: params.config.attributes,
          ip: params.ip,
        })
        .then(function (response) {
          // Return the newly transformed image src
          return response.data.attributes[sizeKey].src;
        });
    });
};

router.get("/resize/:imageId/:size", imageController.genericResizeAction);


/**
 * Avatars
 * Vanity URL which can be specified as an <img> source. It
 * will return a 302 redirect to the image file.
 *
 * @param userId The UUID of the user
 * @param size   The size of image to display
 */
router.get("/avatar/:imageId/:size", function (req, res, next) {
  // If this size does not exist
  if (!imageConfig.avatar.sizes.hasOwnProperty(req.params.size)) {
    return res.status(404).send("Image not found");
  }

  // If the user doesn"t have an avatar then pipe the
  // default image to client
  if (req.params.imageId == "default") {
    var defaultPath = imageConfig.avatar.sizes[req.params.size].default;
    return fs.createReadStream(defaultPath).pipe(res);
  }

  // Otherwise get the image src
  _getImageSrc({
    id: req.params.imageId,
    config: imageConfig.avatar.sizes[req.params.size],
    ip: req.getClientIP()
  })

  // Pipe the image to the client
    .then(function (imageSrc) {
      request.get(imageSrc).pipe(res);
    })
    .catch(function (err) {
      // if image is broken show the default avatar
      var defaultPath = imageConfig.avatar.sizes[req.params.size].default;
      return fs.createReadStream(defaultPath).pipe(res);
      //next(err);
    });
});

/**
 * Main ad image
 * Vanity URL which can be specified as an <img> source. It
 * will return a 302 redirect to the main ad photo.
 *
 * @param adId The ID of the ad
 * @param size The size of image to display
 */
router.get("/item/:adId/:size", function (req, res, next) {
  // If this size does not exist
  if (!imageConfig.ad.sizes.hasOwnProperty(req.params.size)) {
    return res.status(404).send("Image not found");
  }

  // Get the ad
  sdk.ask.getAd({
      id: req.params.adId,
      ip: req.getClientIP()
    })

    // Construct the image id for the main (first) image
    // using the original source url
    .then(function (ad) {
      var src = ad.data.attributes.images[0].original.src,
        filename = src.split("/").pop(),
        imageId = filename.split(".").shift().replace(/_/g, "-");

      return _getImageSrc({
        id: imageId,
        config: imageConfig.ad.sizes[req.params.size],
        ip: req.getClientIP()
      });
    })

    // Pipe the image to the client
    .then(function (imageSrc) {
      request.get(imageSrc).pipe(res);
    })

    .catch(function (err) {
      next(err);
    });
});

/**
 * Single ad image
 * Vanity URL which can be specified as an <img> source. It
 * will return a 302 redirect to the image file.
 *
 * @param imageId The UUID of the image
 * @param size    The size of image to display
 */
router.get("/:imageId/:size", function (req, res, next) {
  // If this size does not exist
  if (!imageConfig.ad.sizes.hasOwnProperty(req.params.size)) {
    return res.status(404).send("Image not found");
  }

  // Get the image src
  _getImageSrc({
    id: req.params.imageId,
    config: imageConfig.ad.sizes[req.params.size],
    ip: req.getClientIP()
  })

  // Pipe the image to client
    .then(function (imageSrc) {
      request.get(imageSrc).pipe(res);
    })
    .catch(function (err) {
      next(err);
    });
});

/**
 * Error handler
 */
router.use(function (err, req, res, next) {
  var message = "Error loading image, reason: " + err.message;

  if (err.stack) {
    message += "\n" + err.stack;
  }

  logger.error(message);
  res.sendStatus(500);
});

module.exports = router;
