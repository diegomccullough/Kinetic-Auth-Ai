/**
 * Motion-based verification: tilt left (gamma < -20), then right (gamma > 20).
 * Records motion samples and analyzes profile (duration, smoothness, stability, human confidence).
 */
var motionAuth = (function () {
  var instructionEl;
  var gammaEl;
  var permissionPrompt;
  var contentEl;
  var fallbackEl;
  var proceedBtn;
  var statusEl;
  var step1El, step2El, step3El;
  var profileEl;
  var profileDurationEl, profileStabilityEl, profileConfidenceEl;
  var leftDone = false;
  var rightDone = false;
  var onVerified = function () {};
  var listenerBound = false;
  var samples = [];
  var lastSampleTime = 0;
  var SAMPLE_INTERVAL_MS = 50;
  var JUMP_THRESHOLD = 22;

  var STATUS = {
    ANALYZING: 'Analyzing motion…',
    HUMAN_DETECTED: 'Human motion detected',
    STABILITY_PASSED: 'Stability check passed',
    COMPLETE: 'Verification complete'
  };

  function showFallback() {
    contentEl.classList.add('hidden');
    fallbackEl.classList.remove('hidden');
  }

  function setStatus(msg, isComplete) {
    statusEl.textContent = msg;
    statusEl.classList.toggle('complete', !!isComplete);
  }

  function updateSteps() {
    step1El.classList.remove('active', 'done');
    step2El.classList.remove('active', 'done');
    step3El.classList.remove('active', 'done');
    if (leftDone && rightDone) {
      step1El.classList.add('done');
      step2El.classList.add('done');
      step3El.classList.add('done');
      contentEl.classList.add('verification-complete');
    } else if (leftDone) {
      step1El.classList.add('done');
      step2El.classList.add('active');
      step3El.classList.remove('active');
    } else {
      step1El.classList.add('active');
    }
  }

  function recordSample(gamma, beta) {
    var now = performance.now();
    if (now - lastSampleTime < SAMPLE_INTERVAL_MS) return;
    lastSampleTime = now;
    samples.push({ gamma: gamma, beta: beta != null ? beta : 0, timestamp: now });
  }

  function analyzeProfile() {
    if (samples.length < 2) {
      return { durationSec: 0, stabilityScore: 0, humanConfidence: 0 };
    }
    var first = samples[0];
    var last = samples[samples.length - 1];
    var durationMs = last.timestamp - first.timestamp;
    var durationSec = durationMs / 1000;

    var sumDelta = 0;
    var jumpCount = 0;
    for (var i = 1; i < samples.length; i++) {
      var d = Math.abs(samples[i].gamma - samples[i - 1].gamma);
      sumDelta += d;
      if (d > JUMP_THRESHOLD) jumpCount++;
    }
    var avgDelta = sumDelta / (samples.length - 1);

    var smoothnessScore = Math.max(0, 100 - avgDelta * 4);
    var jumpPenalty = Math.min(100, jumpCount * 18);
    var stabilityScore = Math.max(0, Math.min(100, Math.round(smoothnessScore - jumpPenalty)));

    var durationBonus = 0;
    if (durationSec >= 0.8 && durationSec <= 20) durationBonus = 10;
    else if (durationSec < 0.3) durationBonus = -30;
    var humanConfidence = Math.max(0, Math.min(100, Math.round(stabilityScore + durationBonus)));

    return {
      durationSec: durationSec,
      stabilityScore: stabilityScore,
      humanConfidence: humanConfidence
    };
  }

  function showProfileResults(result) {
    if (!profileEl) return;
    if (profileDurationEl) profileDurationEl.textContent = result.durationSec.toFixed(1) + ' s';
    if (profileStabilityEl) profileStabilityEl.textContent = result.stabilityScore + '%';
    if (profileConfidenceEl) profileConfidenceEl.textContent = result.humanConfidence + '%';
    profileEl.classList.remove('hidden');
  }

  function hideProfile() {
    if (!profileEl) return;
    profileEl.classList.add('hidden');
    if (profileDurationEl) profileDurationEl.textContent = '—';
    if (profileStabilityEl) profileStabilityEl.textContent = '—';
    if (profileConfidenceEl) profileConfidenceEl.textContent = '—';
  }

  function updateInstruction() {
    if (leftDone && rightDone) {
      instructionEl.textContent = 'Verification successful';
      setStatus(STATUS.STABILITY_PASSED, false);
      updateSteps();
      proceedBtn.disabled = false;
      proceedBtn.textContent = 'Proceed';
      onVerified();

      var result = analyzeProfile();
      showProfileResults(result);

      setTimeout(function () {
        setStatus(STATUS.COMPLETE, true);
      }, 280);
    } else if (leftDone) {
      instructionEl.textContent = 'Tilt your phone RIGHT';
      setStatus(STATUS.HUMAN_DETECTED, false);
      updateSteps();
    } else {
      instructionEl.textContent = 'Tilt your phone LEFT';
      setStatus(STATUS.ANALYZING, false);
      updateSteps();
    }
  }

  function onOrientation(e) {
    var gamma = e.gamma;
    var beta = e.beta;
    if (gammaEl) gammaEl.textContent = gamma != null ? Math.round(gamma) : '—';
    if (gamma != null) recordSample(gamma, beta);
    if (gamma == null) return;
    if (!leftDone && gamma < -20) {
      leftDone = true;
      setStatus(STATUS.HUMAN_DETECTED, false);
      updateSteps();
    }
    if (!rightDone && gamma > 20) {
      rightDone = true;
      updateSteps();
    }
    updateInstruction();
  }

  function startListening() {
    permissionPrompt.classList.add('hidden');
    samples = [];
    lastSampleTime = 0;
    if (!listenerBound) {
      window.addEventListener('deviceorientation', onOrientation);
      listenerBound = true;
    }
    setStatus(STATUS.ANALYZING, false);
    updateSteps();
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
    statusEl = document.getElementById('verification-status');
    step1El = document.getElementById('step-1');
    step2El = document.getElementById('step-2');
    step3El = document.getElementById('step-3');
    profileEl = document.getElementById('motion-profile');
    profileDurationEl = document.getElementById('profile-duration');
    profileStabilityEl = document.getElementById('profile-stability');
    profileConfidenceEl = document.getElementById('profile-confidence');

    leftDone = false;
    rightDone = false;
    samples = [];
    lastSampleTime = 0;
    contentEl.classList.remove('verification-complete');
    proceedBtn.disabled = true;
    proceedBtn.textContent = 'Proceed';
    hideProfile();
    setStatus(STATUS.ANALYZING, false);
    updateSteps();
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
    samples = [];
    lastSampleTime = 0;
    contentEl.classList.remove('verification-complete');
    proceedBtn.disabled = true;
    proceedBtn.textContent = 'Proceed';
    hideProfile();
    setStatus(STATUS.ANALYZING, false);
    updateSteps();
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
