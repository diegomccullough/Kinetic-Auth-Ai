/**
 * Motion-based verification: tilt left (gamma < -20), then right (gamma > 20).
 * Handles device orientation, iOS permission, and UI updates.
 */
var motionAuth = (function () {
  var instructionEl;
  var gammaEl;
  var permissionPrompt;
  var contentEl;
  var fallbackEl;
  var proceedBtn;
  var leftDone = false;
  var rightDone = false;
  var onVerified = function () {};
  var listenerBound = false;

  function showFallback() {
    contentEl.classList.add('hidden');
    fallbackEl.classList.remove('hidden');
  }

  function updateInstruction() {
    if (leftDone && rightDone) {
      instructionEl.textContent = 'Verification Successful';
      proceedBtn.disabled = false;
      proceedBtn.textContent = 'Proceed';
      onVerified();
    } else if (leftDone) {
      instructionEl.textContent = 'Tilt your phone RIGHT';
    } else {
      instructionEl.textContent = 'Tilt your phone LEFT';
    }
  }

  function onOrientation(e) {
    var gamma = e.gamma;
    gammaEl.textContent = gamma != null ? Math.round(gamma) : '—';
    if (gamma == null) return;
    if (!leftDone && gamma < -20) leftDone = true;
    if (!rightDone && gamma > 20) rightDone = true;
    updateInstruction();
  }

  function startListening() {
    permissionPrompt.classList.add('hidden');
    if (!listenerBound) {
      window.addEventListener('deviceorientation', onOrientation);
      listenerBound = true;
    }
    onOrientation({ gamma: null });
  }

  function init(options) {
    options = options || {};
    onVerified = options.onVerified || function () {};

    instructionEl = document.getElementById('instruction');
    gammaEl = document.getElementById('gamma');
    permissionPrompt = document.getElementById('permission-prompt');
    contentEl = document.getElementById('verification-content');
    fallbackEl = document.getElementById('verification-fallback');
    proceedBtn = document.getElementById('btn-verification-continue');

    leftDone = false;
    rightDone = false;
    proceedBtn.disabled = true;
    proceedBtn.textContent = 'Complete verification to continue';
    updateInstruction();

    if (!window.DeviceOrientationEvent) {
      showFallback();
      return;
    }
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      permissionPrompt.classList.remove('hidden');
      document.getElementById('permission-btn').onclick = function () {
        DeviceOrientationEvent.requestPermission()
          .then(function (result) {
            if (result === 'granted') startListening();
            else showFallback();
          })
          .catch(showFallback);
      };
    } else {
      startListening();
    }
  }

  function reset() {
    leftDone = false;
    rightDone = false;
    proceedBtn.disabled = true;
    proceedBtn.textContent = 'Complete verification to continue';
    updateInstruction();
  }

  function isVerified() {
    return leftDone && rightDone;
  }

  return {
    init: init,
    reset: reset,
    isVerified: isVerified
  };
})();
