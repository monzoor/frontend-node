"use strict";
var _ = require('lodash');
var moment = require('moment');
var Promise = require('promise');
var logger = require('@ekhanei/logger').getLogger();
var sdk = require('@ekhanei/sdk');
var utils = require('@ekhanei/utils');
var credentials = require('@ekhanei/jwt-api-credentials');
var chatTools = require("../../../lib/helpers/chat");
var BaseController = require("../base-controller");


/**
 *    Get all conversations for the current xmpp user
 * @param request
 * @return {*}
 */
function getUserRoomList(request) {
  return new Promise(function (resolve, reject) {
    sdk.messages.getConversations({
        userId: request.user.xmpp.username,
        ip: request.getClientIP(),
        jwt: request.user.jwt
      })
      .then(function (conversations) {
        getActiveAds(request, conversations)
          .then(function (activeAds) {
            var activeRooms = _.filter(conversations, function (item) {
              var adId = chatTools.getAdID(item.room.id);
              for(var i=0;i< activeAds.length ; i++ ){
                if(activeAds[i] == adId){
                  return true;
                }
              }
              return false;
            });
            resolve({
              error: null,
              conversations: activeRooms
            });
          });

      })
      .catch(function (error) {
        //Error on parrot can only be if something is wrong with database or parrot being down, sdk handles 404 messages
        logger.error("Could not get user %s room list, error: %s", request.user.xmpp.username, JSON.stringify(error));
        resolve({error: error});
      })
  });
}

/**
 *    Builds the profile fetch promises array
 * @param request
 * @param conversations
 * @return {Array}
 */
function getProfilePromises(request, conversations) {
  // Generate app JWT so we can pull profile info
  var jwt = credentials.generateJwt({
    service: 'pigeon',
    secret: process.env.PIGEON_API_SECRET,
    apikey: process.env.PIGEON_API_KEY
  });
  /**
   * Get unique user IDs from the JIDs returned in
   * conversations. Use these IDs to get user names for
   * last messages sent.
   */
  var userIDs = _.map(conversations, function (item) {
    return chatTools.getUserID(item.message.attributes.from.jid);
  });
  //We will also add the current user into the profile requests
  //as we need ALL the profiles to be loaded not only the ones in "from"
  //this is because of the filtering logic to avoid errors
  userIDs.push(request.user.xmpp.username);
  userIDs = _.uniq(userIDs);
  // Get all unique profiles simultaneously
  return _.map(userIDs, function (userId) {
    return sdk.account.profile({
      id: userId,
      jwt: jwt,
      ip: request.getClientIP()
    });
  });
}

/**
 *  get the profiles
 * @param profilePromises
 * @return {*}
 */
function getProfiles(profilePromises) {
  var accumulator = [];
  var ready = Promise.resolve(null);
  //XXX: Dear future developer, bursting out all this promises without throttling could be a problem in case a user has LOTs of chat rooms
  //TODO: implement promises throttle to avoid bursting too many request in parallel to PIGEON.
  profilePromises.forEach(function (promise) {
    ready = ready.then(function () {
      return new Promise(function (resolve) {
        promise.then(function (value) {
          resolve({
            status: "fulfilled",
            value: value
          });
        }).catch(function (error) {
          logger.error("Profile request failed, error: %s", JSON.stringify(error));
          resolve({
            status: "rejected",
            error: error
          });
        })
      });
    }).then(function (value) {
      accumulator.push(value);
    });
  });
  //Now we return the getProfile successful responses
  return ready.then(function () {
    var successfulPromises = [];
    accumulator.forEach(function (item) {
      if (item.status == "fulfilled") {
        successfulPromises.push(item.value);
      }
    });
    return successfulPromises;
  });
}

/**
 * get the active ads
 * @param req
 * @param conversations
 * @return {*}
 */
function getActiveAds(req, conversations) {
  var adIds = _.uniq(_.map(conversations, function (item) {
    return ( chatTools.getAdID(item.room.id) );
  }));
  // Get all unique profiles simultaneously
  var resolve = _.map(adIds, function (adId) {
    return sdk.ask.getAd({
        id: adId,
        ip: req.getClientIP()
      })
      .then(function (ad) {
        return ad.data.id;
      })
      .catch(function () {
        return false;
      });
  });

  // When we have all profile data
  return Promise.all(resolve).then(function (ads) {
    var activeAds = _.filter(ads, function (ad) {
      if (!ad) {
        return false;
      }
      return true;
    });
    return (activeAds);
  });
}

/**
 *  Gets the user avatar url
 * @param profiles
 * @param userJID
 * @return {*}
 */
function getAvatar(profiles, userJID) {
  var userID = chatTools.getUserID(userJID),
      avatarID = profiles[userID]["data"]["attributes"]["preferences"]["avatarImageId"]
  if (avatarID) {
    return '/image/avatar/' + avatarID + '/thumb';
  }
  return "/image/avatar/default/thumb";
}

/**
 *  Get's the chat room link so seller and possible buyer can chat
 * @param loggedUser
 * @param roomJID
 * @return {string}
 */
