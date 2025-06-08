// Update Excalidraw with new elements
(function() {
  window.addEventListener('message', function(event) {
    if (event.data.type === 'UPDATE_EXCALIDRAW_ELEMENTS') {
      const { newElements, originalIds } = event.data;
      
      try {
        // Find Excalidraw's React instance
        const rootEl = document.getElementById('root');
        if (!rootEl) throw new Error('Root element not found');
        
        const reactKey = Object.keys(rootEl).find(key => key.startsWith('__reactContainer'));
        if (!reactKey || !rootEl[reactKey]) throw new Error('React container not found');
        
        // Search for the component with scene update capability
        const visited = new WeakSet();
        const queue = [rootEl[reactKey]];
        let excalidrawComponent = null;
        
        while (queue.length > 0 && !excalidrawComponent) {
          const fiber = queue.shift();
          if (!fiber || visited.has(fiber)) continue;
          visited.add(fiber);
          
          // Check if this component has the methods we need
          if (fiber.stateNode && fiber.stateNode.scene && 
              (fiber.stateNode.setElements || fiber.stateNode.updateScene)) {
            excalidrawComponent = fiber.stateNode;
            break;
          }
          
          // Check for App component
          if (fiber.elementType && fiber.elementType.name === 'App' && fiber.stateNode) {
            excalidrawComponent = fiber.stateNode;
            break;
          }
          
          if (fiber.child) queue.push(fiber.child);
          if (fiber.sibling) queue.push(fiber.sibling);
        }
        
        if (!excalidrawComponent) throw new Error('Excalidraw component not found');
        
        // Get current elements
        const currentElements = excalidrawComponent.scene?.elements || 
                              excalidrawComponent.state?.elements || 
                              [];
        
        // Validate the new elements
        if (!newElements || !Array.isArray(newElements) || newElements.length === 0) {
          throw new Error('Invalid elements created');
        }
        
        for (const elem of newElements) {
          if (!elem || !elem.id || !elem.type) {
            throw new Error('Invalid element in results');
          }
        }
        
        // Ensure arrays are initialized
        if (!Array.isArray(currentElements)) {
          throw new Error('Current elements is not an array');
        }
        
        // Remove original elements and add new ones
        const filteredElements = currentElements.filter(el => 
          el && !originalIds.includes(el.id)
        );
        const updatedElements = [...filteredElements, ...newElements];
        
        console.log('[Boolean Ops] Updating with', updatedElements.length, 'elements (added', newElements.length, 'new)');
        
        // Update the scene
        if (excalidrawComponent.setElements) {
          excalidrawComponent.setElements(updatedElements);
        } else if (excalidrawComponent.updateScene) {
          excalidrawComponent.updateScene({ elements: updatedElements });
        } else if (excalidrawComponent.setState) {
          excalidrawComponent.setState({ elements: updatedElements });
        }
        
        // Select all new elements
        if (excalidrawComponent.setState) {
          const selectedElementIds = {};
          for (const elem of newElements) {
            selectedElementIds[elem.id] = true;
          }
          excalidrawComponent.setState({ selectedElementIds });
        }
        
        console.log('[Boolean Ops] Successfully updated Excalidraw');
        
        window.postMessage({
          type: 'EXCALIDRAW_UPDATE_SUCCESS'
        }, '*');
        
      } catch (error) {
        console.error('[Boolean Ops] Failed to update Excalidraw:', error);
        window.postMessage({
          type: 'EXCALIDRAW_UPDATE_FAILED',
          error: error.message
        }, '*');
      }
    }
  });
})();