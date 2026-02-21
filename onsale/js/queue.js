/**
 * Queue Page — Screen 2
 * Simulated position decrease, wait time, progress bar, surge level, server load.
 * Modular: when queue completes, show CTA — auth/checkout can plug in there.
 */

(function () {
  'use strict';

  var SURGE_LEVELS = ['Low', 'Medium', 'High'];
  var SURGE_CLASSES = ['surge-low', 'surge-medium', 'surge-high'];

  var state = {
    position: 0,
    initialPosition: 0,
    waitSeconds: 0,
    progressPct: 0,
    surgeIndex: 1,
    serverLoadPct: 0,
    tickInterval: null,
    surgeInterval: null,
    loadInterval: null,
    completed: false
  };

  function getEl(id) {
    return document.getElementById(id);
  }

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function initState() {
    state.initialPosition = randomInt(8000, 24000);
    state.position = state.initialPosition;
    state.waitSeconds = Math.max(30, Math.floor(state.position / 200));
    state.progressPct = 0;
    state.surgeIndex = 1;
    state.serverLoadPct = randomInt(40, 75);
    state.completed = false;
  }

  function updatePosition() {
    if (state.completed) return;

    var decrease = randomInt(8, 35);
    state.position = Math.max(0, state.position - decrease);
    state.waitSeconds = Math.max(0, state.waitSeconds - randomInt(1, 3));
    state.progressPct = Math.min(100, Math.round((1 - state.position / state.initialPosition) * 100));

    var posEl = getEl('queue-position');
    var waitEl = getEl('queue-wait-time');
    var pctEl = getEl('queue-progress-pct');
    var fillEl = getEl('queue-progress-fill');
    var progressBar = document.querySelector('.queue-progress-bar');

    if (posEl) posEl.textContent = state.position.toLocaleString();
    if (waitEl) waitEl.textContent = state.waitSeconds <= 0 ? 'Almost there…' : state.waitSeconds + ' sec';
    if (pctEl) pctEl.textContent = state.progressPct + '%';
    if (fillEl) fillEl.style.width = state.progressPct + '%';
    if (progressBar) progressBar.setAttribute('aria-valuenow', state.progressPct);

    if (state.position <= 0) {
      state.completed = true;
      if (posEl) posEl.textContent = '0';
      if (waitEl) waitEl.textContent = 'Ready';
      if (fillEl) fillEl.style.width = '100%';
      if (pctEl) pctEl.textContent = '100%';
      if (progressBar) progressBar.setAttribute('aria-valuenow', 100);
      showContinueButton();
      stopIntervals();
    }
  }

  function updateSurge() {
    if (state.completed) return;
    var roll = Math.random();
    if (roll < 0.25) state.surgeIndex = 0;
    else if (roll < 0.6) state.surgeIndex = 1;
    else state.surgeIndex = 2;

    var labelEl = getEl('surge-label');
    if (!labelEl) return;
    labelEl.textContent = SURGE_LEVELS[state.surgeIndex];
    labelEl.className = 'queue-metric-value ' + SURGE_CLASSES[state.surgeIndex];
  }

  function updateServerLoad() {
    if (state.completed) return;
    var delta = randomInt(-8, 12);
    state.serverLoadPct = Math.max(20, Math.min(95, state.serverLoadPct + delta));

    var pctEl = getEl('server-load-pct');
    var fillEl = getEl('server-load-fill');
    if (pctEl) pctEl.textContent = state.serverLoadPct + '%';
    if (fillEl) fillEl.style.width = state.serverLoadPct + '%';
  }

  function showContinueButton() {
    var btn = getEl('queue-continue-btn');
    if (btn) btn.classList.add('visible');
  }

  function stopIntervals() {
    if (state.tickInterval) clearInterval(state.tickInterval);
    if (state.surgeInterval) clearInterval(state.surgeInterval);
    if (state.loadInterval) clearInterval(state.loadInterval);
  }

  function startIntervals() {
    state.tickInterval = setInterval(updatePosition, 1200);
    state.surgeInterval = setInterval(updateSurge, 3000);
    state.loadInterval = setInterval(updateServerLoad, 2000);
  }

  function init() {
    initState();
    updatePosition();
    updateSurge();
    updateServerLoad();
    startIntervals();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
