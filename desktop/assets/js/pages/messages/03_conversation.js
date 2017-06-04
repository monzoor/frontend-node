(function($, Strophe) {

  /**
   * Conversation
   * Class representing a conversation between two users.
   */
  window.Conversation = function(params) {

    // Required parameters
    var _params = {
      httpBind: null,
      roomId: null,
      userId: null,
      sid: null,
      rid: null,
      device: null
    };
    $.extend(_params, params);

    var _conn = null,
        _roomUsername = null,
        _attached = false,
        _listeners = {},
        _pingInterval = null,
        _pingTime = 15;

    var init = function() {
      _roomUsername = params.userId+'_'+params.device;

      // Connect to XMPP server
      _conn = new Strophe.Connection(params.httpBind);

      // Start pinging
      startPinging();

      // _conn.rawInput = rawInput;
      // _conn.rawOutput = rawOutput;

      // Attach to the BOSH session
      var nextRID = parseInt(params.rid, 10) + 1;
      _conn.attach(params.userId, params.sid, nextRID, connectHandler);
    };

    var startPinging = function() {
      if (_conn) {
        stopPinging();
      }
      // Start pinging
      _pingInterval = setInterval(function() {
        // Ping
        _conn.sendIQ($iq({to: _conn.service, from: _conn.jid, type: "get"}).c('ping', {xmlns: "urn:xmpp:ping"}));
      }, _pingTime*1000);
    };

    var stopPinging = function() {
      if (_pingInterval) {
        clearInterval(_pingInterval);
        _pingInterval = null;
      }
    };

    var rawInput = function(data) {
      console.log('RECV', JSON.stringify(data, null, 2));
    };

    var rawOutput = function(data) {
      console.log('SENT', JSON.stringify(data, null, 2));
    };

    var connectHandler = function(status) {
      switch(status) {
        case Strophe.Status.CONNECTED:
        case Strophe.Status.ATTACHED:
          onAttach();
          break;
        case Strophe.Status.DISCONNECTED:
          onDis_connect();
          break;
      }
    };

    var onAttach = function() {
      _attached = true;

      // Send initial presence
      _conn.send(
        new Strophe.Builder('presence')
        .cnode(Strophe.xmlElement('priority', '1'))
      );

      // Enter the room
      _conn.send(
        new Strophe.Builder('presence', {
          to: params.roomId + '/'+_roomUsername
        })
      );

      // Listen for messages
      _conn.addHandler(function(message) {

        var body = message.getElementsByTagName('body');
        var delay = message.getElementsByTagName('delay');

        if (body.length > 0) {
          // console.log("Message stanza received", message);
          triggerListener('message', {
            // Is this message from the current user
            own: (message.getAttribute('from').indexOf('/'+params.userId) !== -1),

            content: body[0].textContent,
            time: (delay.length) ? delay[0].getAttribute('stamp') : false
          });
          stopPinging();
          startPinging();
        }

        return true;

      }, null, 'message');
    };

    var triggerListener = function(eventName, param) {
      if (_listeners.hasOwnProperty(eventName)) {
        _listeners[eventName](param);
      }
    };

    var onDisconnect = function() {
      _attached = false;
    };

    init();

    return {
      sendMessage: function(message) {
        if (!_attached) {
          return;
        }

        var msg = new Strophe.Builder('message', {
          from: params.userId,
          to: params.roomId,
          type: 'groupchat'
        })
        .cnode(Strophe.xmlElement('body', message));
        stopPinging();
        _conn.send(msg);
        startPinging();
      },

      // Attach event
      on: function(eventName, listener) {
        _listeners[eventName] = listener;
      },

      disconnect: function() {
        _conn.flush();
        _conn.disconnect();
      }
    };
  };

})(window.jQuery, window.Strophe);
