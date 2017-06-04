var express = require('express');
var router = express.Router();
var passport = require('passport');
var fs = require('fs');
var multer = require('multer');
var _ = require('lodash');
var logger = require('@ekhanei/logger').getLogger();
var sdk = require('@ekhanei/sdk');
var Promise = require('promise');
var jwtApiCredentials = require('@ekhanei/jwt-api-credentials');
var imageConfig = require('../config/image');
var requireLogin = require('../middleware/require-login');

// Multer Middleware
var upload = multer({
  dest: imageConfig.avatar.tmp_upload_path,
  fileFilter: function (req, file, cb) {
    var mimeType = file.mimetype || "";
    if (mimeType.indexOf('image') === -1) {
      return cb(null, false);
    }
    cb(null, true);
  }
});

/**
 * Get current user
 *
 * Each time we receive a /me request, get the current user,
 * set the view data, and pass it along.
 */
router.use('/me', requireLogin, function (req, res, next) {
  sdk.account.profile({
      id: req.user.id,
      jwt: req.user.jwt,
      ip: req.getClientIP()
    })
    .then(function (response) {
      req.handlePigeonResponse(response);
      // Attach profile data to request
      req.profile = profile = response.data;

      // Set template vars
      res.locals.user = {
        id: profile.id,
        name: profile.attributes.name,
        verified: (profile.attributes.status === 'verified'),
        preferences: profile.attributes.preferences
      };
      res.locals.loggedIn.name = profile.attributes.name;

      next();
    })
    .catch(function (err) {
      if (err.is(sdk.account.errors.NOT_FOUND)) {
        var error = new Error("Profile not found");
        error.status = 404;
        return next(err);
      }
      next(err);
    });
});

/**
 * My profile
 */
router.get('/me', requireLogin, function (req, res, next) {
  var title = req.i18n.__('My profile');
  // Send phone number for verification
  var phoneNum = '';
  res.render('profile/edit', {
    title: title,
    scripts: ['/js/profile-edit.js'],
    header: {
      title: title,
      joined: true
    },
    phone: phoneNum
  });
});

/**
 * Upload Profile Avatar
 */
router.post('/me/edit', upload.single('photo'), function (req, res, next) {

  // If no photo uploaded
  if (!req.file) {
    return next();
  }
  var avatarImageId = 'default';

  sdk.image.upload({
      ip: req.getClientIP(),
      jwt: req.user.jwt,
      source: req.getDevice(),
      image: fs.createReadStream(req.file.path)
    })

    // Associate uploaded photo with profile
    .then(function (response) {
      // Delete temporary image
      fs.unlinkSync(req.file.path);

      avatarImageId = response.data.id;

      return sdk.account.update({
        id: req.user.id,
        data: {
          preferences: {
            avatarImageId: response.data.id
          }
        },
        ip: req.getClientIP(),
        jwt: req.user.jwt
      });
    })

    .then(function (response) {
      req.handlePigeonResponse(response);
      req.user.avatar = avatarImageId;
      res.locals.loggedIn.avatar = avatarImageId;
      req.flash('info', req.i18n.__("Profile picture updated"));
      req.flash('changedAvatar', true);
      return next();
    })

    .catch(function (err) {
      next(err);
    });
});

/**
 * Update profile
 */
router.post('/me/edit', requireLogin, function (req, res, next) {

  // Make numeric to integer
  req.body.preferences.dob.day = parseInt(req.body.preferences.dob.day) || null;
  req.body.preferences.dob.month = parseInt(req.body.preferences.dob.month) || null;
  req.body.preferences.dob.year = parseInt(req.body.preferences.dob.year) || null;

  //delete objects if form inputs are empty
  if(!(req.body.preferences.gender = parseInt(req.body.preferences.gender))){
    delete req.body.preferences.gender;
  }
  // Validate form
  var invalid = req.validateForm(global.validate.updateProfile);
  if (req.body.preferences.dob.year >= new Date().getFullYear()) {
    invalid =  {errors: { 'preferences/dob': true }};
  }
  if (invalid) {
    req.flash('errors', invalid.errors);
    req.flash('form', req.body);
    return res.redirect('/profile/me');
  }

  // Is phone currently hidden?
  var phoneHidden = (req.profile.attributes.hasOwnProperty('preferences')
      && req.profile.attributes.preferences.hasOwnProperty('hidePhone')
      && req.profile.attributes.preferences.hidePhone);
  // Does user want to hide phone?
  var hidePhone = typeof req.body.preferences.hidePhone !== 'undefined';

  // Explicitly set hidePhone Bool in preferences.
  // Note that form value is either string or undefined.
  req.body.preferences.hidePhone = hidePhone;

  // Track event
  if (!phoneHidden && hidePhone) {
    req.visitor.event('Edit Profile', 'Hide Phone Number').send();
  } else if (phoneHidden && !hidePhone) {
    req.visitor.event('Edit Profile', 'Show Phone Number').send();
  }

  if((req.body.preferences.dob.day == null) ||
    (req.body.preferences.dob.month == null) ||
    (req.body.preferences.dob.year == null)){
    delete req.body.preferences.dob;
  }
  // Update profile
  sdk.account.update({
      id: req.user.id,
      ip: req.getClientIP(),
      jwt: req.user.jwt,
      data: _.merge(req.body, {
        parameters: {
          userAgent: req.headers['user-agent'],
          source: req.getDevice(),
        }
      })
    })
    .then(function (response) {
      req.handlePigeonResponse(response);
      req.flash('info', req.i18n.__("Profile updated"));
      res.redirect('/profile/me');
    })
    .catch(function (err) {
      next(err);
    });
});

/**
 * User profile by ID
 */
router.get('/:userId', function (req, res, next) {

  // Use a non-user ID as this is a public route
  var jwt = jwtApiCredentials.generateJwt({
    service: 'pigeon',
    secret: process.env.PIGEON_API_SECRET,
    apikey: process.env.PIGEON_API_KEY
  });

  // Get the user
  sdk.account.profile({
      id: req.params.userId,
      jwt: jwt,
      ip: req.getClientIP()
    })

    // Render the template
    .then(function (response) {
      req.handlePigeonResponse(response);
      var profile = response.data;

      res.render('profile/index', {
        title: profile.attributes.name,
        header: {
          title: profile.attributes.name,
          joined: true,
          back: true
        },
        user: {
          id: profile.id,
          name: profile.attributes.name,
          verified: (profile.attributes.status === 'verified'),
          preferences: profile.attributes.preferences
        }
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
