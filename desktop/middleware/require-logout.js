
/* Middleware for "public only" routes - i.e., login,
 * register, forgot password... */
module.exports = function(req, res, next) {
  // If there is a user object provided by passport
  // (via the session)
  if (req.user) {

    // Show a flash message
    req.flash('info', req.i18n.__("You are already logged in"));

    // Redirect to authed page
    return res.redirect('/');
  }

  next();
};
