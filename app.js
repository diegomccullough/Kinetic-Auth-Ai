/**
 * Ticket purchase flow: navigation and state.
 * Screens: Event -> Queue -> Verification -> Confirmation
 */
var screens = ['screen-event', 'screen-queue', 'screen-verification', 'screen-confirmation'];

function showScreen(id) {
  for (var i = 0; i < screens.length; i++) {
    var el = document.getElementById(screens[i]);
    el.classList.toggle('active', screens[i] === id);
  }
}

function init() {
  motionAuth.init({
    onVerified: function () { /* proceed button enabled by motionAuth */ }
  });

  document.getElementById('btn-buy').onclick = function () {
    showScreen('screen-queue');
  };

  document.getElementById('btn-queue-continue').onclick = function () {
    showScreen('screen-verification');
  };

  document.getElementById('btn-verification-continue').onclick = function () {
    if (motionAuth.isVerified()) {
      showScreen('screen-confirmation');
    }
  };

  document.getElementById('btn-start-over').onclick = function () {
    motionAuth.reset();
    showScreen('screen-event');
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
