/**
 * Global scripts for the Ekhanei desktop site
 * @author Richard Francis
 *
 * This file is sacred! Don't put scripts here unless they
 * 100% must be here and are required globally.
 */
(function($) {

  window.authenticate = function(options) {
    if (!options) options = {};
    options = $.extend({
      success: null,
      flow: null,
      verifyRegistration: false,
      overlayDom: '#authOverlay'
    }, options);

    var trackEvent = function(eventAction) {
      ga('send', {
        hitType: 'event',
        eventCategory: 'Login and Signup',
        eventAction: eventAction,
        eventLabel: "Page: "+window.location.pathname
      });
    };

    var authOverlay = $(options.overlayDom).overlay({
      onOpen: function() {
        trackEvent('Open Overlay');
      },
      onClose: function() {
        trackEvent('Close Overlay');
      }
    });
    
    var authPanelConfig = {
      flow: options.flow,
      verifyRegistration: options.verifyRegistration
    };

    if (options.success) {
      authPanelConfig.success = function() {
        // Pass the auth overlay to callback
        options.success(authOverlay);
      };
    }
    
    var authPanel = $('#authPanel').authPanel(authPanelConfig);

    // If an auth overlay exists
    if (authOverlay.length !== 0) {
      // Open the overlay
      authOverlay.open();
    } else {
      throw "Can't find auth overlay on page";
    }
  };

  // Click handler to open auth overlay
  $('[data-action=login-signup]').on('click', function(e) {
    e.preventDefault();
    window.authenticate();
  });

  $('[data-action=verify-registration]').on('click', function(e) {
    e.preventDefault();
    window.authenticate({
      verifyRegistration: true
    });
  });

  $('[data-action=verify-phonenumber]').on('click', function(e) {
    e.preventDefault();
    window.authenticate({
      overlayDom: '#verifyPhone',
    });
  });

  // Init header dropdowns
  $('.header-dropdown').active();

  // resend 
  $('#resendVerification').on('click', function (e){
    e.preventDefault();
    $(this).authPanel ({
      verifyChangephone: true
    });
  });

  // Init static auth panel if present
  if ($('#staticAuth').length > 0) {
    $('#authPanel').authPanel({
      // Redirect to this page if there's no automatic
      // redirect in play
      successRedirect: '/'
    });
  }

  // Cookie setter & getter
  window.setCookie = function(cname, cvalue, exdays) {
    var d = new Date();
    d.setTime(d.getTime() + (exdays*24*60*60*1000));
    var expires = "expires="+ d.toUTCString();
    document.cookie = cname + "=" + cvalue + "; " + expires;
  };

  window.getCookie = function(cname) {
    var name = cname + "=";
    var ca = document.cookie.split(';');
    for(var i = 0; i <ca.length; i++) {
      var c = ca[i];
      while (c.charAt(0)==' ') {
        c = c.substring(1);
      }
      if (c.indexOf(name) === 0) {
        return c.substring(name.length,c.length);
      }
    }
    return "";
  };

})(window.jQuery);