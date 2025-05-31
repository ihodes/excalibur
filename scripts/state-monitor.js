// State monitor for Excalidraw - injected into page context
(function() {
  // Find contexts with Excalidraw state
  function findExcalidrawState() {
    const rootEl = document.getElementById('root');
    if (!rootEl) return null;
    
    const reactKey = Object.keys(rootEl).find(key => key.startsWith('__reactContainer'));
    if (!reactKey || !rootEl[reactKey]) return null;
    
    const visited = new WeakSet();
    const queue = [rootEl[reactKey]];
    
    while (queue.length > 0) {
      const fiber = queue.shift();
      if (!fiber || visited.has(fiber)) continue;
      visited.add(fiber);
      
      // Check stateNode for scene.elements
      if (fiber.stateNode && fiber.stateNode.scene && fiber.stateNode.scene.elements) {
        return {
          elements: fiber.stateNode.scene.elements,
          component: fiber.stateNode,
          fiber: fiber
        };
      }
      
      // Check for context consumers
      if (fiber.dependencies && fiber.dependencies.firstContext) {
        let context = fiber.dependencies.firstContext;
        
        while (context) {
          // Check if this context has Excalidraw state
          if (context.memoizedValue && typeof context.memoizedValue === 'object') {
            const value = context.memoizedValue;
            
            // Found app state with selectedElementIds
            if (value.selectedElementIds !== undefined) {
              return {
                appState: value,
                fiber: fiber
              };
            }
            
            // Found component instance
            if (value.scene || value.getSceneElements) {
              return {
                component: value,
                fiber: fiber
              };
            }
          }
          
          context = context.next;
        }
      }
      
      if (fiber.child) queue.push(fiber.child);
      if (fiber.sibling) queue.push(fiber.sibling);
    }
    
    return null;
  }
  
  // Monitor state changes
  let lastSelectedIds = '';
  let elements = [];
  
  function checkAndReportState() {
    const state = findExcalidrawState();
    if (!state) {
      return;
    }
    
    let selectedIds = [];
    let appState = null;
    
    if (state.appState) {
      selectedIds = Object.keys(state.appState.selectedElementIds || {});
      appState = state.appState;
    }
    
    if (state.component && state.component.getSceneElements) {
      try {
        elements = state.component.getSceneElements();
      } catch (e) {
        // Ignore errors
      }
    }
    
    // Check if selection changed
    const currentSelectedIds = selectedIds.join(',');
    if (currentSelectedIds !== lastSelectedIds) {
      lastSelectedIds = currentSelectedIds;
      
      // Send update to content script
      window.postMessage({
        type: 'EXCALIDRAW_STATE_UPDATE',
        selectedIds: selectedIds,
        elements: elements,
        appState: appState
      }, '*');
    }
  }
  
  // Alternative method: Look for React DevTools hook
  function findViaDevTools() {
    const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (!hook) return null;
    
    const renderers = hook.renderers;
    if (!renderers || renderers.size === 0) return null;
    
    for (const [id, renderer] of renderers) {
      const fiber = hook.getFiberRoots(id);
      if (fiber && fiber.size > 0) {
        for (const root of fiber) {
          return root.current;
        }
      }
    }
    return null;
  }
  
  // Enhanced state finding - find both elements and selectedElementIds
  function findStateEnhanced() {
    let elementsSource = null;
    let appStateSource = null;
    
    // First, try original method for appState
    const originalState = findExcalidrawState();
    if (originalState && originalState.appState) {
      appStateSource = originalState;
    }
    
    // Search for both elements and appState
    const rootEl = document.getElementById('root');
    if (!rootEl) return null;
    
    const reactKey = Object.keys(rootEl).find(key => key.startsWith('__reactContainer'));
    if (!reactKey || !rootEl[reactKey]) return null;
    
    const visited = new WeakSet();
    const queue = [rootEl[reactKey]];
    
    while (queue.length > 0) {
      const fiber = queue.shift();
      if (!fiber || visited.has(fiber)) continue;
      visited.add(fiber);
      
      // Look for elements in stateNode
      if (!elementsSource && fiber.stateNode && fiber.stateNode.scene && fiber.stateNode.scene.elements) {
        elementsSource = {
          elements: fiber.stateNode.scene.elements,
          component: fiber.stateNode
        };
      }
      
      // Look for contexts with selectedElementIds
      if (!appStateSource && fiber.dependencies && fiber.dependencies.firstContext) {
        let context = fiber.dependencies.firstContext;
        while (context) {
          if (context.memoizedValue && typeof context.memoizedValue === 'object') {
            const value = context.memoizedValue;
            if (value.selectedElementIds !== undefined) {
              appStateSource = { appState: value };
            }
          }
          context = context.next;
        }
      }
      
      // If we have both, we can return
      if (elementsSource && appStateSource) {
        return {
          elements: elementsSource.elements,
          component: elementsSource.component,
          appState: appStateSource.appState
        };
      }
      
      if (fiber.child) queue.push(fiber.child);
      if (fiber.sibling) queue.push(fiber.sibling);
    }
    
    // Return whatever we found
    if (elementsSource || appStateSource) {
      return {
        elements: elementsSource ? elementsSource.elements : [],
        component: elementsSource ? elementsSource.component : null,
        appState: appStateSource ? appStateSource.appState : null
      };
    }
    
    return null;
  }
  
  // Update checkAndReportState to use enhanced finding
  const originalCheck = checkAndReportState;
  checkAndReportState = function() {
    const state = findStateEnhanced();
    if (!state) {
      return;
    }
    
    let selectedIds = [];
    let appState = null;
    
    // Get elements if directly available
    if (state.elements) {
      elements = state.elements;
    }
    
    if (state.appState) {
      selectedIds = Object.keys(state.appState.selectedElementIds || {});
      appState = state.appState;
    }
    
    if (state.component) {
      // Try to get elements from component
      if (!elements && state.component.scene && state.component.scene.elements) {
        elements = state.component.scene.elements;
      }
      // Try getSceneElements method
      if (!elements && state.component.getSceneElements) {
        try {
          elements = state.component.getSceneElements();
        } catch (e) {
          // Ignore errors
        }
      }
    }
    
    // Check if selection changed
    const currentSelectedIds = selectedIds.join(',');
    if (currentSelectedIds !== lastSelectedIds) {
      lastSelectedIds = currentSelectedIds;
      
      // Send update to content script
      window.postMessage({
        type: 'EXCALIDRAW_STATE_UPDATE',
        selectedIds: selectedIds,
        elements: elements,
        appState: appState
      }, '*');
    }
  };
  
  // Check state periodically
  setInterval(checkAndReportState, 250);
  
  // Also check on canvas interactions
  const canvases = document.querySelectorAll('canvas');
  canvases.forEach(canvas => {
    canvas.addEventListener('click', () => {
      setTimeout(checkAndReportState, 50);
    });
    canvas.addEventListener('mouseup', () => {
      setTimeout(checkAndReportState, 50);
    });
  });
  
  // Initial check
  setTimeout(checkAndReportState, 1000);
})();