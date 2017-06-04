(function($){
  $.fn.lazyLoad = function(custom) {

    var self = this;

    // Default plugin settings
    var defaults = {
      initLoad: 0, // Number of images to load initially
      afterLoaded : function(){
        this.addClass('bg-loaded');
      }
    };

    // Merge default and user settings
    var settings = $.extend({}, defaults, custom);

    // Initial image load
    initImageLoad = function (index,value){
      if(index < settings.initLoad ) {
        value.removeAttr('data-src');
      }
      // Return after initial image load
      else return false;
    };

    // Detect image loading done
    detectBgImgLoaded = function (value){
      var $this = value,
        bgImgs = $this.css('background-image').split(', ');
      $this.data('loaded-count',0);

      $.each( bgImgs, function(key, value){
        var img = value.replace(/^url\(["']?/, '').replace(/["']?\)$/, '');
        $('<img/>').attr('src', img).load(function() {
          $(this).remove();
          $this.data('loaded-count',$this.data('loaded-count')+1);
          if ($this.data('loaded-count') >= bgImgs.length) {
            settings.afterLoaded.call($this);
          }
        });
      });
    };

    // On scroll image load.
    onScrollImgLoad = function (value){
      value.each(function (){
        var t = $(this);
        if((!t.hasClass('loaded')) && (t.offset().top < ($(window).scrollTop()+$(window).height()))){
          t.css("background-image","url("+t.attr('data-src')+")");
          detectBgImgLoaded(t);
        }
      });
    };

    // Loop through element
    self.each(function(index){
      initImageLoad(index,$(this));
    });
    // scroll lazyload
    $(window).scroll(function(){
      onScrollImgLoad(self);
    });
    // Load visible images
    onScrollImgLoad(self);
  };
})(window.jQuery);
