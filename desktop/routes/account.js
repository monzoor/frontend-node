var express = require('express');
var router = express.Router();
var passport = require('passport');
var logger = require('@ekhanei/logger').getLogger();
var sdk = require('@ekhanei/sdk');
var utils = require('@ekhanei/utils');

var requireLogin = require('../middleware/require-login');

// All account routes require login
router.use('/', requireLogin);

/**
 * Change phone number
 */
router.post('/phone', function(req, res, next) {

  // Validate input
  var invalid = req.validateForm(global.validate.updatePhone);

  // Is invalid?
  if (invalid) {
    req.flash('errors', invalid.errors);
    req.flash('form', req.body);
    return res.redirect('/profile/me#changephone');
  }

  var oldPhone = req.body.old_phone,
      newPhone = req.body.new_phone;

  // Verify current (old) phone number
  if (oldPhone != req.user.phone) {
    req.flash('errors', {
      old_phone: req.i18n.__("This is not your current number")
    });
    req.flash('form', req.body);
    return res.redirect('/profile/me');
  }

  // Make sure the two numbers are not the same
  if (oldPhone === newPhone) {
    req.flash('errors', {
      new_phone: req.i18n.__("Cannot be the same number")
    });
    req.flash('form', req.body);
    return res.redirect('/profile/me');
  }

  // Send to API
  sdk.account.update({
    id: req.user.id,
    jwt: req.user.jwt,
    ip: req.getClientIP(),
    data: {
      phone: newPhone
    }
  })
  .then(function(response) {
    req.handlePigeonResponse(response);

    logger.debug('User changed phone number. Needs verification.', {
      userID: req.user.id,
      oldPhone: oldPhone,
      newPhone: newPhone
    });

    // Store unverified data in session in the same format
    // as an unverified registration. This can be used
    // again even if the user doesn't verify their account
    // right now.
    req.session.unverified = {
      id: req.user.id,
      name: req.user.name,
      jwt: req.user.jwt,
      phone: newPhone
    };

    return res.redirect('/profile/me#verifyphone');
  })
  .catch(function(err) {
    // If the new phone number already exists
    if (err.is(sdk.account.errors.ACCOUNT_EXISTS)) {
      req.flash('errors', {
        new_phone: req.i18n.__("Number is already in use")
      });
      req.flash('form', req.body);
      return res.redirect('/profile/me');
    }

    req.flash('errors', {
      new_phone: req.i18n.__("Can't update phone number")
    });
    req.flash('form', req.body);

    return res.redirect('/profile/me');
  });
});

/**
 * For verification routes we should make sure the user is
 * unverified.
 */
router.use('/phone/verify', function(req, res, next) {
  if (!req.session.unverified) {
    req.flash('errors', {
      new_phone: req.i18n.__("Can't update phone number, session expired")
    });
    // Send them back to the new phone number interface
    return res.redirect('/profile/me');
  }
  next();
});

/**
 * Do phone number verification
 */
router.post('/phone/verify', function(req, res, next) {
  var unverified = req.session.unverified;

  // Submit the OTP
  sdk.account.update({
    id: req.user.id,
    data: {
      status: 'verified',
      otp: req.body.otp,
      userAgent: req.headers['user-agent'],
      source: 'smartphone'
    },
    ip: req.getClientIP(),
    jwt: req.user.jwt
  })

  // If successfully updated
  .then(function(response) {
    req.handlePigeonResponse(response);

    // Update the user payload
    req.user.phone = unverified.phone;
    req.session.unverified = null;

    req.flash('info', req.i18n.__("Your mobile number has been updated"));
    res.redirect('/profile/me');
  })

  // Error updating account
  .catch(function(err) {
    if (err.is(sdk.account.errors.WRONG_OTP)) {
      req.flash('errors', {
        otp: req.i18n.__("Incorrect verification code")
      });
      return res.redirect('/profile/me#verifyphone');
    }

    next(err);
  });
});

// Re-send phone number verification OTP
router.get('/phone/verify/resend', function (req, res, next) {
  sdk.account.update({
      id: req.session.unverified.id,
      jwt: req.session.unverified.jwt,
      ip: req.getClientIP(),
      data: {
        phone: req.session.unverified.phone
      }
    })

    // OTP verified, get JWT and next step
    .then(function (response) {
      req.handlePigeonResponse(response);
      return res.send({
        message: req.i18n.__("Verification code sent")
      });
    })

    .catch(function (err) {
      req.flash('error', req.i18n.__("Something wrong with verification code"));
      return res.redirect('/profile/me');
    });
});



/**
 * Change password
 * */
router.post('/password', function(req, res, next) {

  // Schema validation
  var invalid = req.validateForm(global.validate.changePassword);
  if (invalid) {
    req.flash('errors', invalid.errors);
    return res.redirect('/profile/me#changepassword');
  }

  // Confirm password
  if (req.body.new_password !== req.body.confirm_password) {
    req.flash('error', req.i18n.__("Your new password did not match the confirmation. Please try again."));
    return res.redirect('/profile/me');
  }

  sdk.account.update({
    id: req.user.id,
    jwt: req.user.jwt,
    ip: req.getClientIP(),
    data: {
      old_password: req.body.old_password,
      password: req.body.new_password,
      phone: req.user.phone
    }
  })
  .then(function(response) {
    req.user.xmpp.password = utils.aesEncrypt(req.body.new_password, process.env.AES_SECRET);

    req.handlePigeonResponse(response);
    req.flash('info', req.i18n.__("Your password was successfully changed"));
    res.redirect('/profile/me');
  })
  .catch(function(err) {
    // If the old password was incorrect
    if (err.is(sdk.account.errors.WRONG_PASSWORD)) {
      req.flash('error', req.i18n.__("Your current password was incorrect, please try again."));
      return res.redirect('/profile/me');
    }

    next(err);
  });
});

// Confirm delete account
router.post('/delete', function(req, res, next) {
  // No password supplied
  if (!req.body.password) {
    req.flash('errors', { password: req.i18n.__("You must enter your password") });
    return res.redirect('/profile/me');
  }

  // Check password
  var password = utils.aesDecrypt(req.user.xmpp.password, process.env.AES_SECRET);
  if (password !== req.body.password) {
    req.flash('errors', { password: req.i18n.__("Incorrect password") });
    return res.redirect('/profile/me');
  }

  // Password matches. Now delete the user's account.
  sdk.account.delete({
    id: req.user.id,
    jwt: req.user.jwt,
    ip: req.getClientIP()
  })

  // Account was deleted. Logout and redirect.
  .then(function(response) {
    req.handlePigeonResponse(response);

    // Logout with Passport
    req.logout();

    // Clear all custom session data
    req.session.regenerate(function(err) {
      if (err) { throw err; }

      req.flash('info', req.i18n.__("We're sorry to see you go! Your account has been deleted and you are now logged out."));
      res.redirect('/');
    });
  })
  .catch(function(err) {
    next(err);
  });
});

module.exports = router;
