/**
 * Ticketing Environment Layer
 * Event/landing page. Renders copy for the event card only.
 */
var landing = (function () {
  var DATA = {
    heading: 'Live Event',
    subtitle: 'Limited availability',
    title: 'Summer Night Concert 2025',
    meta: 'Sat, Aug 16 · 8:00 PM · Riverside Arena'
  };

  function init() {
    var el;
    if (el = document.getElementById('event-heading')) el.textContent = DATA.heading;
    if (el = document.getElementById('event-subtitle')) el.textContent = DATA.subtitle;
    if (el = document.getElementById('event-title')) el.textContent = DATA.title;
    if (el = document.getElementById('event-meta')) el.textContent = DATA.meta;
  }

  return { init: init };
})();
