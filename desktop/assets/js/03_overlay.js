(function($) {
  
  $.fn.overlay = function(options) {
    if (!options) options = {};
    options = $.extend({
      onOpen: null,
      onClose: null
    }, options);

    var self = this,
      $el = $(this),
      $content = $el.find('.overlay-content');

    var bindEvents = function() {
      $el.on('click', function(e) {
        self.close();
      });

      $content.on('click', function(e) {
        e.stopPropagation();
      });

      $content.delegate('.close', 'click', function(e) {
        e.preventDefault();
        self.close();
      });
    };

    var injectCloseButton = function() {
      $content.append('<button class="close"><i class="icon-cancel"></i></button>');
    };

    // Initialize component
    this.initialize = function() {
      bindEvents();
      injectCloseButton();
      return this;
    };

    this.open = function() {
      this.removeClass('hidden');
      if (options.onOpen) options.onOpen();
    };

    this.close = function() {
      this.addClass('hidden');
      if (options.onClose) options.onClose();
    };

    // Initialize component
    return this.initialize();
  };

})(window.jQuery);
