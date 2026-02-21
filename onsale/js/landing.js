/**
 * Event Landing — Screen 1
 * Countdown to event, simulated "users viewing now", no backend.
 */

(function () {
  'use strict';

  // Event date: March 22, 2026 8:00 PM (local)
  var EVENT_DATE = new Date('2026-03-22T20:00:00');

  var state = {
    viewers: 0,
    viewersMin: 1200,
    viewersMax: 5800,
    countdownInterval: null,
    viewersInterval: null
  };

  function pad(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function updateCountdown() {
    var now = new Date();
    var diff = Math.max(0, EVENT_DATE - now);

    var days = Math.floor(diff / (24 * 60 * 60 * 1000));
    var hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    var mins = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
    var secs = Math.floor((diff % (60 * 1000)) / 1000);

    var el;
    if (el = document.getElementById('countdown-days')) el.textContent = days;
    if (el = document.getElementById('countdown-hours')) el.textContent = pad(hours);
    if (el = document.getElementById('countdown-mins')) el.textContent = pad(mins);
    if (el = document.getElementById('countdown-secs')) el.textContent = pad(secs);
  }

  function randomInRange(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function updateViewers() {
    state.viewers = randomInRange(state.viewersMin, state.viewersMax);
    var el = document.getElementById('viewers-count');
    if (el) el.textContent = state.viewers.toLocaleString();
  }

  function startIntervals() {
    updateCountdown();
    updateViewers();
    state.countdownInterval = setInterval(updateCountdown, 1000);
    state.viewersInterval = setInterval(updateViewers, 4000);
  }

  function init() {
    startIntervals();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
