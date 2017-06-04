(function($) {
  // Add active state
  $.fn.active = function() {
    return this.each(function () {
      var self = this,
        $el = $(this),
        $handle = $el.find('.handle').eq(0),
        $submenu = $el.find('.submenu').eq(0),
        _isOpen = false;

      var bindEvents = function() {
        // When the handle is clicked open the dropdown
        $handle.on('click', function(e) {
          if ($(this).attr('href') === '#') {
            e.preventDefault();
            toggle();
          } else {
            toggle();
          }
        });

        // Stop events from within submenu propagating
        $submenu.on('click', function(e) {
          e.stopPropagation();
        });
      };

      var toggle = function() {
        if (_isOpen) {
          close();
        } else {
          open();
        }
      };

      var open = function() {
        $el.addClass('active');
        _isOpen = true;

        // Delay this as otherwise is triggered immediately
        setTimeout(function() {
          // If a click event makes it to the document then
          // the user clicked outside the dropdown
          $(document).on('click.dropdown', function(e) {
            var target = $(e.target);
            // Avoide closing filter dropdown during setting filters
            var filterId = target.closest('#filters').attr('id');
            if(filterId !== 'filters'){
              close();
            }
          });
        }, 100);
      };

      var close = function() {
        $el.removeClass('active');
        _isOpen = false;

        $(document).off('click.dropdown');
      };

      bindEvents();
    });
  };

})(window.jQuery);
