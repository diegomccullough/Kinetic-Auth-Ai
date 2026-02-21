/**
 * Authentication Engine Layer
 * Tilt + motion verification. Dispatches MOTION_COMPLETE when verification succeeds.
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
  var progressFillEl;
  var progressTrackEl;
  var feedbackEl;
  var graphCanvas;
  var leftDone = false;
  var rightDone = false;
  var onVerified = function () {};
  var listenerBound = false;
  var samples = [];
  var lastSampleTime = 0;
  var SAMPLE_INTERVAL_MS = 50;
  var JUMP_THRESHOLD = 22;
  var statusCycleTimer = null;
  var STATUS_CYCLE_MS = 2200;
  var GRAPH_MAX_POINTS = 80;
  var GAMMA_RANGE = 90;

  var STATUS_CYCLE = [
    'Capturing motion data…',
    'Analyzing stability…',
    'Evaluating behavioral profile…',
    'Human confidence score generated.'
  ];

  function showFallback() {
    contentEl.classList.add('hidden');
    fallbackEl.classList.remove('hidden');
  }

  function setStatus(msg, isComplete) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.classList.toggle('complete', !!isComplete);
  }

  function updateProgress(pct) {
    if (progressFillEl) progressFillEl.style.width = pct + '%';
    if (progressTrackEl) progressTrackEl.setAttribute('aria-valuenow', pct);
  }

  function setFeedbackActive(active) {
    if (feedbackEl) feedbackEl.classList.toggle('active', !!active);
  }

  function drawGraph() {
    if (!graphCanvas || !samples.length) return;
    var ctx = graphCanvas.getContext('2d');
    var w = graphCanvas.width;
    var h = graphCanvas.height;
    ctx.clearRect(0, 0, w, h);
    var pts = samples.length > GRAPH_MAX_POINTS ? samples.slice(-GRAPH_MAX_POINTS) : samples;
    if (pts.length < 2) return;
    ctx.strokeStyle = 'rgba(88, 166, 255, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (var i = 0; i < pts.length; i++) {
      var x = (i / (pts.length - 1)) * w;
      var g = Math.max(-GAMMA_RANGE, Math.min(GAMMA_RANGE, pts[i].gamma));
      var y = h / 2 - (g / GAMMA_RANGE) * (h / 2 - 4);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function stopStatusCycle() {
    if (statusCycleTimer) {
      clearInterval(statusCycleTimer);
      statusCycleTimer = null;
    }
  }

  function startStatusCycle() {
    stopStatusCycle();
    var idx = 0;
    setStatus(STATUS_CYCLE[0], false);
    statusCycleTimer = setInterval(function () {
      if (leftDone && rightDone) return;
      idx = (idx + 1) % 3;
      setStatus(STATUS_CYCLE[idx], false);
    }, STATUS_CYCLE_MS);
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
      stopStatusCycle();
      updateProgress(100);
      setFeedbackActive(false);
      instructionEl.textContent = 'Verification successful';
      setStatus(STATUS_CYCLE[3], true);
      updateSteps();
      proceedBtn.disabled = false;
      proceedBtn.textContent = 'Proceed';
      onVerified();
      document.dispatchEvent(new CustomEvent('MOTION_COMPLETE', { detail: { verified: true } }));

      var result = analyzeProfile();
      showProfileResults(result);
    } else if (leftDone) {
      updateProgress(33);
      instructionEl.textContent = 'Tilt your phone RIGHT';
      updateSteps();
    } else {
      updateProgress(0);
      instructionEl.textContent = 'Tilt your phone LEFT';
      updateSteps();
    }
  }

  function onOrientation(e) {
    var gamma = e.gamma;
    var beta = e.beta;
    if (gammaEl) gammaEl.textContent = gamma != null ? Math.round(gamma) : '—';
    if (gamma != null) {
      setFeedbackActive(true);
      recordSample(gamma, beta);
      drawGraph();
    }
    if (gamma == null) return;
    if (!leftDone && gamma < -20) {
      leftDone = true;
      setStatus(STATUS_CYCLE[1], false);
      updateSteps();
    }
    if (!rightDone && gamma > 20) {
      rightDone = true;
      updateProgress(66);
      updateSteps();
    }
    updateInstruction();
  }

  function startListening() {
    permissionPrompt.classList.add('hidden');
    samples = [];
    lastSampleTime = 0;
    updateProgress(0);
    setFeedbackActive(false);
    drawGraph();
    startStatusCycle();
    if (!listenerBound) {
      window.addEventListener('deviceorientation', onOrientation);
      listenerBound = true;
    }
    setStatus(STATUS_CYCLE[0], false);
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
    progressFillEl = document.getElementById('verification-progress-fill');
    progressTrackEl = progressFillEl ? progressFillEl.parentElement : null;
    feedbackEl = document.getElementById('motion-feedback');
    graphCanvas = document.getElementById('motion-graph');

    leftDone = false;
    rightDone = false;
    samples = [];
    lastSampleTime = 0;
    stopStatusCycle();
    contentEl.classList.remove('verification-complete');
    proceedBtn.disabled = true;
    proceedBtn.textContent = 'Proceed';
    updateProgress(0);
    setFeedbackActive(false);
    hideProfile();
    drawGraph();
    setStatus(STATUS_CYCLE[0], false);
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
    stopStatusCycle();
    contentEl.classList.remove('verification-complete');
    proceedBtn.disabled = true;
    proceedBtn.textContent = 'Proceed';
    updateProgress(0);
    setFeedbackActive(false);
    hideProfile();
    drawGraph();
    setStatus(STATUS_CYCLE[0], false);
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
