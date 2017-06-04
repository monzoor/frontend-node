(function($, validate) {
  
  $.fn.authPanel = function(options) {
    if (!options) options = {};
    options = $.extend({
      success: null,
      successRedirect: null,
      flow: null,
      // If true user will be sent OTP and see verification step
      verifyRegistration: false,
      verifyChangephone: false
    }, options);

    var self = this,
      $el = $(this),
      $businessCategores = $el.find('.business-categories');

    var bindEvents = function() {
      // Show/hide business categories
      $('input[name=type]').on('change', function(e) {
        if (e.target.value === 'b') {
          $businessCategores.removeClass('hidden');
          $('.info__business').removeClass('hidden');
          $('.info__general').addClass('hidden');
        } else {
          $businessCategores.addClass('hidden');
          $('.info__business').addClass('hidden');
          $('.info__general').removeClass('hidden');
        }
      });
    };

    var showMessage = function(flow) {
      // First reset all messages
      $el.find('.auth-message').addClass('hidden');

      if (flow === 'ad-insertion') {
        $el.find('.auth-message[data-flow='+flow+']').removeClass('hidden');
      }
    };

    // TODO: All this ajax stuff needs refactoring
    var initAjax = function() {
      // Login form
      $("#logIn").ajaxCall({
        formName: "#logIn",
        url: '/auth/a/login',
        alertPanel: '#loginAlert',
        onSuccess: function (data){
          if (!options.success) {
            if (data.redirection) {
              window.location = data.redirectUrl;
            } else if (options.successRedirect) {
              window.location = options.successRedirect;
            } else {
              location.reload();
            }
          } else {
            options.success();
          }
        },
        onError: function(e){
          $('#unverifiedAccountLink').on('click', function (e){
            e.preventDefault();
            $('#verification').attr('data-url','recover');
            $('#forgotPasswordPanel, #loginPanel').slideToggle('fast', function() {
              $('#forgotpassAlert').hide();
              //let's auto full phone number form login form
              $('#forgotPasswordPanel').find('input[type=number]').val($('input[type=number]', '#logIn').val());
            });
          });
        }
      });

      // Forgot password ajax
      $("#forgotPassword").ajaxCall({
        formName: "#forgotPassword",
        url: '/auth/a/login/forgot',
        alertPanel: '#forgotpassAlert',
        nextPanel: true,
        nextPanelAnimation: function () {
          // Go to forgot password panel by click
          $("#forgotPasswordLink, #backToLogin").on('click', function (e){
            e.preventDefault();
            $('#verification').attr('data-url','forgot');
            if($(this).is('#backToLogin')){
              $('#verification').removeAttr('data-url');
            }
            $('#forgotPasswordPanel, #loginPanel').slideToggle('fast', function() {
              $('#forgotpassAlert').hide();
              //let's auto full phone number form login form
              var loginPhone = $('#logIn input[name=phone]').val();
              $('#forgotPasswordPanel input[name=phone]').val(loginPhone);
            });
          });
        },
        onSuccess: function (e){
          $('#forgotPasswordPanel, #verificationPanel').slideToggle('fast');
          $('#phoneNumber').html(e.phoneNumber);
        }
      });

      // Verification code ajax 
      $("#verification").ajaxCall({
        formName: "#verification",
        url: '/auth/a/login/forgot/verify',
        alertPanel: '#varificationCodeAlert',
        onSuccess: function (e){
          if($('#verification').attr('data-url') === 'recover'){
            $('#verificationPanel, #verifiedPanel').slideToggle('fast');
          }
          else $('#verificationPanel, #resetPasswordPanel').slideToggle('fast');
        }
      });

      $('#logInLink').on('click', function (e){
        e.preventDefault();
        $('#loginAlert, #forgotPassword, #verification').removeAttr('style');
        $('#verification input').val('');
        $('#loginPanel, #verifiedPanel').slideToggle('fast');
      });

      $("#resendLogin").on('click', function (e){
        e.preventDefault();
        $('#verificationPanel, #forgotPasswordPanel').slideToggle('fast');
        $("#forgotPassword").show();
      });

      // Reset password ajax
      $("#resetPassword").ajaxCall({
        formName: "#resetPassword",
        url: '/auth/a/login/forgot/reset',
        alertPanel: '#resetPasswordAlert',
        onSuccess: function (e){
          if (!options.success) {
            if (options.successRedirect) {
              window.location = options.successRedirect;
            } else {
              location.reload();
            }
          } else {
            options.success();
          }
        }
      });

      // registration
      $("#registrationFrom").ajaxCall({
        formName: "#registrationFrom",
        url: '/auth/a/register',
        alertPanel: '#regAlert',
        onSuccess: function (e){
          $('#registrationFrom').slideUp('fast');
          $('#verificationPanelReg').slideToggle('fast');
          $('#phoneNumberReg').html(e.phoneNumber);
        },
        onError: function (e) {
          var showError = function (error_type,a){
            if (error_type) {
              $(a).html(error_type).show();
              $('#regAlert').hide();
            }
            else  $(a).hide();
          };
          showError(e.message.name,"#name_error");
          showError(e.message.phone,"#phone_error");
          showError(e.message.password,"#password_error");
          
          if (e.message.category){
            showError(e.message.category,"#type_error");
          }
          else showError(e.message.type,"#type_error");
        }
      });

      $("#verificationReg").ajaxCall({
        formName: "#verificationReg",
        url: '/auth/a/register/verify',
        alertPanel: '#verificationCodeAlertReg',
        onSuccess: function (e){
          if (!options.success) {
            if (options.successRedirect) {
              window.location = options.successRedirect;
            } else {
              location.reload();
            }
          } else {
            options.success();
          }
        }
      });
      
      $('#resendReg').on('click', function (a){
        a.preventDefault();
        $.ajax ({
          type: 'GET',
          url: '/auth/a/register/verify/resend',
          dataType: 'json',
          success: function (e){
            $('#verificationCodeAlertReg').removeClass('alert-danger').addClass('alert-success');
            $('#verificationCodeAlertReg').show();
            $('#verificationCodeAlertReg .content span').html('');
            $('#verificationCodeAlertReg .content span').html(e.message);
          },
          error: function (e){
            $('#verificationCodeAlertReg').show();
            $('#verificationCodeAlertReg .content span').html('');
            $('#verificationCodeAlertReg .content span').html(e.message);
          }
        });
      });
    };

    var verifyRegistration = function() {
      $el.addClass('verify-reg');
      $.ajax ({
        type: 'GET',
        url: '/auth/a/register/verify/resend',
        dataType: 'json',
        success: function (e){
          $('#phoneNumberReg').html(e.phoneNumber);
        }
      });
    };

    var verifyChangephone = function() {
      $('#numberVerifyResend').hide().html('');
      $.ajax ({
        type: 'GET',
        url: '/account/phone/verify/resend',
        dataType: 'json',
        success: function (e){
          $('#numberVerifyResend').show().html(e.message);
        }
      });
    };

    
    // Initialize component
    this.initialize = function() {
      showMessage(options.flow);

      if (options.verifyChangephone) {
        verifyChangephone();
      }

      // If we need to verify an unverified session
      if (options.verifyRegistration) {
        verifyRegistration();
      } else {
        $el.removeClass('verify-reg');
      }

      // If component is already initialized then this
      // prevents any "double attaching" of events
      if ($el.data('initialized')) {
        return this;
      }
      
      // Init stuff
      bindEvents();
      initAjax();

      // Mark as initialized
      $el.data('initialized', true);

      return this;
    };

    // Initialize component
    return this.initialize();
  };

})(window.jQuery, window.validate);
