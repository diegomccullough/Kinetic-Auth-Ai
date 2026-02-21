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
  var stage1InstructionEl = null;
  var stageDotsEl = null;
  var stage1CheckEl = null;
  var phoneMockupEl = null;
  var redirectTimer = null;
  var arcTimer = null;
  var techDetailsEl = null;
  var currentStep = 1;
  var stage = 1; // 1 = demo challenge, 2 = premium verification
  var demoStep = 1; // 1 left, 2 right, 3 hold steady
  var steadySince = 0;
  var pendingMotionComplete = null;
  var stage2Shown = false;
  var stage1Completed = false;
  var uiGamma = 0;
  var uiBeta = 0;

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

  function clearTimers() {
    if (redirectTimer) {
      clearTimeout(redirectTimer);
      redirectTimer = null;
    }
    if (arcTimer) {
      clearInterval(arcTimer);
      arcTimer = null;
    }
  }

  function resetDemoState() {
    demoStep = 1;
    steadySince = 0;
    pendingMotionComplete = null;
    stage2Shown = false;
    stage1Completed = false;
    uiGamma = 0;
    uiBeta = 0;
    if (screenEl) {
      screenEl.style.removeProperty('--ui-phone-rotate-x');
      screenEl.style.removeProperty('--ui-phone-rotate-y');
      screenEl.style.removeProperty('--arc-progress');
    }
    if (stage1CheckEl) stage1CheckEl.classList.remove('show');
    if (stageDotsEl) {
      stageDotsEl.dataset.active = '1';
      stageDotsEl.classList.remove('complete');
    }
    if (screenEl) screenEl.classList.remove('auth-stage1-complete');
  }

  function ensureTechnicalDetailsPanel() {
    if (techDetailsEl || !screenEl) return;

    // Create disclosure container (hidden by default via <details>).
    var details = document.createElement('details');
    details.className = 'auth-tech-details';
    details.id = 'auth-tech-details';
    var summary = document.createElement('summary');
    summary.textContent = 'View technical summary';
    var body = document.createElement('div');
    body.className = 'auth-tech-details-body';
    details.appendChild(summary);
    details.appendChild(body);
    details.hidden = true;

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
    if (title) title.textContent = 'Verified. Access secured.';
    var subtext = confirmationPanel.querySelector('.auth-verified-subtext');
    if (subtext) subtext.textContent = '';
    if (!confirmationPanel.querySelector('.auth-checkmark')) {
      var mark = document.createElement('div');
      mark.className = 'auth-checkmark';
      confirmationPanel.insertBefore(mark, confirmationPanel.firstChild);
    }
  }

  function setHeadline(text) {
    if (headerTitleEl) headerTitleEl.textContent = text;
  }

  function setSubheadline(text) {
    if (headerSubtitleEl) headerSubtitleEl.textContent = text || '';
  }

  function ensurePremiumMotionElements() {
    if (!motionPanel || !screenEl) return;

    // Hide motionAuth's instruction element; premium copy uses header.
    if (!instructionEl) instructionEl = get('instruction');
    if (instructionEl) instructionEl.classList.add('auth-visually-hidden');

    // Place the existing progress line under the headline.
    var progress = motionPanel.querySelector('.verification-progress');
    var header = screenEl.querySelector('.auth-header');
    if (progress && header && progress.parentNode !== header) {
      header.appendChild(progress);
    }

    // Add radial light + progress arc (only once).
    if (!motionPanel.querySelector('.auth-radial')) {
      var radial = document.createElement('div');
      radial.className = 'auth-radial';
      radial.setAttribute('aria-hidden', 'true');
      motionPanel.insertBefore(radial, motionPanel.firstChild);
    }
    if (!motionPanel.querySelector('.auth-arc')) {
      var arc = document.createElement('div');
      arc.className = 'auth-arc';
      arc.setAttribute('aria-hidden', 'true');
      arc.innerHTML =
        '<svg viewBox="0 0 120 120" focusable="false" aria-hidden="true">' +
          '<circle class="auth-arc-track" cx="60" cy="60" r="46"></circle>' +
          '<circle class="auth-arc-fill" cx="60" cy="60" r="46"></circle>' +
        '</svg>';
      motionPanel.insertBefore(arc, motionPanel.firstChild);
    }

    // Stage dots (3 steps) at top.
    if (!stageDotsEl) {
      stageDotsEl = document.createElement('div');
      stageDotsEl.className = 'auth-stage-dots';
      stageDotsEl.dataset.active = '1';
      stageDotsEl.innerHTML = '<span></span><span></span><span></span>';
      screenEl.appendChild(stageDotsEl);
    }

    // Stage 1 instruction line (separate from subheadline).
    if (!stage1InstructionEl && screenEl.querySelector('.auth-header')) {
      stage1InstructionEl = document.createElement('div');
      stage1InstructionEl.className = 'auth-stage1-instruction';
      screenEl.querySelector('.auth-header').appendChild(stage1InstructionEl);
    }

    // Stage 1 checkmark overlay.
    if (!stage1CheckEl) {
      stage1CheckEl = document.createElement('div');
      stage1CheckEl.className = 'auth-stage1-check';
      stage1CheckEl.setAttribute('aria-hidden', 'true');
      stage1CheckEl.innerHTML = '<div class="auth-stage1-checkmark"></div>';
      motionPanel.appendChild(stage1CheckEl);
    }
  }

  function startArcSync() {
    if (arcTimer || !screenEl) return;
    var fill = get('verification-progress-fill');
    var root = screenEl;
    arcTimer = setInterval(function () {
      if (!fill) fill = get('verification-progress-fill');
      var w = fill && fill.style ? fill.style.width : '';
      var pct = 0;
      if (w && w.indexOf('%') !== -1) pct = Math.max(0, Math.min(100, parseFloat(w)));
      root.style.setProperty('--arc-progress', (pct / 100).toFixed(3));
    }, 60);
  }

  function bindTiltLight() {
    if (!screenEl || bindTiltLight._bound) return;
    bindTiltLight._bound = true;
    window.addEventListener('deviceorientation', function (e) {
      // UI-only: subtle light shift, not used for verification decisions.
      var gamma = e && e.gamma != null ? e.gamma : 0;
      var beta = e && e.beta != null ? e.beta : 0;
      var gx = Math.max(-25, Math.min(25, gamma));
      var by = Math.max(-25, Math.min(25, beta));
      // Map degrees -> px (small, cinematic).
      screenEl.style.setProperty('--tilt-x', (gx * 0.8).toFixed(1) + 'px');
      screenEl.style.setProperty('--tilt-y', (by * -0.5).toFixed(1) + 'px');
    }, { passive: true });
  }

  function bindDemoOrientation() {
    if (!screenEl || bindDemoOrientation._bound) return;
    bindDemoOrientation._bound = true;
    window.addEventListener('deviceorientation', function (e) {
      if (stage !== 1 || stage1Completed) return;
      if (!e) return;
      if (e.gamma == null || e.beta == null) return;

      // Low-pass filter for elegant smoothing.
      var g = e.gamma;
      var b = e.beta;
      uiGamma = uiGamma * 0.86 + g * 0.14;
      uiBeta = uiBeta * 0.86 + b * 0.14;

      // Exaggerate motion (demo) without going cartoonish.
      var exaggerate = 1.65;
      var cap = 38;
      var rx = Math.max(-cap, Math.min(cap, uiBeta * exaggerate));
      var ry = Math.max(-cap, Math.min(cap, uiGamma * exaggerate));
      screenEl.style.setProperty('--ui-phone-rotate-x', rx.toFixed(2) + 'deg');
      screenEl.style.setProperty('--ui-phone-rotate-y', ry.toFixed(2) + 'deg');

      // Demo step logic (independent gate; does not alter verification logic).
      if (demoStep === 1) {
        if (uiGamma < -20) {
          demoStep = 2;
          if (stageDotsEl) stageDotsEl.dataset.active = '2';
          if (stage1InstructionEl) stage1InstructionEl.textContent = 'Tilt right';
        }
      } else if (demoStep === 2) {
        if (uiGamma > 20) {
          demoStep = 3;
          steadySince = 0;
          if (stageDotsEl) stageDotsEl.dataset.active = '3';
          if (stage1InstructionEl) stage1InstructionEl.textContent = 'Hold upright and steady';
        }
      } else if (demoStep === 3) {
        var now = performance.now();
        var steady = Math.abs(uiGamma) < 8 && Math.abs(uiBeta) < 8;
        if (!steady) {
          steadySince = 0;
        } else if (!steadySince) {
          steadySince = now;
        } else if (now - steadySince >= 1500) {
          completeStage1();
        }
      }
    }, { passive: true });
  }

  function completeStage1() {
    if (stage !== 1 || stage1Completed) return;
    stage1Completed = true;
    if (screenEl) screenEl.classList.add('auth-stage1-complete');
    if (stageDotsEl) stageDotsEl.classList.add('complete');
    if (stage1CheckEl) stage1CheckEl.classList.add('show');

    // Fade into Stage 2 (intentional tone shift).
    setTimeout(function () {
      showStage2();
    }, 850);
  }

  function showStage2() {
    if (!screenEl || stage2Shown) return;
    stage = 2;
    stage2Shown = true;
    screenEl.classList.remove('auth-stage1');
    screenEl.classList.add('auth-stage2');
    setHeadline('Analyzing device motion');
    setSubheadline('Confirming behavioral authenticity');
    if (stageDotsEl) stageDotsEl.hidden = true;
    if (stage1InstructionEl) stage1InstructionEl.hidden = true;

    // Remove 3D model completely for Stage 2.
    setPhoneVizState('hidden');

    // If motion verification already finished during Stage 1, replay it as Stage 2 completion.
    if (pendingMotionComplete) {
      var detail = pendingMotionComplete;
      pendingMotionComplete = null;
      setTimeout(function () {
        handleVerified(detail);
      }, 900);
    }
  }

  function handleVerified(detail) {
    var analysis = detail && detail.analysis;
    clearTimers();

    ensureTechnicalDetailsPanel();
    renderBehavioral(analysis);
    var riskScore = analysis ? 100 - (analysis.humanConfidence || 0) : 28;
    renderRiskContext('High', riskScore, false);

    configureConfirmationCopy();
    showConfirmationView();

    if (screenEl) {
      screenEl.classList.remove('auth-active', 'is-analysis');
      screenEl.classList.add('auth-success');
    }
    setHeadline('Verified. Access secured.');
    setSubheadline('');

    if (techDetailsEl) techDetailsEl.hidden = false;

    var subtext = confirmationPanel ? confirmationPanel.querySelector('.auth-verified-subtext') : null;
    if (subtext) subtext.textContent = 'Verified. Access secured.';
    redirectTimer = setTimeout(function () {
      if (screenEl) screenEl.classList.add('auth-redirecting');
      if (subtext) subtext.textContent = 'Redirecting to checkout\u2026';
      var btn = get('btn-auth-continue');
      if (btn && typeof btn.click === 'function') {
        setTimeout(function () { btn.click(); }, 900);
      }
    }, 1200);
  }

  function onMotionPhase(e) {
    var p = e.detail && e.detail.phase;
    if (p === 'capturing') {
      setProgressStep(1);
      if (stage === 1) setPhoneVizState('visible');
      if (screenEl) {
        screenEl.classList.remove('is-analysis', 'auth-success', 'auth-redirecting');
        screenEl.classList.add('auth-active');
      }
      if (stage === 1) {
        setHeadline('Tilt your phone to verify you\u2019re human');
        setSubheadline('Follow the motion sequence');
        if (stage1InstructionEl) stage1InstructionEl.textContent = 'Tilt left';
        if (stageDotsEl) stageDotsEl.hidden = false;
        if (stage1InstructionEl) stage1InstructionEl.hidden = false;
      } else {
        setHeadline('Analyzing device motion');
        setSubheadline('Confirming behavioral authenticity');
      }
      startArcSync();
    } else if (p === 'left_done') {
      setProgressStep(1);
      if (stage === 1) setPhoneVizState('tilt-left');
      if (screenEl) screenEl.classList.remove('is-analysis');
      if (stage === 2) {
        setHeadline('Analyzing device motion');
        setSubheadline('Confirming behavioral authenticity');
      }
    } else if (p === 'analysis') {
      setProgressStep(2);
      if (stage === 1) setPhoneVizState('analysis');
      if (screenEl) screenEl.classList.add('is-analysis');
      if (stage === 2) {
        setHeadline('Analyzing device motion');
        setSubheadline('Confirming behavioral authenticity');
      }
    }
  }

  function onMotionComplete(e) {
    // If Stage 1 hasn't finished yet, hold completion until Stage 2 is shown.
    if (!stage2Shown) {
      pendingMotionComplete = e && e.detail ? e.detail : null;
      return;
    }
    handleVerified(e && e.detail ? e.detail : null);
  }

  function onProceedClick() { /* deprecated in minimal flow */ }

  function start() {
    clearTimers();
    setTrafficBadge('High');
    setProgressStep(1);
    setPhoneVizState('visible');
    if (screenEl) {
      screenEl.classList.toggle('demo-mode', DEMO_MODE);
      screenEl.classList.remove('is-analysis', 'auth-success', 'auth-redirecting', 'auth-active');
    }
    stage = 1;
    if (screenEl) {
      screenEl.classList.add('auth-stage1');
      screenEl.classList.remove('auth-stage2');
    }
    configureStepUpCopy();
    configureConfirmationCopy();
    ensureTechnicalDetailsPanel();
    ensurePremiumMotionElements();
    bindTiltLight();
    bindDemoOrientation();
    showPanel(motionPanel);
    resetDemoState();
    setHeadline('Tilt your phone to verify you\u2019re human');
    setSubheadline('Follow the motion sequence');
    if (stage1InstructionEl) stage1InstructionEl.textContent = 'Tilt left';
    startArcSync();
    motionAuth.init({ demoMode: true });
    voiceAuth.init();
  }

  function reset() {
    clearTimers();
    setProgressStep(1);
    setPhoneVizState('hidden');
    if (screenEl) {
      screenEl.classList.remove('demo-mode');
      screenEl.classList.remove('is-analysis', 'auth-success', 'auth-redirecting', 'auth-active');
    }
    showPanel(motionPanel);
    if (techDetailsEl) techDetailsEl.hidden = true;
    if (screenEl) {
      screenEl.classList.remove('auth-stage1', 'auth-stage2', 'auth-stage1-complete');
    }
    if (stageDotsEl) stageDotsEl.hidden = false;
    if (stage1InstructionEl) stage1InstructionEl.hidden = false;
    resetDemoState();
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
    phoneMockupEl = get('auth-phone-mockup');

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
