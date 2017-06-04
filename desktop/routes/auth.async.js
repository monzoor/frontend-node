var express = require('express');
var router = express.Router();
var logger = require('@ekhanei/logger').getLogger();
var passport = require('passport');
var sdk = require('@ekhanei/sdk');
var utils = require('@ekhanei/utils');
var _ = require('lodash');
var md5 = require('md5');
// Middleware
var requireLogin = require('../middleware/require-login');
var requireLogout = require('../middleware/require-logout');

var gaCategory = 'Login and Signup';

router.post('/login', requireLogout, function (req, res, next) {
  // Authenticate using local strategy
  passport.authenticate('local', function (err, user, info) {
    if (err) {
      res.send({
        error: true
      });
      return next(err);
    }

    if (!user) {
      req.visitor.event(gaCategory, "Login Fail").send();

      return res.send({
        error: true,
        message: req.i18n.__("The password or phone number you've entered is incorrect. <br/>Trouble login? try reset password Or <a href='' id='unverifiedAccountLink'>Verify mobile number</a> to complete registration")
      });
    }

    // Now log in the user
    req.logIn(user, function (err) {
      if (err) {
        return next(err);
      }

      // Track and log
      req.visitor.event(gaCategory, "Login Success").send();
      logger.log('debug', "User logged in.", req.user);

      /**
       * Store encrypted user credentials in session so we can
       * use them later to create XMPP sessions.
       */

        // Get user's account (for numeric ID)
      sdk.account.profile({
          id: user.id,
          jwt: user.jwt
        })

        // Encrypt user's password and store in session with
        // numerical user ID
        .then(function (response) {
          req.handlePigeonResponse(response);
          var profile = response.data;

          req.session.xmpp = {
            username: profile.attributes.numeric_id,
            password: utils.aesEncrypt(req.body.password, process.env.AES_SECRET)
          };
          user.name = profile.attributes.name;
          user.phoneNumberHashed = md5(profile.attributes.phone);
          if(profile.attributes.preferences.hasOwnProperty('avatarImageId')){
            user.avatar = profile.attributes.preferences.avatarImageId;
          }
        })

        // Redirect the user
        .then(function () {
          // Clear temporary data

          req.session.unverified = null;

          // Flash and redirect
          req.flash('info', req.i18n.__("You are now logged in."));

          // If the user requested an authenticated URL beforehand
          if (req.session.requestedUrl) {
            var url = req.session.requestedUrl;
            req.session.requestedUrl = null;

            res.send({
              data: true,
              redirection: true,
              redirectUrl: url
            });
          }
          else {
            res.send(true);
          }
        })

        .catch(function (err) {
          next(err);
        });
    });
  })(req, res, next);
});

// ===== PASSWORD RECOVERY ===== //

// Password recovery interface

// Step 1: Submit phone number. 
router.post('/login/forgot', requireLogout, function (req, res, next) {
  // Validate input

  var invalid = req.validateForm(global.validate.mobileNumber);

  // Is invalid?
  if (invalid) {
    return res.send({
      error: true,
      message: req.i18n.__("Your mobile number is invalid"),
    });
  }

  sdk.auth.identify({
      phone: req.body.phone,
      userAgent: req.headers['user-agent'],
      source: req.getDevice(),
      ip: req.getClientIP()
    })

    // OTP was sent
    .then(function () {
      // Store unverified phone in the session
      req.session.resetUnverified = {
        phone: req.body.phone
      };

      // Next step
      res.send({
        data: true,
        phoneNumber: req.session.resetUnverified.phone
      });
    })

    .catch(function (err) {
      // Phone number doesn't exist
      if (err.is(sdk.auth.errors.BAD_PHONE)) {
        return res.send({
          error: true,
          message: req.i18n.__("Your mobile number doesn't exist.")
        });
      }
      // Phone number doesn't have verification
      else if (err.is(sdk.auth.errors.UNVERIFIED_ACCOUNT)) {
        return res.send({
          error: true,
          message: req.i18n.__("Account not verified")
        });
      }

      else {
        next(err);
      }
    });
});

