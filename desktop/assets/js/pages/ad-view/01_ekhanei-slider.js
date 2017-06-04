(function($) {
  // Ekhanei Slider
  $.fn.ekhaneiSlider = function (options) {
    // Defaults values
    this.defaultOptions = {
      thumbnail: true,
      displayWidth: screen.width,
      auto: false, // Automatic slide
      slideTime: '3000', // Slide delay
      margin: 0, // Margin on left and right
      infinite: false, // Infinite scroll
      nextButtonClass: 'next', // Next button class name
      prevButtonClass: 'prev', // Prev button class name
      onChange: function(){}
    };

    // extend function 
    var extend = function(out) {
      out = out || {};
      for (var i = 1; i < arguments.length; i++) {
        if (!arguments[i])
          continue;

        for (var key in arguments[i]) {
          if (arguments[i].hasOwnProperty(key))
            out[key] = arguments[i][key];
        }
      }
      return out;
    };
    // Merge with new options value
    var settings = extend({}, this.defaultOptions, options);
    
    // Main function
    return this.each(function() {

      var currentIndex =0,
        ci,
        xDown = null,
        yDown = null,
        $thumbnailClass = $(".thumbnail"),
        $this = $(this),
        $item = $this.find('ul'),
        itemCount = $this.find('li').length;

      // Variable creation for global and responsiveness
      var variables = function (itemCount){
        var windowWidth = settings.displayWidth,
        totalWidth = itemCount*windowWidth;
        $this.css('width',(windowWidth-settings.margin)+'px');
        $this.find('li').css('width',(windowWidth-settings.margin)+'px');
        $item.css('width',totalWidth+'px');
      };

      // Variable call for global
      variables(itemCount);
      // Responsive variable calls
      window.onresize = function(event) {
        variables(itemCount);
      };

      // Animation
      var goTo = function (index){
        $thumbnailClass.removeClass('selected');
        $thumbnailClass.filter('[data-target="'+index+'"]').addClass('selected');
        (index === itemCount-1 ) ? ($item.css({ 'left': '-'+ (index*100) + '%'}), index = 0) : $item.css({ 'left': '-'+ (index*100) + '%'});
        settings.onChange();
      };


      // thumbnil
      if (settings.thumbnail) {
        $thumbnailClass.each(function (e){
          var indexValue = e;
          $(this).attr('data-target', indexValue);
        });
        $thumbnailClass.click(function (e){
          e.preventDefault();
          var targerValue = $(this).data('target')
          currentIndex = targerValue;
          goTo(targerValue);
        });
        $thumbnailClass.filter('[data-target="0"]').addClass('selected');
      }

      // Auto slide
      if (settings.auto) {
        settings.infinite = true;
        setInterval(function() {
          var ci = nextIndex();
          goTo(ci);
        }, settings.slideTime);
      }

      // Next index counter
      var nextIndex = function (){
        currentIndex += 1;
        (currentIndex > itemCount - 1) && (settings.infinite?currentIndex=0:currentIndex=itemCount-1);
        return currentIndex;
      };

      // Previous index counter
      var prevIndex = function (){
        currentIndex -= 1;
        currentIndex<0 && (settings.infinite?currentIndex=itemCount-1:currentIndex=0);
        return currentIndex;
      };

      // Next click
      $('.'+settings.nextButtonClass).click(function (e){
        e.preventDefault();
        var ci = nextIndex();
        goTo(ci);
      });

      // Previous click
      $('.'+settings.prevButtonClass).click(function (e){
        e.preventDefault();
        var ci = prevIndex();
        goTo(ci);
      });
    });
  };

})(window.jQuery);
