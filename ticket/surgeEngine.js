/**
 * Ticketing Environment Layer
 * Simulated surge/queue. Dispatches QUEUE_READY when wait completes.
 * Communicate via custom DOM events; no backend.
 */
var surgeEngine = (function () {
  var DELAY_MS = 1800;
  var timeoutId = null;

  function start() {
    if (timeoutId) clearTimeout(timeoutId);
    document.dispatchEvent(new CustomEvent('QUEUE_STARTED'));
    timeoutId = setTimeout(function () {
      timeoutId = null;
      document.dispatchEvent(new CustomEvent('QUEUE_READY'));
    }, DELAY_MS);
  }

  function cancel() {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  }

  return { start: start, cancel: cancel };
})();
