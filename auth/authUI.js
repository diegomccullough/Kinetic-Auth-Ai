/**
 * Authentication Engine Layer
 * UI rendering and flow. Listens for MOTION_COMPLETE; shows behavioral/risk/confirmation panels.
 * Motion logic stays in motionAuth.js; risk values can be set by app or use defaults.
 */

/** When true: larger phone viz, amplified rotation, stronger glow, bigger text for live projection demo. */
var DEMO_MODE = true;

var authUI = (function () {
  var trafficBadgeEl, motionPanel, behavioralPanel, riskPanel, stepupPanel, confirmationPanel;
  var authSteps = [];
  var trustLevelEl, explanationEl, finalTrustEl;
  var riskSurgeEl, riskScoreEl, riskReasonEl, stepupRequiredEl;
  var phoneVizEl;
  var currentStep = 1;

  var TRAFFIC_LEVELS = ['Low', 'Medium', 'High'];
  var RISK_REASON = 'Elevated demand during ticket release. Step-up verification triggered to confirm human user.';
  var EXPLANATION = 'Motion profile demonstrates gradual directional changes consistent with human handling.';

  function get(id) { return document.getElementById(id); }

  function setProgressStep(stepIndex) {
    currentStep = stepIndex;
    for (var i = 0; i < authSteps.length; i++) {
      authSteps[i].classList.remove('active', 'done');
      if (i + 1 < stepIndex) authSteps[i].classList.add('done');
      else if (i + 1 === stepIndex) authSteps[i].classList.add('active');
    }
  }

  function setTrafficBadge(level) {
    if (trafficBadgeEl) trafficBadgeEl.textContent = 'Traffic Surge: ' + (level || 'High');
  }

  function showPanel(panel) {
    if (motionPanel) motionPanel.classList.add('hidden');
    if (behavioralPanel) behavioralPanel.classList.add('hidden');
    if (riskPanel) riskPanel.classList.add('hidden');
    if (stepupPanel) stepupPanel.classList.add('hidden');
    if (confirmationPanel) confirmationPanel.classList.add('hidden');
    if (panel) panel.classList.remove('hidden');
    if (phoneVizEl) {
      phoneVizEl.classList.remove('phone-stepup', 'phone-confirmation');
      if (panel === stepupPanel) phoneVizEl.classList.add('phone-stepup');
      if (panel === confirmationPanel) phoneVizEl.classList.add('phone-confirmation');
    }
  }

  function setPhoneVizState(state) {
    if (!phoneVizEl) return;
    phoneVizEl.classList.remove('visible', 'tilt-left-success', 'tilt-right-success', 'analysis', 'phone-stepup', 'phone-confirmation');
    if (state === 'visible') phoneVizEl.classList.add('visible');
    else if (state === 'tilt-left') phoneVizEl.classList.add('visible', 'tilt-left-success');
    else if (state === 'tilt-right') phoneVizEl.classList.add('visible', 'tilt-right-success');
    else if (state === 'analysis') phoneVizEl.classList.add('visible', 'analysis');
    else if (state === 'hidden') { /* leave visible off */ }
  }

  function renderBehavioral(analysis) {
    if (!analysis) return;
    var el;
    if (el = get('profile-duration')) el.textContent = (analysis.durationSec || 0).toFixed(1) + ' s';
    if (el = get('profile-sample-rate')) el.textContent = (analysis.sampleRate || 0).toFixed(1) + ' Hz';
    if (el = get('profile-stability')) el.textContent = (analysis.stabilityScore || 0) + '%';
    if (el = get('profile-jerk')) el.textContent = analysis.jerkResult || 'None';
    if (el = get('profile-confidence')) el.textContent = (analysis.humanConfidence || 0) + '%';
    var conf = analysis.humanConfidence || 0;
    var trust = conf >= 71 ? 'High' : conf >= 41 ? 'Moderate' : 'Low';
    if (trustLevelEl) trustLevelEl.textContent = 'Trust Level: ' + trust;
    if (explanationEl) explanationEl.textContent = EXPLANATION;
  }

  function renderRiskContext(surgeLevel, riskScore, stepUpRequired) {
    surgeLevel = surgeLevel || 'High';
    riskScore = riskScore != null ? riskScore : 72;
    stepUpRequired = stepUpRequired != null ? stepUpRequired : false;
    if (riskSurgeEl) riskSurgeEl.textContent = surgeLevel;
    if (riskScoreEl) riskScoreEl.textContent = riskScore + '%';
    if (riskReasonEl) riskReasonEl.textContent = RISK_REASON;
    if (stepupRequiredEl) stepupRequiredEl.textContent = stepUpRequired ? 'Yes' : 'No';
  }

  function showConfirmationView(trustScore) {
    if (finalTrustEl) finalTrustEl.textContent = (trustScore != null ? trustScore : 0) + '%';
    setProgressStep(5);
    if (phoneVizEl) phoneVizEl.classList.add('phone-confirmation');
    showPanel(confirmationPanel);
  }

  function onMotionPhase(e) {
    var p = e.detail && e.detail.phase;
    if (p === 'capturing') setPhoneVizState('visible');
    else if (p === 'left_done') setPhoneVizState('tilt-left');
    else if (p === 'analysis') {
      setPhoneVizState('tilt-right');
      setTimeout(function () { setPhoneVizState('analysis'); }, 350);
    }
  }

  function onMotionComplete(e) {
    var analysis = e.detail && e.detail.analysis;
    renderBehavioral(analysis);
    renderRiskContext('High', analysis ? 100 - (analysis.humanConfidence || 0) : 28, false);
    setProgressStep(3);
    showPanel(null);
    if (behavioralPanel) behavioralPanel.classList.remove('hidden');
    if (riskPanel) riskPanel.classList.remove('hidden');
  }

  function onProceedClick() {
    var score = motionAuth.isVerified() ? (get('profile-confidence') && get('profile-confidence').textContent) : 0;
    score = score ? parseInt(score.replace('%', ''), 10) : 0;
    showConfirmationView(score);
  }

  function start() {
    setTrafficBadge('High');
    setProgressStep(1);
    setPhoneVizState('hidden');
    var screenEl = get('screen-verification');
    if (screenEl) screenEl.classList.toggle('demo-mode', DEMO_MODE);
    showPanel(motionPanel);
    motionAuth.init({ demoMode: DEMO_MODE });
    voiceAuth.init();
  }

  function reset() {
    setProgressStep(1);
    setPhoneVizState('hidden');
    var screenEl = get('screen-verification');
    if (screenEl) screenEl.classList.remove('demo-mode');
    showPanel(motionPanel);
    motionAuth.reset();
    voiceAuth.reset();
  }

  function isVerified() {
    return motionAuth.isVerified();
  }

  function init() {
    trafficBadgeEl = get('auth-traffic-badge');
    motionPanel = get('auth-motion-panel');
    behavioralPanel = get('auth-behavioral-panel');
    riskPanel = get('auth-risk-panel');
    stepupPanel = get('auth-stepup-panel');
    confirmationPanel = get('auth-confirmation-panel');
    trustLevelEl = get('auth-trust-level');
    explanationEl = get('auth-explanation');
    finalTrustEl = get('auth-final-trust');
    riskSurgeEl = get('auth-risk-surge');
    riskScoreEl = get('auth-risk-score');
    riskReasonEl = get('auth-risk-reason');
    stepupRequiredEl = get('auth-stepup-required');

    for (var i = 1; i <= 5; i++) {
      var stepEl = get('auth-step-' + i);
      if (stepEl) authSteps.push(stepEl);
    }
    phoneVizEl = get('auth-phone-viz');

    document.addEventListener('MOTION_PHASE', onMotionPhase);
    document.addEventListener('MOTION_COMPLETE', onMotionComplete);
    if (get('btn-verification-proceed')) get('btn-verification-proceed').onclick = onProceedClick;
  }

  return {
    start: start,
    reset: reset,
    isVerified: isVerified,
    setTrafficBadge: setTrafficBadge,
    init: init
  };
})();
