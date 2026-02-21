/**
 * Ticketing Environment Layer
 * Queue and confirmation screens. Renders copy only.
 */
var queue = (function () {
  var QUEUE = {
    heading: 'Please wait',
    line1: 'High demand detected. You are in the queue.',
    line2: 'Your spot is reserved. This usually takes a moment.'
  };
  var CONFIRMATION = {
    heading: 'Tickets Reserved',
    line1: 'Thank you. Your order has been received.',
    line2: 'Confirmation #8294-1A. A copy has been sent to your email. Present this confirmation at the venue.'
  };

  function init() {
    var el;
    if (el = document.getElementById('queue-heading')) el.textContent = QUEUE.heading;
    if (el = document.getElementById('queue-line1')) el.textContent = QUEUE.line1;
    if (el = document.getElementById('queue-line2')) el.textContent = QUEUE.line2;
    if (el = document.getElementById('confirmation-heading')) el.textContent = CONFIRMATION.heading;
    if (el = document.getElementById('confirmation-line1')) el.textContent = CONFIRMATION.line1;
    if (el = document.getElementById('confirmation-line2')) el.textContent = CONFIRMATION.line2;
  }

  return { init: init };
})();
