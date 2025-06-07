// Perform boolean operation when called
(function() {
  // Listen for operation requests
  window.addEventListener('message', function(event) {
    if (event.data.type === 'PERFORM_BOOLEAN_OP') {
      const { elements, operation, validIds } = event.data;
      
      try {
        console.log('[Boolean Ops] Starting operation:', operation, 'on', elements.length, 'elements');
        console.log('[Perform] Using function:', window.performExcalidrawBooleanOp.name || 'anonymous');
        console.log('[Perform] Function toString:', window.performExcalidrawBooleanOp.toString().substring(0, 100));
        
        // Check which implementation we're using
        if (window.performExcalidrawBooleanOp.toString().includes('[DiffDiff]')) {
          console.log('[Perform] Using DiffDiff implementation');
        } else if (window.performExcalidrawBooleanOp.toString().includes('[Boolean Ops]')) {
          console.log('[Perform] Using simple-boolean-ops implementation');
        }
        
        // Perform the boolean operation
        const newElement = window.performExcalidrawBooleanOp(elements, operation);
        
        console.log('[Boolean Ops] Operation completed, new element:', newElement);
        
        // Send result back to content script
        window.postMessage({
          type: 'BOOLEAN_OP_RESULT',
          success: true,
          element: newElement,
          operation: operation,
          originalIds: validIds
        }, '*');
      } catch (error) {
        console.error('[Boolean Ops] Operation failed:', error);
        window.postMessage({
          type: 'BOOLEAN_OP_RESULT',
          success: false,
          error: error.message + '\n' + error.stack
        }, '*');
      }
    }
  });
})();