var moment = require('moment');

moment.updateLocale('en', {
  relativeTime : {
    future: "%s",
    past:   "%s",
    s:  "just now",
    m:  "1m ago",
    mm: "%dm ago",
    h:  "1h ago",
    hh: "%dh ago",
    d:  "1d ago",
    dd: "%dd ago",
    M:  "1m ago",
    MM: "%dm ago",
    y:  "1y ago",
    yy: "%dy ago"
  }
});
