var express = require('express');
var router = express.Router();
var downloadsCtrl = require('./controllers/downloads');

/**
 * APK DOWNLOAD
 */
router.get('/apk/:version?', downloadsCtrl.apk.routeHandler);

module.exports = router;
