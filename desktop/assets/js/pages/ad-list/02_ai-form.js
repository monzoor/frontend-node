(function($, validate) {
  
  $.fn.postAdForm = function(options) {

    // Default options
    if (!options) options = {};
    $.extend(options, {});

    // Container
    var $container = this;

    // Fields
    var $fields = {
      description: this.find('[name=description]'),
      price:       this.find('[name=price]'),
      location:    this.find('[name=address]'),
      category:    this.find('[name=category]'),
      title:       this.find('[name=title]')
    };

    // Other elements
    var $form = $container.find('#adInsertForm'),
        $placeholder = $fields.description.next(),
        $photos = $container.find('.photos').eq(0),
        $files = $photos.find('input[type=file]');

    // Properties
    var _open = false,
        _dirty = false,
        _gaEventCategory = "Ad Insertion",
        _fileApiSupport = (window.File && window.FileReader && window.FileList && window.Blob);

    // Validation contraints/schema
    var _constraints = {
      description: {
        presence: true,
        length: {
          minimum: 2,
          maximum: 500
        }
      },
      price: {
        presence: true,
        numericality: {
          onlyInteger: true,
          greaterThan: 0
        },
        length: {
          minimum: 1,
          maximum: 10
        }
      },
      location: {
        presence: true
      },
      category: {
        presence: true
      }
    };

    /**
     * Init
     *
     * Initialize the component and bind events
     */
    var init = function() {

      // Attach initial values to fields
      for (var k in $fields) {
        var $field = $fields[k];
        $field.data('initialValue', $field.val());
      }

      // The primary point of entry to the form is when a
      // user focuses on the textarea
      $fields.description.on('click', open);

      // Update textarea state on keyup
      $fields.description.on('keydown keyup', layoutDescription);

      // on click remove preloaded images for ad renew
      if($(this).find('.upload-photos').hasClass('renew')){
        _open = true;
        renew ($files);
      }

      // When "Post" button is clicked
      $form.on('submit', function(e) {

        // Stop the form from submitting straight away
        e.preventDefault();
        
        // If the form is closed, then open it
        if (!_open) {
          open();
        }
        // If the form is open then submit it
        else {
          submitAd();
        }
      });

      $files.on('change', handleFileSelect);

      return this;
    };

    /**
     * Is Printable Key
     *
     * Determines whether the provided key code correlates
     * to a character that takes up visual space.
     */
    var isPrintableKey = function(keycode) {
      return ((keycode > 47 && keycode < 58)   || // number keys
              (keycode == 32 || keycode == 13) || // spacebar & return key(s) (if you want to allow carriage returns)
              (keycode > 64 && keycode < 91)   || // letter keys
              (keycode > 95 && keycode < 112)  || // numpad keys
              (keycode > 185 && keycode < 193) || // ;=,-./` (in order)
              (keycode > 218 && keycode < 223));   // [\]' (in order))
    };

    /**
     * Layout Description
     *
     * Determines whether to show or hide the placeholder,
     * and whether to expand the height of the textarea
     * based on its content.
     */
    var layoutDescription = function(e) {
      var value = $fields.description.val();

      // If this is a 'printable' key then we should hide
      // the placeholder
      if (isPrintableKey(e.keyCode)) {
        $placeholder.addClass('hidden');
      }

      // If the value is empty then we should show the
      // placeholder
      else if (!value) {
        $placeholder.removeClass('hidden');
      }
    };

    /**
     * Is Dirty
     * 
     * Determines if the form values have changed from
     * their original state.
     */
    var isDirty = function() {

      // Assume form is clean
      var dirty = false;

      // Compare current values vs initial
      for (var key in $fields) {
        var $field = $fields[key];

        if ($field.val() !== $field.data('initialValue')) {
          dirty = true;
          break;
        }
      }

      // Check for photos
      $files.each(function() {
        // If any of the file inputs has a file, then the
        // form is dirty.
        if ($(this).data('hasPhoto')) {
          dirty = true;
          return;
        }
      });

      return dirty;
    };

    /**
     * Handle File Select
     *
     * Called when a user selects an image file for upload.
     * On newer browsers, the HTML5 File APIs should be
     * used to create a preview. On older browsers we
     * should just change the style of the upload button.
     */
    var handleFileSelect = function(e) {

      // File input
      var $file = $(this);
      
      // Photo container
      var $photo = $file.parent().parent();

      if (_fileApiSupport) {

        // Get the collection of selected File objects.
        var files = e.target.files;

        // Make sure there is at least one file selected.
        if (files.length === 0) {
          return;
        }

        // We're only going to process one file
        var file = files[0];

        // Make sure this file is the right format
        if (!file.type.match('image.*')) {
          return;
        }

        // Instantiate a FileReader so we can read the
        // contents of the file.
        var reader = new FileReader();

        // When FileReader reads a file
        reader.onload = function(e) {

          // Create the preview
          $photo.addClass('preview').find('.preview')
            .css('background-image', 'url('+e.target.result+')');

          // Flag this file input as selected
          $file.data('hasPhoto', true);

          // Remove photo button
          $photo.find('button.cancel').on('click', function(e) {
            e.preventDefault();

            // Photo container
            var $photo = $(this).parent().parent();
            removePhoto($photo);

            $file.data('hasPhoto', false);
          });

          // Clear any photo validation errors
          clearError($photos);
        };

        // Read the selected file
        reader.readAsDataURL(file);
      }

      // Track event
      trackEvent('Select Photo', null, null);
    };

    /**
     * Remove File
     *
     * Handles clicks on the remove photo button. Resets
     * the element's state and the associated file input.
     */
    var removePhoto = function(photo) {

      // File input
      var $file = photo.find('input').eq(0);

      // If there's no preview
      if (! photo.hasClass('preview')) {
        return;
      }

      // Clear the file input
      $file.val('');

      // Reset photo button state
      photo.removeClass('preview').find('.preview').attr('style', '');

      // Track event
      trackEvent('Remove Photo', null, null);
    };

    /**
     * Remove preloaded photo
     *
     * Handles clicks on the remove photo button. Resets
     * the element's state.
     */
    var renew = function($files){
      $files.each(function (){
        // Preloaded photo container
        var bgHolder = $(this).parents().eq(0).next('.preview');

        // Check if preloaded available
        if(bgHolder.css('background-image') != 'none'){

          // Remove photo button
          bgHolder.find('button.cancel').on('click', function(e) {
            e.preventDefault();

            // Photo container
            var $photo = $(this).parent().parent();
            $photo.find('input[name=images]').remove();
            removePhoto($photo);
          });
        }
      });
    };

    /**
     * Open
     *
     * Expands the ad insertion form
     */
    var open = function() {
      // If the form is already open
      if (_open) {
        return;
      }

      // 'Opens' the form
      $container.removeClass('closed');

      // Focus on description
      $fields.description.focus();

      // We delay the following listeners to allow the
      // initial click event to propagate to the document,
      // which will close any other 'open' components
      setTimeout(function() {

        // If user clicks outside we should close the form
        if($fields.title.length === 0){
          $(document).on('click', close);
        }

        // We should stop any click events within the form
        // from bubbling to the document
        $container.on('click', function(e) {
          e.stopPropagation();
        });
      }, 100);

      // Change the internal state flag
      _open = true;

      trackEvent('Open Form', null, null);
    };

    /**
     * Close
     *
     * Collapses the ad insertion form
     */
    var close = function() {

      // If the form is already closed
      if (!_open) {
        return;
      }

      // If the form is dirty then don't close
      if (isDirty()) {
        return;
      }

      // 'Closes' the form
      $container.addClass('closed');

      // Clear any visible validation errors
      clearAllErrors();

      // Stop listening to the document
      $(document).off('click', close);

      // Stop blocking click events from bubbling
      $container.off('click');

      // Change the internal state flag
      _open = false;

      trackEvent('Close Form', null, null);
    };

    /**
     * Show Error
     *
     * Display an error underneath the provided field
     */
    var showError = function(field, message) {
      // Variable to hold the error <span>
      var $error = null;

      // If the field is already displaying an error then
      // just get the element
      if (field.data('error')) {
        $error = field.next('.error').eq(0);
      }

      // If the field is not displaying an error then
      // create the element and insert it into the DOM
      else {
        $error = $('<span class="error">test</span>');
        $error.appendTo(field.parent());
      }

      // Display the message
      $error.html(message);

      // Mark field as having error
      field.data('error', true);

      // When this field changes, remove the validation
      // error. The user no longer needs to see the message
      // and we will revalidate on submission.
      var eventName = field.is('select') ? 'change' : 'keydown';
      var clearEvent = function() {
        clearError(field);
        field.off(eventName, clearEvent);
      };

      field.on(eventName, clearEvent);
    };

    /**
     * Clear error
     *
     * Clears the error state from the provided field
     */
    var clearError = function(field) {
      // If this field is not displaying an error then do
      // nothing.
      if (!field.data('error')) {
        return;
      }

      // Remove the error <span>
      field.parent().find('.error').remove();

      // Mark the field as valid
      field.data('error', false);
    };

    /**
     * Clear All Errors
     *
     * Clears all validation errors visible within the post
     * ad form.
     */
    var clearAllErrors = function() {

      // Clear fields
      for (var name in $fields) {
        var $field = $fields[name];

        clearError($field);
      }

      // Clear photo errors
      clearError($photos);
    };

    /**
     * Validate photos
     *
     * As we can't use the 'validate' library to check for
     * photos, we need to use a custom validation function.
     */
    var validatePhotos = function() {
      // Manually validate the photos.
      // At least 1 photo must be selected
      var hasPhoto = false;

      $files.each(function() {
        var bgHolder = $(this).parents().eq(0).next('.preview');

        // Check file upload have bo value or if preloaded image not available
        if ($(this).val() !== '' || (bgHolder.css('background-image') != 'none')) {
          hasPhoto = true;
          return;
        }
      });

      if (!hasPhoto) {
        var error = "You must upload at least 1 photo";
        showError($photos, error);

        return false;
      }

      return true;
    };

    /**
     * Validate form
     *
     * Validate the form, including photos. Returns false
     * if invalid.
     */
    var validateForm = function() {
      // Gather the data
      var data = {
        description: $fields.description.val(),
        price: $fields.price.val().replace(/\s/g, ""),
        location: $fields.location.val(),
        category: $fields.category.val()
      };

      if($fields.title.length !== 0){
        data.title = $fields.title.val();
        _constraints.title = {
          presence: true,
          length: {
            minimum: 1,
            maximum: 70
          }
        };
      }
      // Validate the form data
      var errors = validate(data, _constraints);

      // If there are validation errors
      if (errors) {
        for (var name in errors) {
          var message = errors[name][0],
              field = $fields[name];

          showError(field, message);
        }
      }

      // Also validate the photos
      var photoErrors = validatePhotos();

      // If there are errors then return false
      if (errors || !photoErrors) {
        return false;
      } else {
        return true;
      }
    };
    /**
     * Validate Filters
     *
     * Validate the category filter Returns false
     * if invalid.
     */
    // TODO Refactor REL-298
    var validateFilter = function (){
      var valueNotPresent;
      $('#metaFields .field').each(function(){
        var slug = $(this).attr('id');
        var dom = $('[name="filters['+slug+']"]');
        var fieldsValue = parseInt(dom.val());

        if(fieldsValue === null || fieldsValue === '' || isNaN(fieldsValue) === true) valueNotPresent = true;
        if(valueNotPresent) {
          dom.parent().find('.error').remove();
          dom.parent().append("<span class='error'>This field can't be blank</span>");
        } else {
          dom.parent().find('.error').remove();
        }
      });
      if(valueNotPresent || typeof valueNotPresent !== 'undefined') return false;
      return true;
    };

    /**
     * Submit
     *
     * Validates and submits the form if it's valid. Forces
     * user to login if not already.
     */
    var submitAd = function() {

      // If the form is invalid do nothing
      if (!validateFilter()) {
        return;
      }
      if ((!validateForm())){
        return;
      }

      if (Ekhanei.loggedIn) {
        $container.addClass('loading');

        // Track event
        trackEvent('Submit Form', null, function() {
          $form[0].submit();
        });
      }

      // If the user is not logged in then force
      // authentication
      else {
        window.authenticate({
          flow: 'ad-insertion',
          success: function(overlay) {
            overlay.close();

            // Only submit the form when the user is authed
            $container.addClass('loading');

            // Track event
            trackEvent('Submit Form', 'User authed in process', function() {
              $form[0].submit();
            });
          }
        });
      }
    };

    /**
     * Track Event
     *
     * Sends an event to Google Analytics
     */
    var trackEvent = function(action, label, callback) {
      if (typeof ga !== 'undefined') {
        ga('send', {
          hitType: 'event',
          eventCategory: _gaEventCategory,
          eventAction: action,
          eventLabel: label,
          hitCallback: callback
        });
      }
    };

    this.init = init;
    this.open = open;

    // Initialize component
    return this.init();
  };

})(window.jQuery, window.validate);
