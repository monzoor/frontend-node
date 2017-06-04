(function($) {

  var $avatarFile = $('#photoInput'),
    $form = $('#profileDetailsForm'),
    deleteAccount = $('#deleteAccount').overlay(),
    verifyPhone = $('#verifyPhone').overlay();

  // When user selects an avatar upload immediately
  $avatarFile.on('change', function(e) {
    // Show spinner
    $(this).parent().addClass('loading');
    $form.submit();
  });


  var hash = window.location.hash;
  if(hash == '#verifyphone'){
    verifyPhone.open();
  }

  $('#sureDelete').on('change', function (){
    if(this.checked) {
      $('#delete-account-btn').removeAttr('disabled').removeClass('disable');
    } else {
      $('#delete-account-btn').attr('disabled','disabled').addClass('disable');
    }
  });

  $('#delete-account-btn').on('click', function(e) {
    e.preventDefault();
    deleteAccount.open();
  });

  $('#genderLevel').html($('#genderSelection option:selected').text());

  $('input').on('focus', function (){
    $(this).removeClass('input--error');
  });

  $('.edit__item').on('click', function (){
    var $editItem = $(this),
        textElement = $(this).children().first().html(); // Grab previous data
    $(this).addClass('edit__item--active');

    // Auto focus
    $(this).find('.edit__inputs input, .edit__inputs select').focus();

    // Apply previous data to input, select box
    $(this).find('.edit__inputs input').val(textElement);

    // Show button
    $('.profile .btn-block').css('display','block');

    $('.edit__inputs input').on('blur', function (){

      if ($(this).val() === null) {
         
        $(this).parent().prev().eq(0).html(textElement);
        $('.profile .btn-block').hide();
      }
      else $(this).parent().prev().eq(0).html($(this).val());
      $editItem.removeClass('edit__item--active');
    });

    $('.edit__inputs select').on('blur', function (){
      
      var e = document.getElementById("genderSelection");
      var text = e.options[e.selectedIndex].text;
      
      if (text === textElement) {
        $('.profile .btn-block').hide();
      }

      else $(this).parent().prev().eq(0).html(text);
      $editItem.removeClass('edit__item--active');
    });
  });

  // year validation
  $('#profileDetailsForm').yearValidation();
})(window.jQuery);