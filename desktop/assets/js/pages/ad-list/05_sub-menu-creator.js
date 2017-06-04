(function($) {

  $.fn.subMenuTemplateCreator = function (options) {

    // Defaults values
    this.defaultOptions = {
      appearIn: null,
      callBack: function(){}
    };
    var settings = $.extend({}, this.defaultOptions, options);

    // Elements
    var $this = this;

    var showSubCategoryFilters = function (dom){
      var id = dom.find(':selected').data('child'),
          childId = '#'+id,
          _tempChild = $(childId).html();

      if($(childId).length>0){
        $(settings.appearIn).html(_tempChild);
      }
      else {
        $(settings.appearIn).html('');
      }
    };

    var setPreloadedValue =  function (){
      var preLoadedDom = $this.find('option:selected').data('child');
      if(preLoadedDom){
        showSubCategoryFilters($this);
        settings.callBack();
      }
    };

    var onChangeValue = function(){
      $this.on('change', function(){
        showSubCategoryFilters($(this));
        settings.callBack();
      });
    };

    var init = function (){
      setPreloadedValue();
      onChangeValue();
    };

    // Init
    init();
    
  };
})(window.jQuery);