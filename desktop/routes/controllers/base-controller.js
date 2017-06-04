"use strict";
/**
 * @param router
 * @return {{getRouter: getRouter, bindActions: bindActions}}
 * @constructor
 */
function BaseController(router) {
  var routesController = router;
  return {
    getRouter: function () {
      return routesController;
    },
    bindActions: function () {
      throw new Error("Controller must implement this method");
    }
  }
}

module.exports = BaseController;
