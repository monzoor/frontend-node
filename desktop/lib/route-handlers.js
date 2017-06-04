"use strict";
module.exports = function mountHandlers(app) {
  app.use("/", require("../routes/ads"));
  app.use("/post-ad", require("../routes/ad-insertion"));
  app.use("/ad-edit", require("../routes/ad-edit"));
  app.use('/', require('../routes/ad-delete-report'));
  app.use('/', require('../routes/ad-view'));
  app.use('/', require('../routes/auth'));
  app.use('/auth/a', require('../routes/auth.async'));
  app.use('/', require('../routes/misc'));
  app.use("/account", require("../routes/account"));
  app.use('/profile', require('../routes/profile'));
  app.use('/messages/a', require('../routes/messages.async'));
  app.use('/messages', require('../routes/messages'));
  app.use('/download', require('../routes/download'));
  app.use('/', require('../routes/dashboard'));
};
