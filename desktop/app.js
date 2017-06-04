global.__root = __dirname;

//Logger configuration
var eLogger = require('@ekhanei/logger');
if (process.env.NODE_ENV == "development") {
  eLogger.bindConsole("debug");
} else if (process.env.NODE_ENV == "production") {
  eLogger.removeConsole();
}
eLogger.bindSysLog(process.env.LOG_LEVEL || "debug", process.env.DEVICE, "local0");
var logger = eLogger.getLogger();

var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var exphbs = require('express-handlebars');
var redis = require("redis");
var session = require('express-session');
var RedisStore = require('connect-redis')(session);
var passport = require('passport');
var flash = require('connect-flash');
var i18n = require('i18n-2');
var ua = require("universal-analytics");
var validation = require('@ekhanei/form-validation');
var middleware = require('@ekhanei/middleware');
var hbsHelpers = require('./config/hbs-helpers');
var _ = require('lodash');
var redirects = require('./config/redirects');
var facebook = require('./config/facebook');
var analytics = require('./config/analytics');
var imageHelper = require('./lib/helpers/image-helper');
var client = redis.createClient({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT, 10)
});
var app = express();

app.locals.ENV = process.env.NODE_ENV;
app.locals.ENV_DEVELOPMENT = app.locals.ENV == 'development';

// Configure Passport
require('./config/passport');

// Configure moment
require('./config/moment.js');

// Session/Passport Setup
var sessionDuration = 60*24*60*60*10000; // 60 days
app.use(session({
  name: 'ekhanei.sid',
  store: new RedisStore({
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT, 10),
    client: client,
    ttl: sessionDuration
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: sessionDuration
  }
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

// Internationalization
i18n.expressBind(app, {
  locales: ['en-GB', 'bn-BD'],
  directory: 'language',
  cookieName: 'locale'
});

// Validation setup
global.validate = validation.getSchemas();
app.use(validation.middleware());
app.use(function (req, res, next) {
  var protocol = (req.headers.hasOwnProperty('x-forwarded-proto')) ? req.headers['x-forwarded-proto'] : req.protocol;

  //TODO: Set validation locale from cookie
  validation.setLocale('en-GB');
  req.site =  '//' + process.env.DESKTOP_SITE;
  req.redirects = redirects;
  
  // Exposed on window.Ekhanei for client-side JS
  res.locals.ekhanei = {
    loggedIn: (req.user) ? true : false,
    // Facebook config
    facebook: {
      appId: facebook.appId,
      redirectUri: protocol+'://'+req.get('host')+facebook.redirectUri
    },
    // Set redirect url
    smartPhone : '//'+process.env.SMARTPHONE_SITE,
    fullUrl : '//' + req.get('host'),
    adpostSurveyUrl: process.env.AD_POST_SURVEY_URL
  };

  // Image base URL for use in templates
  res.locals.imageBaseUrl = imageHelper.getBaseUrl();
  next();
});

// Bind global Ekhanei middleware to the app
middleware.expressBind(app);

// View engine setup
app.engine('.hbs', exphbs({
  defaultLayout: 'main',
  partialsDir: ['views/partials/'],
  extname: '.hbs',
  helpers: hbsHelpers
}));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', '.hbs');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(cookieParser());

// Serve static assets and dynamic images
app.use(express.static(path.join(__dirname, (app.locals.ENV_DEVELOPMENT ? 'public' : 'dist'))));
app.use('/image', require('./routes/image'));

// Device redirection global middleware, MUST be after
// cookieParse as we use cookie information
app.use(require("./middleware/device-redirect"));

// Provide view with Google Analytics tracking ID
app.use(function(req, res, next) {
  res.locals.gaTrackingId = analytics.gaTrackingId;
  next();
});

// Attach analytics visitor instance to each request
app.use(ua.middleware(analytics.gaTrackingId, {cookieName: '_ga'}));

// Custom middleware
app.use(require("./middleware/notifications"));
app.use(require('./middleware/latest-messages'));
app.use(require("./middleware/unverified-user"));

// Routes
require("./lib/route-handlers")(app);
//Handle errors in a different place to avoid making this file to big
require("./lib/error-handlers")(app);

module.exports = app;
