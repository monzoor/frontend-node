(function($) {
  // Init components
  var postAdForm = $('#postAdForm').postAdForm();
  var postEditForm = $('#postEditForm').postAdForm();

  $('#searchBar').searchBar();
  $(".category-filter").active();
  $("#otherFilters").active();

  // If url contains 'action=postad' then show post form
  if(window.location.href.indexOf('postad=true') !== -1) {
    postAdForm.open();
    postEditForm.open();
  }

  // Meta category show
  // TODO refactor REL-298
  if($('#category').val()) {
    showCategoryFilters($('#category'));
  }
  
  $('#category').on('change', function (){
    showCategoryFilters($(this));
  });

  function showSubCategoryFilters (dom){
    var id = dom.find(':selected').data('child');
    childId = '#'+id;
    _tempChild = $(childId).html();
    if($(childId).length>0){
      $('#showChildMetaFilters').html(_tempChild);
    }
    else $('#showChildMetaFilters').html('');
  }

  function showCategoryFilters(dom){
    var id = '#MetaFiledsForCat'+dom.val();
    var _temp = $(id).html();
    if($(id).length>0){
      $('#metaFields').html(_temp);
      if($('.parent').val()){
        showSubCategoryFilters ($('.parent'));
      }
      $('.parent').on('change', function (){
        showSubCategoryFilters ($(this));
      });
    }
    else {
      $('#metaFields').html('');
      $('#showChildMetaFilters').html('');
    }
  }

  /**
   * Active search filter
   *
   */

  // filter form reset
  var reset =  false;
  $('#reset').click(function() {
    $('#filters :input')
    .not(':button, :submit, :reset, :hidden')
    .each(function (){
      $(this).attr('value','');
    });

    $('#filters')
      .find('select option:selected')
      .removeAttr('selected');
     
    $('.select-multiple--selected ul').html('');
    $('#showMetafilterss').html('');
    reset = true;
  });

  // Active filter
  $('.other-filter__options').filters();
  

  // template create for conditional option
  $('.other-filter__options .multiple').subMenuTemplateCreator({
    appearIn: '#showMetafilterss',
    callBack: function() {
      $('.other-filter__options').filters({
        reset: reset
      });
    }
  });

  // Ad post thank you overlay
	aiThankyou = $('#aiThankyou').overlay();

  $('#postAnotherAd').on('click', function (e){
    e.preventDefault();
    $('#adInsertForm').find('textarea').trigger('click');
    aiThankyou.close();
  });

  $('#survey').on('click', function (){
    ga('send', 'event', 'Ad Insertion', 'Answer Survey');
    aiThankyou.close();
  });

  // Lazy load images
  $('.ad__image-wrapper .image').lazyLoad({
    afterLoaded : function() {
      $(this).addClass('loaded')
        .removeAttr('data-src');
    }
  });

})(window.jQuery);