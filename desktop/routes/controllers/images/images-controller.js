"use strict";
var sdk = require("@ekhanei/sdk");
var logger = require("@ekhanei/logger").getLogger();
var util = require("util");
var httpClient = require("request");

/**
 *  Gets the image info or logs the error
 * @param request
 * @param imageID
 * @return {Promise}
 */
function getImageInfo(request, imageID) {
  return sdk.image.getInfo({
      id: imageID,
      ip: request.getClientIP()
    })
    .then(function (imageInfo) {
      return imageInfo;
    })
    .catch(function (imageError) {
      //I should check the proper error, 404 or 5XX but i pass.
      logger.error("Could not get image %s information, error: %s", util.inspect(imageError));
      return null;
    });
}

/**
 * @param imageSize
 * @return {*}
 */
function getImageSize(imageSize) {
  var imageSizeRegexp = new RegExp("^(w([0-9]+))(xh([0-9]+))?$");
  if (!imageSizeRegexp.test(imageSize)) {
    return null;
  }
  var imageResize = {};
  try {
    var imageMatch = imageSizeRegexp.exec(imageSize);
    imageResize = {
      width: parseInt(imageMatch[2], 10)
    };
    if (imageMatch[4]) {
      imageResize["height"] = parseInt(imageMatch[4], 10);
    }
  } catch (parseError) {
    logger.error("Unexpected error while getting the image size, %s", util.inspect(parseError));
    imageResize = null;
  }
  return imageResize;
}

/**
 *    Builds the transformation request based on the request information
 * @param imageInfo
 * @param request
 * @return {{id: *, ip: *, type: string, attributes: {constraints: string[]}}}
 */
function buildTransformationRequest(imageInfo, request) {
  var imageSize = getImageSize(request.params.size);
  var watermark = request.query.hasOwnProperty("watermark");
  var transformationRequest = {
    id: imageInfo["data"]["id"],
    ip: request.getClientIP(),
    type: "resize",
    attributes: {
      constraints: [
        "aspect-ratio"
      ]
    }
  };

  //Handle watermark or normal resize
  if (watermark) {
    transformationRequest.type = "watermark";
    transformationRequest.attributes = {
      type: "local",
      data: "watermark_bangladesh.png",
      position: "random",
      resize: imageSize
    }
  } else {
    if (imageSize.hasOwnProperty("width")) {
      transformationRequest.attributes["width"] = imageSize["width"];
    }
    if (imageSize.hasOwnProperty("height")) {
      transformationRequest.attributes["height"] = imageSize["height"];
    }
  }
  return transformationRequest;
}

/**
 *    Returns the transformed image data
 * @param imageInfo
 * @param request
 * @return {Promise}
 */
function resizeImage(imageInfo, request) {
  var imageSize = getImageSize(request.params.size);
  if (imageSize === null) {
    throw new Error("Unexpected error while resizing image");
  }
  var transformationRequest = buildTransformationRequest(imageInfo, request);
  return sdk.image.transform(transformationRequest)
    .then(function (transformResponse) {
      // Return the newly transformed image info
      return transformResponse["data"]["attributes"][transformResponse["meta"]["transformation_id"]];
    })
    .catch(function (transformationError) {
      logger.error("Unexpected error while transforming image, error: %s", util.inspect(transformationError));
      return null;
    });
}

/**
 *  Handles router.get("/resize/:imageId/:size", imageController.genericResizeAction);
 * @param request
 * @param response
 * @param next
 */
function genericResizeAction(request, response, next) {
  return getImageInfo(request, request.params.imageId)
    .then(function (imageInfo) {
      if (imageInfo === null) {
        return response.status(404).send("Image not found");
      }
      return resizeImage(imageInfo, request)
        .then(function (resizeResponse) {
          if (resizeResponse !== null && resizeResponse.hasOwnProperty("src")) {
            return httpClient.get(resizeResponse["src"]).pipe(response);
          }
          next(new Error("Unexpected error while sending transformed image"));
        })
        .catch(function (resizeError) {
          next(resizeError);
        });
    });
}

exports.genericResizeAction = genericResizeAction;
