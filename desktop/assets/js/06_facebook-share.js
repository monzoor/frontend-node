(function($) {

  /**
   * Opens Facebook share dialog and returns success/failvia callback
   * @param {String} href - URL to share
   * @param {Object} callback - Callback function accepting one parameter (success Bool)
   */
  window.facebookShare = function(href, callback) {
    // Append GA tags to href
    href += '?utm_source=share_desktop&utm_campaign=kite&utm_medium=facebook';

    // Build FB dialog URL
    var url = "https://www.facebook.com/dialog/share?app_id={{appId}}&display=popup&href={{href}}&redirect_uri={{redirectUri}}"
      .replace('{{appId}}', window.Ekhanei.facebook.appId)
      .replace('{{href}}', encodeURIComponent(href))
      .replace('{{redirectUri}}', encodeURIComponent(window.Ekhanei.facebook.redirectUri));
    
    // Open popup and "listen" for callback page
    var dialog = window.open(url, "Share on Facebook", "width=550,height=380");

    // If popup is closed
    var closeInterval = setInterval(function() {
      if (dialog.closed) {
        clearInterval(closeInterval);
        callback(false);
      }
    }, 100);

    // If share success
    window.facebookShared = function() {
      clearInterval(closeInterval);
      dialog.close();
      callback(true);
    }
  }

})(window.jQuery);