(function($, Ekhanei, Conversation) {

  var _$conversationWrapper = $('#conversationWrapper'),
    _$messagesView = $('#messagesView'),
    _$conversationList = $('#conversationList'),
    _$messageForm = $('#messageForm'),
    _$messageSnippets = $('#messageSnippets'),
    _$messageTextarea = _$messageForm.find('textarea').eq(0),
    _$newListItem = null,
    _conversationTemplate = $('#conversationTemplate').html(),
    _noMessagesTemplate = $('#noMessagesTemplate').html(),
    _messageTemplate = $('#messageTemplate').html(),
    _snippetTemplate = $('#snippetTemplate').html(),
    _messagePlaceholder = _$messageTextarea.attr('data-placeholder'),
    _conversation = null,
    _loading = false,
    _typingTimeout;

  var init = function() {
    // Handle state changes
    window.onpopstate = popStateHandler;

    // Bind UI events
    bindEvents();

    // Load the first conversation
    loadFirstConversation();
  };

  var popStateHandler = function(e) {
    if (e.state) {
      loadConversation($('#'+e.state.linkId), false);
    } else {
      window.history.back();
    }
  };

  var bindEvents = function() {
    _$conversationList.on('click', '.inbox > a', function(e) {
      e.preventDefault();

      if (_loading) {
        return;
      }

      // Load the conversation
      loadConversation($(this));
    });

    _$messageForm.on('submit', function(e) {
      e.preventDefault();

      var $message = $(this).find('[name=content]'),
          message = $message.val();

      // If message is empty
      if (!_conversation || !message) {
        return;
      }

      // Send the message
      _conversation.sendMessage(message);

      // Clear textarea
      $message.val('');

      // Track event
      ga('send', 'event', 'Messages', 'Send Message');
    });

    _$messageSnippets.on('click', '.snippet', handleSnippetClick);
  };

  var setLoadingState = function(loading) {
    if (loading && !_loading) {
      _$messagesView.addClass('loading');
      _loading = true;
    }
    else if (!loading && _loading) {
      _$messagesView.removeClass('loading');
      _loading = false;
    }
  };

  var loadFirstConversation = function() {
    // If there are only four URI segments or if the 5th
    // segment is empty then we should load the first
    // conversation, otherwise the user has landed on a
    // specific message.
    var segments = window.location.href.split('/');

    if (segments.length <= 4 || segments[4] === '') {
      loadConversation($('#conversationLink0'));
    } else {
      var searchHref = segments.slice(4).join('/').replace(/\/$/g, '');
      var $link = $(".conversation-link[href*='"+searchHref+"']");

      // If the message link exists (if url is valid)
      if ($link.length > 0) {
        loadConversation($link);
      }
      // Otherwise try to start a new conversation
      else {
        var adId = segments[4];

        // Create new conversation
        newConversation(adId);
      }
    }
  };

  var newConversation = function(adId) {
    var $firstLink = $('li.inbox:first-child > a');

    getConversation(adId, null)
    .done(function(data) {
      // Prepend a conversation link and select it
      var $newListItem = $firstLink.parent().clone().removeClass('hidden'),
        $newLink = $newListItem.find('a').eq(0);

      // Hacky - should be improved in the future
      $newListItem.addClass('selected');
      $newLink.attr('id', 'newLink').attr('href', '/messages/'+adId);
      $newLink.find('.item-img').attr('src', '/image/item/'+data.ad.id+'/square');
      $newLink.find('.avatar-img').attr('src', data.participants.them.avatar);
      $newLink.find('.ad-title').html(data.ad.title);
      $newLink.find('.last-message-time').html('');
      $newLink.find('.last-message').html('New message...');

      // Inject into dom
      $newListItem.prependTo(_$conversationList);
      _$newListItem = $newListItem;

      // Render the message window
      renderConversation(data);
    })

    // If new conversation couldn't be started
    .fail(function() {
      loadConversation($('#conversationLink0'));
    });
  };

  var loadConversation = function($link, pushState) {
    // If the link object isn't present then there are no
    // messages to display.
    if ($link.length === 0) {
      return noMessages();
    }

    // Change state
    if (typeof pushState === 'undefined' || pushState) {
      window.history.pushState({
        linkId: $link.attr('id')
      }, '', $link.attr('href'));
    }

    // Select the conversation link
    selectConversation($link);

    // Remove the previous conversation content
    _$conversationWrapper.empty();
    _$messageTextarea.attr('placeholder', '');

    // Disconnect current conversation
    if (_conversation !== null) {
      _conversation.disconnect();
      _conversation = null;
    }

    // Get ad and buyer id from href
    var splitHref = $link.attr('href').split('/'),
        adId = splitHref[2],
        buyerId = (splitHref.length === 4) ? splitHref[3] : null;

    getConversation(adId, buyerId)
    .done(function(data) {
      renderConversation(data);
    });
  };

  var getConversation = function(adId, buyerId) {
    // Show loading state
    setLoadingState(true);

    // Build request url
    var requestUrl = '/messages/a/conversation?adId='+adId;
    if (buyerId) {
      requestUrl += '&buyerId='+buyerId;
    }

    return $.ajax({
      type: 'GET',
      url: requestUrl
    })
    .always(function() {
      setLoadingState(false);
    });
  };

  var parseTemplate = function(template, vars) {
    for (var k in vars) {
      var re = new RegExp('{{'+k+'}}','g');
      template = template.replace(re, vars[k]);
    }

    return template;
  };

  var renderConversation = function(data) {
    var template = parseTemplate(_conversationTemplate, {
      adLink: data.ad.link,
      title: data.ad.title,
      price: data.ad.price
    });

    // Display the ad details
    _$conversationWrapper.html(template);

    // Change the name in the message placeholder
    var messagePlaceholder = parseTemplate(_messagePlaceholder, {
      name: data.participants.them.name
    });
    _$messageTextarea
      .attr('placeholder', messagePlaceholder)
      .focus();
    
    if (data.userRole == 'buyer') {
      _$messageTextarea.val(Ekhanei.defaultMessage.text);
    }

    // Instantiate the conversation
    var conversation = new Conversation(data.xmpp);

    // When a message is received
    conversation.on('message', function(message) {
      _$messageTextarea.val('');

      var user = {};
      if (message.own) {
        user = data.participants.me;
        user.who = "me";
      } else {
        user = data.participants.them;
        user.who = "";
      }

      // Parse the template
      var template = parseTemplate(_messageTemplate, {
        who: user.who,
        avatar: user.avatar,
        name: user.name,
        message: message.content,
        time: relativeTime(message.time)
      });

      $('#messages').append(template);
      scrollToLatest($('#messages'));
    });

    renderSnippets(data.userRole);

    _conversation = conversation;
  };

  var scrollToLatest = function($messages) {
    var el = $messages[0];
    el.scrollTop = el.scrollHeight;
  };

  var selectConversation = function($link) {
    // Change selected states
    var $parent = $link.parent();
    $parent.siblings().removeClass('selected');
    $parent.addClass('selected');
  };

  var noMessages = function() {
    var template = parseTemplate(_noMessagesTemplate, {});
    _$conversationWrapper.html(template);
  };

  var relativeTime = function(utcTime) {
    // Instantiate 2 date objects to compare
    var now = new Date(),
        then = new Date(utcTime);
    
    // Define time in milleseconds
    var second = 1000,
        minute = second * 60,
        hour = minute * 60,
        day = hour * 24,
        week = day * 7,
        month = day * 30,
        year = day * 365;
    
    // Determine elapsed time in milleseconds
    var elapsed = now.getTime() - then.getTime();

    function timeString(n, singular, plural) {
      if (n > 1) {
        return n+' '+plural+' ago';
      } else {
        return n+' '+singular+' ago';
      }
    }

    // Less than 5 seconds
    if (elapsed < (second * 5) || !utcTime) {
      return 'Just now';
    }
    // Less than 1 minute
    else if (elapsed < minute) {
      return timeString(Math.round(elapsed/second), 'second', 'seconds');
    }
    // Less than 1 hour
    else if (elapsed < hour) {
      return timeString(Math.round(elapsed/minute), 'minute', 'minutes');
    }
    // Less than 1 day
    else if (elapsed < day) {
      return timeString(Math.round(elapsed/hour), 'hour', 'hours');
    }
    // Less than 1 week
    else if (elapsed < week) {
      return timeString(Math.round(elapsed/day), 'day', 'days');
    }
    // Less than 1 month
    else if (elapsed < month) {
      return timeString(Math.round(elapsed/week), 'week', 'weeks');
    }
    // Less than 1 year
    else if (elapsed < year) {
      return timeString(Math.round(elapsed/month), 'month', 'months');
    }
    // More than 1 year
    else {
      return 'Over 1 year ago';
    }
  };

  var renderSnippets = function(userRole) {
    if (!Ekhanei.chatSnippets) return;

    var $snippetContainer = _$messageSnippets.find('ul').eq(0);
    $snippetContainer.empty();
    
    for (var i in Ekhanei.chatSnippets) {
      var snippet = Ekhanei.chatSnippets[i];
      if (snippet.for !== userRole) continue;

      var el = parseTemplate(_snippetTemplate, {
        text: snippet.text,
        title: snippet.title
      });
      $snippetContainer.append(el);
    }
  };

  var handleSnippetClick = function(e) {
    e.preventDefault();

    // Cool typing effect
    var typeChar = function(text, index) {
      var currentVal = _$messageTextarea.val();
      _$messageTextarea.val(currentVal+=text[index]);

      if (index === (text.length - 1)) {
        return;
      }

      _typingTimeout = setTimeout(function() {
        typeChar(text, index+1);
      }, 20);
    };

    clearTimeout(_typingTimeout);
    _$messageTextarea.val('').focus();
    typeChar($(this).data('text'), 0);

    // GA tracking
    ga('send', 'event', 'Message', 'Macro', $(this).html());
  };

  init();

})(window.jQuery, window.Ekhanei, window.Conversation);