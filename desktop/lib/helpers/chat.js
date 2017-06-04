"use strict";
var utils = require('@ekhanei/utils');
/**
 *    Gets the room id without full JID
 * @param roomJID
 * @return {String}
 */
exports.getRoomID = function (roomJID) {
  return roomJID.split("@")[0];
};

/**
 *    Gets the user id based on the full user JID
 * @param userJID
 * @return {String}
 */
exports.getUserID = function (userJID) {
  return userJID.split("@")[0] + "";
};

/**
 * @param roomJID
 * @return {String}
 */
exports.getAdID = function (roomJID) {
  return utils.reconstructUUID(exports.getRoomID(roomJID).split("_")[0]);

};

/**
 * @param roomJID
 * @return {String}
 */
exports.getSellerID = function (roomJID) {
  return exports.getRoomID(roomJID).split("_")[1];
};

/**
 * @param roomJID
 * @return {String}
 */
exports.getBuyerID = function (roomJID) {
  return exports.getRoomID(roomJID).split("_")[2];
};
