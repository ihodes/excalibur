// This script will be injected into the page context to access Excalidraw's state
(function() {
  console.log('Excalidraw state access script injected');
  
  let lastSelectedCount = 0;
  
  // Method 1: Try to find Excalidraw API through React DevTools hook
  function getExcalidrawStateViaReact() {
    try {
      // React exposes a global hook for DevTools
      const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
      if (!hook) return null;
      
      // Get the React fiber root
      const containers = hook._renderers || hook.renderers;
      if (!containers || containers.size === 0) return null;
      
      // Look through all React roots
      for (const [id, renderer] of containers) {
        const root = renderer.getCurrentFiber ? renderer.getCurrentFiber() : null;
        if (!root) continue;
        
        // Traverse fiber tree to find Excalidraw component
        const fiber = findExcalidrawFiber(root);
        if (fiber) {
          const state = extractStateFromFiber(fiber);
          if (state) return state;
        }
      }
    } catch (e) {
      console.log('React DevTools method failed:', e);
    }
    return null;
  }
  
  // Find Excalidraw component in fiber tree
  function findExcalidrawFiber(fiber) {
    const visited = new Set();
    const queue = [fiber];
    
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || visited.has(current)) continue;
      visited.add(current);
      
      // Check if this might be Excalidraw app
      if (current.memoizedState) {
        const state = current.memoizedState;
        
        // Look for Excalidraw-specific state patterns
        if (state.elements && Array.isArray(state.elements)) {
          return current;
        }
        
        // Check nested state objects
        if (state.snapshot && state.snapshot.elements) {
          return current;
        }
      }
      
      // Check memoizedProps too
      if (current.memoizedProps) {
        const props = current.memoizedProps;
        if (props.elements && props.selectedElementIds) {
          return current;
        }
      }
      
      // Add children to queue
      if (current.child) queue.push(current.child);
      if (current.sibling) queue.push(current.sibling);
    }
    
    return null;
  }
  
  // Extract state from fiber node
  function extractStateFromFiber(fiber) {
    try {
      const state = fiber.memoizedState;
      if (state) {
        if (state.elements && state.selectedElementIds) {
          return {
            elements: state.elements,
            selectedElementIds: state.selectedElementIds
          };
        }
        if (state.snapshot) {
          return {
            elements: state.snapshot.elements || [],
            selectedElementIds: state.snapshot.appState?.selectedElementIds || {}
          };
        }
      }
    } catch (e) {
      console.log('Error extracting state from fiber:', e);
    }
    return null;
  }
  
  // Method 2: Check for global Excalidraw API
  function getExcalidrawStateViaAPI() {
    // Common places where Excalidraw might expose its API
    const possibleAPIs = [
      window.excalidrawAPI,
      window.excalidraw,
      window.Excalidraw,
      window.app,
      window.App,
      document.querySelector('#root')?._excalidrawAPI
    ];
    
    for (const api of possibleAPIs) {
      if (api && typeof api.getSceneElements === 'function') {
        try {
          const elements = api.getSceneElements();
          const selectedElements = api.getSelectedElements ? api.getSelectedElements() : [];
          const selectedElementIds = {};
          selectedElements.forEach(el => { selectedElementIds[el.id] = true; });
          
          return {
            elements,
            selectedElementIds
          };
        } catch (e) {
          console.log('API method failed:', e);
        }
      }
    }
    
    return null;
  }
  
  // Method 3: Try to intercept Excalidraw's internal calls
  function setupInterception() {
    // Override setState to catch state updates
    const originalSetState = Object.getPrototypeOf(React.Component.prototype).setState;
    if (originalSetState && !originalSetState._excalidrawWrapped) {
      Object.getPrototypeOf(React.Component.prototype).setState = function(...args) {
        const result = originalSetState.apply(this, args);
        
        // Check if this component has Excalidraw state
        if (this.state && this.state.elements && this.state.selectedElementIds) {
          window.postMessage({
            type: 'EXCALIDRAW_STATE_UPDATE',
            elements: this.state.elements,
            selectedElementIds: this.state.selectedElementIds
          }, '*');
        }
        
        return result;
      };
      Object.getPrototypeOf(React.Component.prototype).setState._excalidrawWrapped = true;
    }
  }
  
  // Get current state using all available methods
  function getCurrentState() {
    // Try React DevTools first
    let state = getExcalidrawStateViaReact();
    if (state) return state;
    
    // Try global API
    state = getExcalidrawStateViaAPI();
    if (state) return state;
    
    // Try localStorage as last resort
    try {
      const stored = localStorage.getItem('excalidraw');
      if (stored) {
        const data = JSON.parse(stored);
        return {
          elements: data.elements || [],
          selectedElementIds: {} // Can't get selection from localStorage
        };
      }
    } catch (e) {}
    
    return null;
  }
  
  // Send state to content script
  function sendState() {
    const state = getCurrentState();
    if (state) {
      const selectedCount = Object.keys(state.selectedElementIds || {}).length;
      window.postMessage({
        type: 'EXCALIDRAW_STATE',
        elements: state.elements,
        selectedElementIds: state.selectedElementIds,
        selectedCount: selectedCount
      }, '*');
      lastSelectedCount = selectedCount;
    }
  }
  
  // Listen for requests from content script
  window.addEventListener('message', (event) => {
    if (event.data.type === 'GET_EXCALIDRAW_STATE') {
      sendState();
    }
  });
  
  // Try to set up interception
  if (typeof React !== 'undefined') {
    setupInterception();
  }
  
  // Periodically check for state changes
  setInterval(() => {
    const state = getCurrentState();
    if (state) {
      const selectedCount = Object.keys(state.selectedElementIds || {}).length;
      if (selectedCount !== lastSelectedCount) {
        sendState();
      }
    }
  }, 500);
  
  // Initial state send
  setTimeout(sendState, 1000);
})();