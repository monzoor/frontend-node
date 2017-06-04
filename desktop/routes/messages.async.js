var express = require('express');
var router = express.Router();
var credentials = require('@ekhanei/jwt-api-credentials');
var logger = require('@ekhanei/logger').getLogger();
var sdk = require('@ekhanei/sdk');
var utils = require('@ekhanei/utils');
var _ = require('lodash');
var imageHelper = require('../lib/helpers/image-helper');

function getConversationMeta (req,imageUrl) {
  var _ad = null,
    _seller = null,
    _buyerId = null;

  if (!req.query.adId) {
    var err = new Error("Can't get conversation: missing adId in querystring");
    err.status = 400;
    throw err;
  }

  // App level JWT
  var jwt = credentials.generateJwt({
    service: 'pigeon',
    secret: process.env.PIGEON_API_SECRET,
    apikey: process.env.PIGEON_API_KEY
  });

  // Get the ad
  return sdk.ask.getAd({
    id: req.query.adId,
    ip: req.getClientIP()
  })

  // Now get the numeric ID of the seller
  .then(function (ad) {
    _ad = ad.data;

    return sdk.account.profile({
      id: _ad.attributes.account.account_id,
      jwt: jwt,
      ip: req.getClientIP()
    })
    .then(function (response) {
      req.handlePigeonResponse(response);

      _seller = response.data;
      return response.data.attributes.numeric_id;
    });
  })

  // Work out who is the buyer and who is the seller
  .then(function (sellerId) {

    // If the current user is the seller then the buyerId
    // is expected as a URL param
    if (sellerId === req.user.xmpp.username) {
      // If not provided then the user is trying to message
      // themselves
      if (!req.query.buyerId) {
        var err = new Error("Can't get conversation: user can't message self");
        err.status = 400;
        throw err;
      }

      // Now find out who the buyer is
      return sdk.account.profile({
        id: req.query.buyerId,
        jwt: jwt,
        ip: req.getClientIP()
      })
      .then(function (response) {
        req.handlePigeonResponse(response);
        return response.data;
      });
    }
  })

  // Attach variables to the request
  .then(function (buyerProfile) {
    _buyerId = (buyerProfile) ? buyerProfile.attributes.numeric_id : req.user.xmpp.username;

    // If there's a buyer profile then current user is the seller
    var them = (buyerProfile) ? buyerProfile : _seller;

    var avatarIDme = 'default',
        avatarIDyou = 'default';
    if(req.user.avatar) {
      avatarIDme = req.user.avatar;
    }
    if (them.attributes.preferences.avatarImageId) {
      avatarIDyou = them.attributes.preferences.avatarImageId
    }
    // Conversation participants
    return {
      me: {
        name: req.i18n.__('You'),
        avatar: imageUrl+'/image/avatar/' + avatarIDme + '/thumb'
      },
      them: {
        name: _.words(them.attributes.name)[0], // First name
        avatar: imageUrl+'/image/avatar/' + avatarIDyou + '/thumb'
      }
    };
  })

  // Send the response
  .then(function(participants) {
    return {
      participants: participants,
      seller: _seller,
      buyerId: _buyerId,
      ad: _ad
    };
  });
}

function getXmppData (params) {
  params = _.merge({
    adId: null,
    adTitle: null,
    sellerId: null,
    buyerId: null,
    xmppUsername: null,
    xmppPassword: null,
    device: null,
    ip: null,
    jwt: null
  }, params);

  var resolve = [];

  resolve.push(
    sdk.messages.getRoom({
        adID: params.adId,
        sellerID: params.sellerId,
        buyerID: params.buyerId,
        ip: params.ip,
        jwt: params.jwt
      })
      .then(function (room) {

        // If the room doesn't exist then create it and return
        // the new ID
        if (!room) {
          return sdk.messages.createRoom({
              adID: params.adId,
              sellerID: params.sellerId,
              buyerID: params.buyerId,
              name: params.adTitle,
              description: params.adTitle,
              subject: params.adTitle,
              ip: params.ip,
              jwt: params.jwt
            })
            .then(function (room) {
              return room.id;
            });
        }

        // If the room exists then return its ID
        return room.id;
      })
  );

  resolve.push(
    sdk.messages.newSession({
      username: params.xmppUsername,
      password: params.xmppPassword,
      device: params.device,
      ip: params.ip,
      jwt: params.jwt
    })
  );

  // Fire both promises
  return Promise.all(resolve).then(function (values) {
    var roomID = values[0],
      session = values[1];

    return {
      httpBind: sdk.config.get('xmppHttpBind'),
      roomId: roomID,
      userId: session.id,
      sid: session.attributes.sid,
      rid: session.attributes.rid,
      device: params.device
    };
  });
}

// Require login for all endpoints
router.use(require('../middleware/require-login'), function(req, res, next) {
  res.header("Content-Type", "application/json");
  next();
});

router.get('/conversation', function(req, res, next) {
  // Get ad & participant data
  getConversationMeta(req, imageHelper.getBaseUrl()).then(function(meta) {
    var userRole = (meta.seller.id === req.user.id) ? 'seller' : 'buyer';

    return getXmppData({
      adId: meta.ad.id,
      adTitle: meta.ad.attributes.title,
      sellerId: meta.seller.attributes.numeric_id,
      buyerId: meta.buyerId,
      xmppUsername: req.user.xmpp.username,
      xmppPassword: utils.aesDecrypt(req.user.xmpp.password, process.env.AES_SECRET),
      device: req.getDevice(),
      ip: req.getClientIP(),
      jwt: req.user.jwt
    })
    .then(function(xmpp) {
      // Send response
      res.json({
        ad: {
          id: meta.ad.id,
          link: '/ad/'+meta.ad.id,
          title: meta.ad.attributes.title,
          price: meta.ad.attributes.price
        },
        participants: meta.participants,
        xmpp: xmpp,
        userRole: userRole
      });
    });
  })

  .catch(function (err) {
    logger.error("Error while retrieving conversation, reason: %s\n%s", err.message);
    if (err.stack) {
      logger.error(err.stack);
    }

    res.sendStatus(err.status || 500);
  });
});

module.exports = router;