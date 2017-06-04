(function($, validate) {
  // year validation plugin
  $.fn.yearValidation = function(options) {
    // Fields
    var $fields = {
      year: this.find('#year'),
      month: this.find('#month'),
      day: this.find('#day'),
    }, errors = null;
    
    // Validation contraints/schema
    var _constraints = {
      year: {
        length: {
          minimum: 4,
          maximum: 4
        },
        numericality: {
          onlyInteger: true,
          greaterThan: 1900,
          lessThanOrEqualTo: new Date().getFullYear()
        }
      },
      month: {
        length: {
          minimum: 1,
          maximum: 2
        },
        numericality: {
          onlyInteger: true,
          greaterThan: 0,
          lessThanOrEqualTo: 12
        }
      },
      day: {
        length: {
          minimum: 1,
          maximum: 2
        },
        numericality: {
          onlyInteger: true,
          greaterThan: 0,
          lessThanOrEqualTo: 31
        }
      }
    };

    $(this).on('submit', function (e){
      // Gather the data
      var data = {
        year: $fields.year.val(),
        month: $fields.month.val(),
        day: $fields.day.val()
      };

      function dobProvided() {
        return (
          !validate.isEmpty(data.day) || 
          !validate.isEmpty(data.month) ||
          !validate.isEmpty(data.year));
      }

      // For date or birth, accept all (m/d/y) or none
      if (dobProvided()) {
        _constraints.day.presence = true;
        _constraints.month.presence = true;
        _constraints.year.presence = true;
      } else {
        _constraints.day.presence = false;
        _constraints.month.presence = false;
        _constraints.year.presence = false;
      }

      // Leap year count
      if (data.year%4 === 0 && data.month == 2) {
        _constraints.day.numericality.lessThanOrEqualTo = 29;
      }
      // February month
      else {
        if (data.month == 2) {
          _constraints.day.numericality.lessThanOrEqualTo = 28;
        } else {
          _constraints.day.numericality.lessThanOrEqualTo = 31;
        }
      }
      // Validation
      errors = validate(data, _constraints);

      if (errors) {
        for (var name in errors) {
          var message = errors[name][0],
              field = $fields[name];
          showError(field, message);
        }
        return false;
      }
      else {
        return true;
      }
    });

    // hide error message on type
    $('.edit__inputs').find('input').on('keyup', function (){
      hideError ($(this));
    });
    
    function hideError (field) {
      _constraints.day.presence = _constraints.month.presence = false;
      // remove active error state
      field.parents().eq(1).removeClass('error_active');

      // remove error message
      var errorMessage = field.parent().next();
      errorMessage.remove();
    }

    function showError (field, message) {
      var $error = null;
      errorPlace = $(field.selector);

      // hide error
      hideError(errorPlace);

      // create error message
      $error = $('<span class="error">test</span>');
      errorPlace.parents().eq(1).append($error).addClass('error_active');
      $error.html(message);
    }
  };
})(window.jQuery, window.validate);