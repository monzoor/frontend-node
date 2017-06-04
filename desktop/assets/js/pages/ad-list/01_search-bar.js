(function($) {

  $.fn.searchBar = function() {

    // Elements
    var $container = this,
        $input = this.find('input').eq(0),
        $tip = this.find('.search__tip');

    var _tipShowing = false,
      _seenTipCookie = 'ekhanei.seensearchtip',
      _cookieDuration = 365; // Days

    /**
     * Init
     *
     * Initialize the component and bind events
     */
    var init = function() {
      $input.on('focus', function() {
        open();
      });

      $container.on('click', '[data-action=clear]', function(e) {
        e.preventDefault();
        clearSearch();
      });
    };

    /**
     * Open
     *
     * Opens the search bar (expands search button)
     */
    var open = function() {
      // Expands the button
      $container.addClass('active');

      // Don't propagate events from search tip
      $tip.on('click', function(e) {
        e.stopPropagation();
      });

      // Show search tip if not seen already
      if (!window.getCookie(_seenTipCookie)) {
        showTip();
      }

      // We delay the following listeners to allow the
      // initial click event to propagate to the document,
      // which will close any other 'open' components
      setTimeout(function() {
        
        // If user clicks outside we should close the search bar
        $(document).on('click', close);

        // Any interaction within the search bar shouldn't
        // close it
        $container.on('click', function(e) {
          e.stopPropagation();
        });
      }, 100);
    };

    /**
     * Close
     *
     * Closes the search bar (collapses search button)
     */
    var close = function() {
      $container.removeClass('active');
      hideTip();

      // Stop listening to the document
      $(document).off('click', close);

      // Stop blocking click events from bubbling
      $container.off('click');
    };

    /**
     * Clear search
     *
     * Clears the search terms but keeps the category
     */
    var clearSearch = function() {
      var categoryInput = $container.find('input[name=cat]'),
        category = categoryInput.length ? categoryInput.val() : null;

      if (category) {
        window.location.href = '/?cat='+category;
      } else {
        window.location.href = '/';
      }
    };

    var showTip = function() {
      if (_tipShowing) {
        return;
      }

      // Slight delay after event fired
      setTimeout(function() {
        $tip.hide().removeClass('hidden').fadeIn(200)
        .on('click', '.close', function() {
          hideTip(true);
        });
      }, 200);

      _tipShowing = true;
    };

    var hideTip = function(persist) {
      if (!_tipShowing) {
        return;
      }

      if (typeof persist !== 'undefined' && persist) {
        window.setCookie(_seenTipCookie, 1, _cookieDuration);
      }

      $tip.fadeOut(100, function() {
        $tip.addClass('hidden');
      });

      _tipShowing = false;
    };

    // Initialize component
    init();
  };

})(window.jQuery);
