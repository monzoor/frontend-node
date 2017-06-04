var express = require('express');
var router = express.Router();
var sdk = require('@ekhanei/sdk');
var Promise = require('promise');
var _ = require('lodash');
var moment = require('moment');
var utils = require('@ekhanei/utils');
var logger = require('@ekhanei/logger').getLogger();
var credentials = require('@ekhanei/jwt-api-credentials');
var chatTools = require("../lib/helpers/chat");

//All message routes require login
router.use(require('../middleware/require-login'));

var RoomListController = require("./controllers/chat/room-list-controller");
var roomListController = new RoomListController(router);
roomListController.bindActions();

module.exports = router;
