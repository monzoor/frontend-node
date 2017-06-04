
module.exports = function (req, res, next) {
  if (req.session.unverified && !res.locals.info) {
    res.locals.showUnverifiedMessage = true;
    res.locals.unverifiedPhone = req.session.unverified.phone;
  }

  next();
};
