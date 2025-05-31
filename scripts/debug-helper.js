// Debug helper function
window.debugBooleanOps = function() {
  // Request debug state via message
  window.postMessage({
    type: 'REQUEST_DEBUG_STATE'
  }, '*');
};