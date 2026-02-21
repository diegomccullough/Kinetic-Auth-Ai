/**
 * Controller: listens for ticketing events, starts auth, listens for auth completion, routes to confirmation.
 * No business logic; uses custom DOM events to communicate with /ticket and /auth layers.
 */
var screens = ['screen-event', 'screen-queue', 'screen-verification', 'screen-confirmation'];

function showScreen(id) {
  for (var i = 0; i < screens.length; i++) {
    var el = document.getElementById(screens[i]);
    if (el) el.classList.toggle('active', screens[i] === id);
  }
}

function init() {
  landing.init();
  queue.init();
  aiReasoning.init();
  authUI.init();

  // Ticketing: Buy -> show queue, start surge
  document.getElementById('btn-buy').onclick = function () {
    showScreen('screen-queue');
    surgeEngine.start();
  };

  // Ticketing event: queue ready -> show verification, start auth
  document.addEventListener('QUEUE_READY', function () {
    showScreen('screen-verification');
    authUI.start();
  });

  // Queue: Continue (skip wait) -> show verification, start auth
  document.getElementById('btn-queue-continue').onclick = function () {
    surgeEngine.cancel();
    showScreen('screen-verification');
    authUI.start();
  };

  // Auth: final Continue (from confirmation view) -> ticket confirmation screen
  document.getElementById('btn-auth-continue').onclick = function () {
    showScreen('screen-confirmation');
  };

  // Start over: cancel surge, reset auth, back to event
  document.getElementById('btn-start-over').onclick = function () {
    surgeEngine.cancel();
    authUI.reset();
    showScreen('screen-event');
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
