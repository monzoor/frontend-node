var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var logger = require('@ekhanei/logger').getLogger();
var sdk = require('@ekhanei/sdk');
var utils = require('@ekhanei/utils');

passport.use(new LocalStrategy({
    usernameField: 'phone',
    passwordField: 'password',
    passReqToCallback: true
  },
  function (req, phone, password, done) {
    // Do login
    sdk.auth.login({
        phone: phone,
        password: password,
        ip: req.getClientIP()
      })
      .then(function (response) {
        // User payload
        var user = {
          phone: phone,
          id: response.id,
          status: response.attributes.status,
          jwt: response.attributes.jwt,
          xmpp: {}
        };

        /**
         * Store encrypted XMPP credentials in user payload
         * so we can create XMPP sessions
         */

        // Get user's account (for numeric ID)
        return sdk.account.profile({
            id: user.id,
            jwt: user.jwt,
            ip: req.getClientIP()
          })
          // Encrypt user's password and store in session with
          // numerical user ID
          .then(function (response) {
            req.handlePigeonResponse(response);
            var profile = response.data;

            user.xmpp.username = profile.attributes.numeric_id;
            user.xmpp.password = utils.aesEncrypt(password, process.env.AES_SECRET);

            done(null, user);
          });
      })

      .catch(function (err) {
        // If an unknown error occurred
        if (err.code !== sdk.auth.errors.BAD_LOGIN) {
          logger.log('error', "Received a bad response from login API " + err);
        }

        done(null, false, {message: "Invalid"});
      });
  }
));

passport.serializeUser(function (user, done) {
  done(null, user);
});

passport.deserializeUser(function (user, done) {
  done(null, user);
});