// Step 2: Verifiy number with code
router.post('/login/forgot/verify', function (req, res, next) {
  sdk.auth.verify({
      phone: req.session.resetUnverified.phone,
      otp: req.body.otp,
      source: req.getDevice(),
      userAgent: req.headers['user-agent'],
      ip: req.getClientIP()
    })

    // OTP verified, get JWT and next step
    .then(function (response) {
      req.session.resetUnverified.jwt = response.attributes.jwt;
      req.session.resetUnverified.id = response.id;
      return res.send(true);
    })

    .catch(function (err) {
      // Phone number doesn't exist
      if (err.is(sdk.auth.errors.BAD_OTP)) {
        return res.send({
          error: true,
          message: req.i18n.__("Incorrect verification code")
        });
      }

      return next(err);
    });
});

// Step 3: Reset password
router.post('/login/forgot/reset', function (req, res, next) {

  // Schema validation
  var invalid = req.validateForm(global.validate.resetPassword);
  if (invalid) {
    return res.send({
      error: true,
      message: req.i18n.__("Password should be at least 6 characters")
    });
  }

  // Confirm password
  if (req.body.password !== req.body.confirm_password) {
    return res.send({
      error: true,
      message: req.i18n.__("Your new password did not match the confirmation. Please try again")
    });
  }

  // Reset the password
  var userData = req.session.resetUnverified;
  sdk.account.update({
      id: userData.id,
      jwt: userData.jwt,
      ip: req.getClientIP(),
      data: {
        reset_password: req.body.password
      }
    })

    // Password is reset. Now login the user
    .then(function () {
      // "Fake" the request object
      var request = req;
      request.body = {
        phone: req.session.resetUnverified.phone,
        password: req.body.password
      };

      // Run the authenticate middleware and fake the request object
      passport.authenticate('local', function (err, user, info) {
        req.logIn(user, function (err) {
          if (err) {
            throw err;
          }

          // Track and log
          req.visitor.event(gaCategory, "Password Reset").send();
          logger.log('debug', "Account password reset and user logged in.", user);

          // Setting avater id and user name
          sdk.account.profile({
            id: user.id,
            jwt: user.jwt
          })

          .then(function (response) {
            req.handlePigeonResponse(response);
            var profile = response.data;

            req.session.xmpp = {
              username: profile.attributes.numeric_id,
              password: utils.aesEncrypt(req.body.password, process.env.AES_SECRET)
            };

            user.name = profile.attributes.name;
            if(profile.attributes.preferences.hasOwnProperty('avatarImageId')){
              user.avatar = profile.attributes.preferences.avatarImageId;
            }
          })

          // Redirect the user
          .then(function () {
            // Clear temporary data
            req.session.resetUnverified = null;
            // Flash and redirect
            req.flash('info', req.i18n.__("Your password has been reset and you are now logged in."));

            res.send(true);
          })

          .catch(function (err) {
            next(err);
          });
        });
      })(request);
    })
    .catch(function (err) {
      next(err);
    });
});

