/**
 * Authentication Engine Layer
 * UI rendering and flow. Listens for MOTION_COMPLETE; shows behavioral/risk/confirmation panels.
 * Motion logic stays in motionAuth.js; risk values can be set by app or use defaults.
 */

/** When true: larger phone viz, amplified rotation, stronger glow, bigger text for live projection demo. */
var DEMO_MODE = false;

var authUI = (function () {
  var trafficBadgeEl, motionPanel, behavioralPanel, riskPanel, stepupPanel, confirmationPanel;
  var authSteps = [];
  var trustLevelEl, explanationEl, finalTrustEl;
  var riskSurgeEl, riskScoreEl, riskReasonEl, stepupRequiredEl;
  var phoneVizEl;
  var screenEl, headerTitleEl, headerSubtitleEl;
  var instructionEl;
  var analysisTimer = null;
  var techDetailsEl = null;
  var flowState = 'idle';
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

  function showConfirmationView() {
    if (finalTrustEl) finalTrustEl.textContent = '';
    setProgressStep(5);
    setPhoneVizState('visible');
    if (phoneVizEl) phoneVizEl.classList.add('phone-confirmation');
    showPanel(confirmationPanel);
  }

  function setHeaderCopy() {
    if (headerTitleEl) headerTitleEl.textContent = 'Verify your access';
    if (headerSubtitleEl) headerSubtitleEl.textContent = '';
  }

  function setPrimaryInstruction(text) {
    if (!instructionEl) instructionEl = get('instruction');
    if (instructionEl) instructionEl.textContent = text;
  }

  function clearTimers() {
    if (analysisTimer) {
      clearTimeout(analysisTimer);
      analysisTimer = null;
    }
  }

  function ensureTechnicalDetailsPanel() {
    if (techDetailsEl || !screenEl) return;

    // Create disclosure container (hidden by default via <details>).
    var details = document.createElement('details');
    details.className = 'auth-tech-details';
    details.id = 'auth-tech-details';
    var summary = document.createElement('summary');
    summary.textContent = 'Technical Details';
    var body = document.createElement('div');
    body.className = 'auth-tech-details-body';
    details.appendChild(summary);
    details.appendChild(body);

    // Move existing metrics panels into disclosure.
    if (behavioralPanel) {
      behavioralPanel.classList.remove('hidden');
      body.appendChild(behavioralPanel);
    }
    if (riskPanel) {
      riskPanel.classList.remove('hidden');
      body.appendChild(riskPanel);
    }

    // Insert above the transparency footer.
    var footer = screenEl.querySelector('.auth-transparency');
    if (footer && footer.parentNode) footer.parentNode.insertBefore(details, footer);
    else screenEl.appendChild(details);

    techDetailsEl = details;
  }

  function configureStepUpCopy() {
    if (!stepupPanel) return;
    var title = stepupPanel.querySelector('.auth-panel-title');
    if (title) title.textContent = 'Additional verification required';
    var instruction = stepupPanel.querySelector('.auth-stepup-instruction');
    if (instruction) instruction.textContent = '';
    var phrase = get('auth-stepup-phrase');
    if (phrase) phrase.textContent = '';
    var status = get('auth-stepup-status');
    if (status) status.textContent = '';
  }

  function configureConfirmationCopy() {
    if (!confirmationPanel) return;
    var title = confirmationPanel.querySelector('.auth-verified-title');
    if (title) title.textContent = 'You\u2019re verified';
    var subtext = confirmationPanel.querySelector('.auth-verified-subtext');
    if (subtext) subtext.textContent = '';
    if (!confirmationPanel.querySelector('.auth-checkmark')) {
      var mark = document.createElement('div');
      mark.className = 'auth-checkmark';
      confirmationPanel.insertBefore(mark, confirmationPanel.firstChild);
    }
  }

  function onMotionPhase(e) {
    var p = e.detail && e.detail.phase;
    if (p === 'capturing') {
      flowState = 'motion_left';
      setProgressStep(1);
      setPhoneVizState('visible');
      setPrimaryInstruction('Tilt your phone left');
      if (screenEl) screenEl.classList.remove('is-analysis');
    } else if (p === 'left_done') {
      flowState = 'motion_right';
      setProgressStep(1);
      setPhoneVizState('tilt-left');
      setPrimaryInstruction('Tilt your phone right');
      if (screenEl) screenEl.classList.remove('is-analysis');
    } else if (p === 'analysis') {
      flowState = 'analysis';
      setProgressStep(2);
      setPhoneVizState('analysis');
      setPrimaryInstruction('Verifying motion\u2026');
      if (screenEl) screenEl.classList.add('is-analysis');
    }
  }

  function onMotionComplete(e) {
    var analysis = e.detail && e.detail.analysis;
    clearTimers();

    ensureTechnicalDetailsPanel();
    renderBehavioral(analysis);
    var riskScore = analysis ? 100 - (analysis.humanConfidence || 0) : 28;
    var stepUpRequired = false;
    renderRiskContext('High', riskScore, stepUpRequired);

    // Keep the main UI calm: show a controlled analysis interstitial, then advance automatically.
    flowState = 'analysis';
    setProgressStep(2);
    showPanel(motionPanel);
    setPhoneVizState('analysis');
    setPrimaryInstruction('Verifying motion\u2026');
    if (screenEl) screenEl.classList.add('is-analysis');

    analysisTimer = setTimeout(function () {
      clearTimers();
      if (stepUpRequired) {
        flowState = 'stepup';
        setProgressStep(4);
        configureStepUpCopy();
        showPanel(stepupPanel);
        setPhoneVizState('visible');
        if (screenEl) screenEl.classList.remove('is-analysis');
      } else {
        flowState = 'confirmed';
        configureConfirmationCopy();
        if (screenEl) screenEl.classList.remove('is-analysis');
        showConfirmationView();
      }
    }, 1500);
  }

  function onProceedClick() { /* deprecated in minimal flow */ }

  function start() {
    clearTimers();
    setTrafficBadge('High');
    setProgressStep(1);
    setPhoneVizState('hidden');
    if (screenEl) {
      screenEl.classList.toggle('demo-mode', DEMO_MODE);
      screenEl.classList.remove('is-analysis');
    }
    setHeaderCopy();
    configureStepUpCopy();
    configureConfirmationCopy();
    ensureTechnicalDetailsPanel();
    showPanel(motionPanel);
    flowState = 'motion_left';
    setPrimaryInstruction('Tilt your phone left');
    motionAuth.init({ demoMode: DEMO_MODE });
    voiceAuth.init();
  }

  function reset() {
    clearTimers();
    setProgressStep(1);
    setPhoneVizState('hidden');
    if (screenEl) {
      screenEl.classList.remove('demo-mode');
      screenEl.classList.remove('is-analysis');
    }
    showPanel(motionPanel);
    flowState = 'idle';
    motionAuth.reset();
    voiceAuth.reset();
  }

  function isVerified() {
    return motionAuth.isVerified();
  }

  function init() {
    screenEl = get('screen-verification');
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
    headerTitleEl = screenEl ? screenEl.querySelector('.auth-product-title') : null;
    headerSubtitleEl = screenEl ? screenEl.querySelector('.auth-product-subtitle') : null;
    instructionEl = get('instruction');

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
