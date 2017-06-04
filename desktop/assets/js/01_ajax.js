(function($) {
  $.fn.ajaxCall = function (options) {
    // Defaults values
    this.defaultOptions = {
      formName: '',
      url: '',
      alertPanel: '',
      nextPanel: false,
      nextPanelAnimation: function (e){},
      onSuccess: function (e){},
      onError: function (e){}
    };

    // Merge with new options value
    var settings = $.extend({}, this.defaultOptions, options);

    // Main function
    return this.each(function() {

      // Show error message
      var showErrorMessage = function (dom, message){
        $(dom).removeClass('alert-success').addClass('alert-danger');
        $(dom).show();
        $(dom +' .content span').html('');
        $(dom +' .content span').html(message);
      };
      if (settings.nextPanel) {
        settings.nextPanelAnimation();
      }

      $(settings.formName).on('submit', function (e){
        e.preventDefault();
        $(settings.formName).parent().find(".loading").show();
        $(settings.formName+','+settings.alertPanel).hide();
        $.ajax ({
          type: 'POST',
          url: settings.url,
          dataType: 'json',
          data: $(this).serialize(),
          success: function (data) {
            if (data.error) {
              $(settings.formName).parent().find(".loading").hide();
              $(settings.formName+','+settings.alertPanel).show();
              showErrorMessage(settings.alertPanel, data.message);
              settings.onError(data);
            }
            else if(data) {
              $('.loading').hide();
              settings.onSuccess(data);
            }
          },
          error: function (data){
            $('.loading').hide();
            $(settings.formName+','+settings.alertPanel).show();
            errorRedirect (data.status, data.statusText, settings.alertPanel);
          }
        });
      });
      // Error handle for 404 and 500
      var errorRedirect = function (status, statusText, dom) {
        if (status === 404) location.href = '/404';
        else showErrorMessage(dom, 'Something went wrong. Please retry.');
      };
      
    });
  };
})(window.jQuery);
