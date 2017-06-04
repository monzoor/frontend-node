var sdk = require('@ekhanei/sdk');
var logger = require('@ekhanei/logger').getLogger();
var moment = require('moment');
var _ = require('lodash');

/**
 * Add html strong tag on "" separated message
 * @param {json}
 * @returns {string}
 */
function makeBold (data){
  var str = data.attributes.message;
  if(data.attributes.notificationType.search('ad')>=0){
    if(str.match(/"/gi) && (str.match(/"/gi).length) === 2) { // Detect two " available or not
      str = str.split('"');
      return str[0]+"<strong>"+str[1]+"</strong>"+str[2];
    }
    else return str;
  }
  else return  str;
}

module.exports = function (req, res, next){
	// If user is not authed we don't need to show notification
  if (!req.user) {
    return next();
  }

  // If notification id is available in UTL
  if(req.query.nid) {
    sdk.notifications.markAsRead ({
      userId: req.user.id, // ID of the user
      nId: req.query.nid, // Notification Id
      jwt: req.user.jwt // User's JWT
    })
    .then(function (response){
      logger.info('Notification marked as read for',{
        userId: req.user.id
      });
    })
    .catch(function (err){
      logger.error("Error in notification when trying to mark as read", {
        userId: req.user.id,
        error: err
      });
    });
  }

  // Get all notifications
  sdk.notifications.get({
    userId: req.user.id, // ID of the user
    jwt: req.user.jwt // User's JWT
  })
  .then(function (response){
    var notificationsData = response.data,
        unread = 0,
        dateFormat = {
          sameDay: req.i18n.__("[Today at]")+' h:mm A', // Today at 2:26 PM
          lastDay: req.i18n.__("[Yesterday at]")+' h:mm A', // Yesterday at 2:26 PM
          sameElse:'MMMM DD '+ req.i18n.__("[at]") +' h:mm A' // December 02 at 2:26 PM
        };

    res.locals.notifications = _.map(notificationsData, function(notification) {
      unread = parseInt(notification.mark) + unread;
      return {
        nid: notification.nid,
        message: makeBold(notification),
        url: notification.attributes.url+'?nid='+notification.nid,
        date: moment(notification.creation_time).calendar(null, dateFormat),
        thumb: notification.attributes.thumb || null,
        unRead: (parseInt(notification.mark) === 1) ? true : false
      };
    });

    //mark as read if nid in query string
    if(req.query.nid) {
      var ntIndex = _.findIndex(res.locals.notifications, {nid: req.query.nid, unRead: true});
      if(ntIndex !== -1 && unread !== 0){
        if(res.locals.notifications[ntIndex]){
          res.locals.notifications[ntIndex].unRead = false;
          unread--;
        }
      }
    }

    res.locals.unreadNotifications = unread;
    next();
  })
  .catch(function (err){
    logger.error("Error fetching notifications from runner", {
      userId: req.user.id,
      error: err
    });
    next();
  });
};