function getChatRoomLink(loggedUser, roomJID) {
  // Build the link
  // If buyer ID is not current user then needs to be
  // added as uri segment
  var link = '/messages/' + chatTools.getAdID(roomJID);
  var buyerID = chatTools.getBuyerID(roomJID);
  if (buyerID != loggedUser.xmpp.username) {
    link += '/' + buyerID;
  }
  return link;
}

/**
 *    Gets the username based on the JID comming from the chat
 * @param request
 * @param profiles
 * @param userJID
 * @return {*}
 */
function getUserName(request, profiles, userJID) {
  var userID = chatTools.getUserID(userJID);
  if (request.user.xmpp.username == userID) {
    return request.i18n.__("You");
  }
  if (profiles.hasOwnProperty(userID)) {
    return _.words(profiles[userID]["data"]["attributes"]["name"])[0];
  }
  return request.i18n.__("User");
}

/**
 *    This function builds the data needed for the conversation list page
 * @param request
 * @param conversations
 * @param profiles
 * @return {Array}
 */
function getConversationListForView(request, conversations, profiles) {

  if (profiles.length == 0) {
    //Something went wrong with the request so we just return an empty conversation stuff
    return [];
  }
  var profileLookup = {};
  profiles.forEach(function (profile) {
    var profileChatID = profile["data"]["attributes"]["numeric_id"] + "";
    profileLookup[profileChatID] = profile;
  });
  //Due to possible profiles not existing or errors getting the profile we have to clean the conversations that involve non existing profiles
  var existingConversations = _.filter(conversations, function (conversation) {
    return profileLookup.hasOwnProperty(chatTools.getUserID(conversation["message"]["attributes"]["from"]["jid"]));
  });
  //Now that we have filtered out the bad stuff we do the mapping
  return _.map(existingConversations, function (conversation) {
    var roomJID = conversation["room"]["id"];
    return {
      ad: {
        id: chatTools.getAdID(roomJID),
        title: conversation["room"]["attributes"]["description"]
      },
      lastMessage: {
        time: moment(conversation["message"]["attributes"]["sentdate"]).fromNow(),
        sender: getUserName(request, profileLookup, conversation["message"]["attributes"]["from"]["jid"]),
        message: conversation["message"]["attributes"]["message"],
        avatar: getAvatar(profileLookup, conversation["message"]["attributes"]["from"]["jid"])
      },
      link: getChatRoomLink(request.user, roomJID)
    }
  });
}

function getRoomList(request) {
  return getUserRoomList(request)
    .then(function (roomListResponse) {
      if (roomListResponse.error !== null) {
        //This is here for the UNIQUE case of parrot api sending 500 due to some bad error, instead of showing 500, show a friendlier message to the user
        logger.error("Couldn't get messages from parrot, reason: "+JSON.stringify(roomListResponse.error));
        return [];
      }
      var conversations = roomListResponse["conversations"];

      // Get all unique profiles simultaneously
      return getProfiles(getProfilePromises(request, conversations))
        .then(function (profileResponses) {
          var conversationList = getConversationListForView(request, conversations, profileResponses);
          logger.info("Loaded %s chat rooms for user %s", conversationList.length, request.user.id);
          return conversationList;
        });
    });
}

function getSnippets(request) {
  return sdk.messages.getSnippets({
    ip: request.getClientIP()
  })
  .then(function(snippets) {
    return {
      all: _.filter(snippets, { 'type': 'text', 'status': 1 }),
      default: _.find(snippets, { 'type': 'default' })
    };
  })
  
  // If error gracefully degrade (don't show snippets)
  .catch(function(err) {
    logger.error("Could not get chat snippets from SDK. User shown interface without snippets.", {
      error: err.message,
      stack: err.stack
    });
    return null;
  });
}

/**
 *    Handles the logic to fetch all the data to show the users chat list
 *    Handles the logic to fetch all the data to show the users chat list
 * @param request
 * @param response
 * @param next
 */
function showRoomListAction(request, response, next) {
  Promise.all([getRoomList(request), getSnippets(request)])
  .then(function(responses) {
    var conversationList = responses[0],
        snippets = responses[1];
    
    logger.info("Loaded %s chat rooms for user %s", conversationList.length, request.user.id);
    
    // Provide snippets to view
    response.locals.ekhanei.chatSnippets = snippets.all;
    response.locals.ekhanei.defaultMessage = snippets.default;

    var title = request.i18n.__("Messages");
    var viewData = {
      title: title,
      header: {
        title: title
      },
      scripts: ['/js/messages.js']
    };
    if (conversationList.length > 0) {
      viewData["conversations"] = conversationList;
    }
    response.render('messages/index', viewData);
  })
  .catch(function (err) {
    next(err);
  });
}

/**
 *  Bind the actions that this controller will handle
 * @param controller
 */
function bindRoutes(controller) {
  var router = controller.getRouter();
  router.get("/", showRoomListAction);
  router.get("/:adId/:buyerId?", showRoomListAction);
}

/**
 * @param router
 * @return {{}}
 * @constructor
 */
function RoomListController(router) {
  var controller = {};
  controller.__proto__ = BaseController(router);
  controller.bindActions = function () {
    return bindRoutes(this);
  };

  // Expose for latest message middleware
  controller.getRoomList = getRoomList;

  return controller;
}


module.exports = RoomListController;
