/**
 * Authentication Engine Layer
 * Entry point for auth. start() begins verification flow; reset() clears auth state.
 * Controller calls this; does not contain motion/voice logic (see motionAuth, voiceAuth).
 */
var authUI = (function () {
  function start() {
    motionAuth.init({});
    voiceAuth.init();
  }

  function reset() {
    motionAuth.reset();
    voiceAuth.reset();
  }

  function isVerified() {
    return motionAuth.isVerified();
  }

  return {
    start: start,
    reset: reset,
    isVerified: isVerified
  };
})();
