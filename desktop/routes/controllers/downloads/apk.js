var logger = require('@ekhanei/logger').getLogger();
var mime = require('mime');
var AWS = require('aws-sdk');
var promise = require('promise');
var s3 = new AWS.S3({apiVersion: '2006-03-01'});
var config = require(__root+'/config/downloads');

/**
 * Returns requested apk version depending on request params
 * @private
 * @param {Object} params The request parameters
 * @returns {String|Bool} Version key if valid, false if not
 */
function getVersion(params) {
  var versionSpecified = typeof params.version !== "undefined";
  if (versionSpecified) {
    return (config.apk.versions.hasOwnProperty(params.version)) ? params.version : false;
  } else {
    return "latest";
  }
}

function getObjectStream(version) {
  var options = {
    Bucket: config.apk.bucket,
    Key: config.apk.versions[version].key
  };

  return promise(function(resolve, reject) {
    s3.headObject(options, function (err, data) {
      if (err) {
        return reject(err);
      }

      resolve(s3.getObject(options).createReadStream());
    });
  });
}

function routeHandler(req, res, next) {
  var apkVersion = getVersion(req.params);
  if (!apkVersion) {
    var error = new Error("Couldn't download APK. Requested version doesn't exist.");
    error.status = 404;
    return next(error);
  }

  // S3 object
  var options = {
    Bucket: config.apk.bucket,
    Key: config.apk.versions[apkVersion].key
  };

  s3.headObject(options, function (err, data) {
    if (err) {
      logger.error("Couldn't get APK from s3. An unexpected error occurred.", {
        error: err
      });
      return next(err);
    }

    var stream = s3.getObject(options).createReadStream()
      .on('error', function error(err) {
        logger.error("Couldn't get APK from s3. An stream error occurred and response was cancelled.", {
          error: err
        });
        next(err);
      })
      .on('end', function () {
        req.visitor.event('Download', 'APK Download').send();
      });

    // Set headers and pipe s3 object to response
    res.set('Content-Type', mime.lookup(options.Key));
    res.set('Content-Length', data.ContentLength);
    res.set('Content-disposition', 'attachment; filename=ekhanei-' + apkVersion+'.apk');
    res.set('Last-Modified', data.LastModified);
    res.set('ETag', data.ETag);
    stream.pipe(res);
  });
}
module.exports.routeHandler = routeHandler;