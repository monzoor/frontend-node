(function($) {

  $.fn.filters = function(options) {

    // Defaults values
    this.defaultOptions = {
      reset: false
    };

    var settings = $.extend({}, this.defaultOptions, options);

    // Elements
    var title,id,
        queryString = window.location.search,
        $multipleOptionDom = $(this),
        $selectedItems = $('.select-multiple--selected ul');

    /**
     * Split query string
     *
     * Detect filter value from query string
     */
    var splitQueryString = function (qs){
      var string,name,value,
          strings = qs.slice(1).split('&');

      strings.map(function (v){

        string = v.split('=');
        name = string[0];
        value = string[1];

        // If name contain -id in the end
        if(value !== '' && name.search(/(-id)$/g) > -1){
          var $option = $('select[name="'+name+'"]').find('option[value="'+value+'"]');
          $option.attr('selected', 'selected');
        }
        // If name contain -ids in the end
        if(value !== '' && name.search(/(-ids)$/g) > -1 && !settings.reset){
          setCurrentValuesForMultiSelect(name,value);
        }
      });
    };

    /**
     * Set current value for multi select
     *
     * Put currently selected item in the selected list on reload
     */
    var setCurrentValuesForMultiSelect = function (name, value){
      // Checked current values
      $multipleOptionDom.find('#'+name+'-'+value).prop('checked',true);

      // Find title and id for the checked item
      title = $multipleOptionDom.find('#'+name+'-'+value).next().html();
      id = $multipleOptionDom.find('#'+name+'-'+value).attr('id');
      showMultipleSelectedItems (title, id);
    };

    /**
     * show Multiple Selected Items
     *
     */
    var showMultipleSelectedItems =  function (title, id){
      var _temp = '';
      // Remove all selected items if no title/id found
      if(typeof title === 'undefined' && typeof id === 'undefined'){
        $selectedItems.html('');
      }
      // Created selected checked item with cross button
      else {
        _temp = '<li id="'+id+'"><span>'+title+'</span><i class="icon-cancel"></i></li>';
      }
      // Append
      $selectedItems.append(_temp);
    };

    /**
     * remove multi selected items on click on the cross button
     *
     */
    var removeMultiSelect = function (){
      $selectedItems.find('.icon-cancel').on('click', function (e){
        e.preventDefault();
        id = $(this).parent().attr('id');
        $multipleOptionDom.find('#'+id).prop('checked', false);
        var $this = $(this);
        setTimeout(function() {
          $this.parent().remove();
        }, 50);
      });
    };

    /**
     * Change multiple brand
     *
     */
    var changeMultipleBrand = function (){
      $multipleOptionDom.find('input').on('change', function (){
        title = $(this).next().html();
        id = $(this).attr('id');

        if($(this).is(':checked')){
          showMultipleSelectedItems (title, id);
          removeMultiSelect();
        } else {
          $selectedItems.find('#'+id).remove('#'+id);
        }
      });
    };

    // Show hide filter options on click
    var showHide = function (){
      $('.select-multiple--headline').on('click', function (){
        $(this).parent().toggleClass('active');
      });
    };

    var init = function (){
      splitQueryString (queryString);
      removeMultiSelect();
      changeMultipleBrand();
      showHide();
    };

    if(queryString) {
      init();
    }
  };
  
})(window.jQuery);