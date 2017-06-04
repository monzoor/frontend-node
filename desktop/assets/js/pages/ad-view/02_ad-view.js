(function($) {
    
  $(".img-slider").ekhaneiSlider({
    displayWidth: 650,
    infinite: true,
    nextButtonClass: "slider__nav--next",
    prevButtonClass: "slider__nav--prev",
    onChange: function() {
      ga('send', 'event', 'Ad View', 'Change Gallery Photo', window.location.pathname);
    }
  });

  // Show the phone number
  $('#showPhoneBtn').on('click', function(e) {
    e.preventDefault();
    $('#phoneNumberShow').removeClass('hide');

    // Track event
    ga('send', 'event', 'Ad View', 'Show Phone Number', window.location.pathname);
  });

  // Facebook share
  $('[data-action=fb-share-page]').on('click', function(e) {
    ga('send', 'event', 'Ad View', 'Facebook Share Clicked', window.location.pathname);
    
    facebookShare(window.location.href, function(shared) {
      if (shared) {
        ga('send', 'event', 'Ad View', 'Facebook Share Success', window.location.pathname);
      } else {
        ga('send', 'event', 'Ad View', 'Facebook Share Cancelled', window.location.pathname);
      }
    });
  });

  // Similar ads link
  $('#similarAdsLink').on('click', function(e) {
    e.preventDefault();
    var href = $(this).attr('href');

    ga('send', {
      hitType: 'event',
      eventCategory: 'Ad View',
      eventAction: 'Similar Ads',
      eventLabel: window.location.pathname,
      hitCallback: function() {
        window.location.href = href;
      }
    });
  });

})(window.jQuery);