// Do registration
router.post('/register', requireLogout, function (req, res, next) {
  // Validate input
  var invalid = req.validateForm(global.validate.registration);

  // Validate categories
  if (req.body.type == 'b') {
    // If no category specified
    if (!req.body.hasOwnProperty('category')) {
      if (!invalid) invalid = {errors: {}};
      invalid.errors.category = req.i18n.__("Choose a business category");
    }
    else {
      var categoryId = parseInt(req.body.category, 10);

      // If the category is not valid
      if (!_.find(req.businessCategories, ['id', categoryId])) {
        if (!invalid) invalid = {errors: {}};
        invalid.errors.category = req.i18n.__("Not a valid business category");
      }
    }
  }
  if ((req.body.password !== '') && (req.body.password !== req.body.password_confirm)) {
    if (!invalid) invalid = {errors: {}};
    invalid.errors.password = req.i18n.__("Password should be same.");
  }

  // Is invalid?
  if (invalid) {
    return res.send({
      error: true,
      message: invalid.errors
    });
  }

  // Create user account
  sdk.account.create({
      data: {
        name: req.body.name,
        phone: req.body.phone,
        password: req.body.password,
        preferences: {
          type: {
            id: (req.body.type == 'p') ? 'Personal' : 'Business',
            categories: [(req.body.type == 'p') ? null : req.body.category]
          }
        },
        parameters: {
          source: req.getDevice(),
          userAgent: req.headers['user-agent']
        }
      },
      ip: req.getClientIP()
    })

    // Account created
    .then(function (response) {
      req.handlePigeonResponse(response);
      var account = response.data;

      // Debug message
      logger.log('debug', "Account created.", {
        phone: req.body.phone,
        id: account.id,
        jwt: account.attributes.jwt
      });

      // Store unverified account ID in the session
      req.session.unverified = {
        id: account.id,
        name: req.body.name,
        jwt: account.attributes.jwt,
        phone: req.body.phone,
        password: utils.aesEncrypt(req.body.password, process.env.AES_SECRET)
      };

      // Track event
      req.visitor.event('Login and Signup', 'Signup Submission').send();
      
      res.send({
        data: true,
        phoneNumber: req.session.unverified.phone
      });
    })

    // Problem creating account
    .catch(function (err) {
      // If this account already exists
      if (err.is(sdk.account.errors.ACCOUNT_EXISTS)) {

        res.send({
          error: true,
          message: req.i18n.__('This mobile number is already registered on Ekhanei.')
        });
      } else {
        next(err);
      }
    });
});

router.use('/register/verify', requireLogout, function (req, res, next) {
  // If this user does not need verifying, or if there is
  // no session
  if (!req.session.unverified) {
    // Send them back to the registration interface
    return res.redirect('/register');
  }

  next();
});

// Re-send phone number verification OTP
router.get('/register/verify/resend', requireLogout, function (req, res, next) {
  sdk.account.resend({
      phone: req.session.unverified.phone,
      id: req.session.unverified.id,
      jwt: req.session.unverified.jwt,
      source: req.getDevice(),
      userAgent: req.headers['user-agent'],
      ip: req.getClientIP()
    })

    // OTP verified, get JWT and next step
    .then(function (response) {
      req.handlePigeonResponse(response);
      return res.send({
        message: req.i18n.__("Verification code sent")
      });
    })

    .catch(function (err) {
      // account doesn't exist
      if (err.is(sdk.auth.errors.BAD_OTP)) {
        return res.send({
          message: req.i18n.__("Incorrect verification code")
        });
      } else {
        next(err);
      }
    });
});

// Do registration verification
router.post('/register/verify', requireLogout, function (req, res, next) {
  var userData = req.session.unverified;

  // Submit the OTP
  sdk.account.update({
      id: userData.id,
      data: {
        status: 'verified',
        otp: req.body.otp,
        parameters: {
          userAgent: req.headers['user-agent'],
          source: req.getDevice()
        }
      },
      ip: req.getClientIP(),
      jwt: userData.jwt
    })

    // If successfully verified then authenticate the user
    .then(function (response) {
      req.handlePigeonResponse(response);

      // "Fake" the request object
      var request = req;
      request.body = {
        phone: userData.phone,
        password: utils.aesDecrypt(userData.password, process.env.AES_SECRET)
      };

      // Run the authenticate middleware and fake the request object
      passport.authenticate('local', function (err, user, info) {
        req.logIn(user, function (err) {
          if (err) {
            return next(err);
          }

          // If login was successful clear temporary data
          user.name = req.session.unverified.name;
          req.session.unverified = null;

          // Track and log
          req.visitor.event(gaCategory, "Signup Success").send();
          logger.log('debug', "Account verified and user logged in.", user);

          // Flash and redirect
          req.flash('info', req.i18n.__("You are now signed up and logged in"));
          res.send(true);
        });
      })(request);
    })

    // Error updating account
    .catch(function (err) {
      if (err.is(sdk.account.errors.WRONG_OTP)) {
        return res.send({
          error: true,
          message: req.i18n.__("Incorrect verification code")
        });
      } else {
        next(err);
      }
    });
});

module.exports = router;