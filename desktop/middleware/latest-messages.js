"use strict";
var sdk = require('@ekhanei/sdk');
var logger = require('@ekhanei/logger').getLogger();

var RoomListController = require("../routes/controllers/chat/room-list-controller");

var sessionKey = 'latest_messages';

/**
 * Determines whether the given url is a page (rather than
 * a static asset or async endpoint).
 */
function _isPage(url) {
  return ! new RegExp([
    '/messages/a',
    '/image',
    '/js',
    '/css',
    '/img',
    '/font'
  ].join("|")).test(url);
}

function _isMessagePage(url) {
  return new RegExp('/messages').test(url);
}

module.exports = function (req, res, next) {
  // If user is not authed we don't need to show messages
  if (!req.user) {
    return next();
  }

  // As this middleware gets called on ALL requests, we
  // need to work out whether the url requested is a page.
  // If not then we shouldn't go any further as we don't
  // want to refresh messages on image requests etc.
  if (!_isPage(req.originalUrl)) {
    return next();
  }

  // The user is authed but latest messages are already in
  // session (redis)
  if (req.session.hasOwnProperty(sessionKey)) {
    logger.info('Latest messages found in session; provided to view');
    res.locals.latestMessages = req.session[sessionKey];

    // If this is a message page then we can remove
    // messages from the session, therefore triggering a
    // refresh on next page load.
    if (_isMessagePage(req.originalUrl)) {
      logger.info("Latest messages flushed from session, will reload on next request");
      delete req.session[sessionKey];
    }

    return next();
  }

  logger.info("Latest messages not found in session; loading 3 most recent");

  // If user is authed and no messages are in session
  var roomListController = new RoomListController(null);
  
  // Get the room list
  roomListController.getRoomList(req)
  .then(function(rooms) {
    // Store the latest 3 messages (rooms) in session
    req.session[sessionKey] = rooms.slice(0,3);

    // Pass to view
    res.locals.latestMessages = req.session[sessionKey];
    
    next();
  })

  // If there's an error just log it and set messages to
  // empty array. There's no need to block the rest of the UI.
  .catch(function(err) {
    res.locals.latestMessages = req.session[sessionKey] = [];
    logger.error("Couldn't retrieve latest messages, reason: "+JSON.stringify(err));
    next();
  });
};
