// Override boolean operations with diff-diff exact implementation
(function() {
  console.log('[Extension] Overriding with diff-diff exact implementation');
  console.log('[Extension] Before override:', window.performExcalidrawBooleanOp);
  console.log('[Extension] DiffDiff function:', window.performExcalidrawBooleanOpDiffDiff);
  
  if (window.performExcalidrawBooleanOpDiffDiff) {
    window.performExcalidrawBooleanOp = window.performExcalidrawBooleanOpDiffDiff;
    console.log('[Extension] Override successful!');
    console.log('[Extension] After override:', window.performExcalidrawBooleanOp);
  } else {
    console.error('[Extension] DiffDiff function not found, keeping original');
  }
})();