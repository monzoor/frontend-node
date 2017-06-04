var express = require('express');
var router = express.Router();
var logger = require('@ekhanei/logger').getLogger();
var passport = require('passport');
var sdk = require('@ekhanei/sdk');
var utils = require('@ekhanei/utils');
var _ = require('lodash');

// Middleware
var requireLogin = require('../middleware/require-login');
var requireLogout = require('../middleware/require-logout');

// Login interface
// There are two ways to login: via an overlay, used when
// we want to keep the context in which the user find
// themselves (the ad insertion form, for example); and
// in-page, useful for when users try to access an
// authenticated route. This route handler the latter.
router.get('/login-signup', requireLogout, function (req, res, next) {
  res.render('auth/login-signup', {
    title: req.i18n.__("Login or create an account"),
    disableAuthOverlay : true,
    showUnverifiedMessage: false
  });
});

// Signup interface
// For cases when we want to drive people explicitly to
// signup, and remove the distraction of login.
router.get('/signup', requireLogout, function(req, res, next) {
  res.render('auth/signup', {
    title: req.i18n.__("Create an account"),
    disableAuthOverlay : true,
    showUnverifiedMessage: false
  });
});

router.get('/logout', requireLogin, function (req, res, next) {
  var userID = req.user.id;
  req.logout();

  req.session.regenerate(function (err) {
    if (err) {
      logger.error("Unexpected error while logging out user %s, error: %s", userID, JSON.stringify(err));
      return next(err);
    }
    logger.info("Successfully logged out user %s", userID);

    // Track this event
    req.visitor.event("Login and Signup", "Logout Success").send();

    // Flash and redirect
    req.flash('info', req.i18n.__("You are now logged out"));
    res.redirect('/');
  });
});

module.exports = router;
