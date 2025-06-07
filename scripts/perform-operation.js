// Perform boolean operation when called
(function() {
  // Listen for operation requests
  window.addEventListener('message', function(event) {
    if (event.data.type === 'PERFORM_BOOLEAN_OP') {
      const { elements, operation, validIds } = event.data;
      
      try {
        console.log('[Boolean Ops] Starting operation:', operation, 'on', elements.length, 'elements');
        
        // Perform the boolean operation - now returns array
        const newElements = window.performExcalidrawBooleanOp(elements, operation);
        
        console.log('[Boolean Ops] Operation completed, created', newElements.length, 'elements');
        
        // Send result back to content script
        window.postMessage({
          type: 'BOOLEAN_OP_RESULT',
          success: true,
          elements: newElements,  // Changed from element to elements
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