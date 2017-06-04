
/* Middleware to protect authenticated routes */
module.exports = function(req, res, next) {
  // If there is no user object provided by passport
  // (via the session)
  if (!req.user) {

    // Remember the requested url so we can send the user
    // there after login
    req.session.requestedUrl = req.originalUrl;

    // Show a flash message
    req.flash('error', req.i18n.__("You must login to view this page"));

    // Redirect to login
    return res.redirect('/login-signup');
  }

  next();
};
