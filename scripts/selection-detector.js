// Selection detector - injected into page context
(function() {
  console.log('🎯 Selection detector script injected');
  
  // Keep track of last known state
  let lastKnownSelectedIds = [];
  
  // Strategy 1: Canvas Click Detection
  function setupCanvasClickDetection() {
    console.log('📍 Setting up canvas click detection...');
    
    const findCanvas = () => {
      const canvases = document.querySelectorAll('canvas');
      console.log(`Found ${canvases.length} canvas elements`);
      
      canvases.forEach((canvas, index) => {
        if (canvas._excalidrawClickListener) return;
        
        console.log(`Adding click listener to canvas ${index}`);
        
        const clickHandler = (e) => {
          console.log(`\n🖱️ Canvas clicked at (${e.offsetX}, ${e.offsetY})`);
          
          // After click, check state with multiple delays
          setTimeout(() => checkExcalidrawState(), 50);
          setTimeout(() => checkExcalidrawState(), 200);
          setTimeout(() => checkExcalidrawState(), 500);
        };
        
        canvas.addEventListener('click', clickHandler);
        canvas.addEventListener('mousedown', clickHandler);
        canvas._excalidrawClickListener = true;
      });
    };
    
    findCanvas();
    setInterval(findCanvas, 2000);
  }
  
  // Deep search through fiber tree
  function deepSearchFiber(startFiber) {
    console.log('🔍 Starting deep fiber search...');
    const visited = new WeakSet();
    const queue = [{ fiber: startFiber, depth: 0, path: 'root' }];
    let foundCount = 0;
    
    while (queue.length > 0 && foundCount < 100) {
      const { fiber, depth, path } = queue.shift();
      if (!fiber || visited.has(fiber) || depth > 50) continue;
      visited.add(fiber);
      
      // Check if this fiber has interesting properties
      const hasInterestingState = fiber.memoizedState && typeof fiber.memoizedState === 'object';
      const hasInterestingProps = fiber.memoizedProps && typeof fiber.memoizedProps === 'object';
      
      if (hasInterestingState || hasInterestingProps) {
        // Check memoizedState deeply
        if (fiber.memoizedState) {
          const state = searchObjectForExcalidrawState(fiber.memoizedState, `${path}.memoizedState`);
          if (state) return state;
        }
        
        // Check memoizedProps deeply
        if (fiber.memoizedProps) {
          const state = searchObjectForExcalidrawState(fiber.memoizedProps, `${path}.memoizedProps`);
          if (state) return state;
        }
        
        // Check stateNode
        if (fiber.stateNode && typeof fiber.stateNode === 'object' && fiber.stateNode !== document.getElementById('root')) {
          // Component instance
          if (fiber.stateNode.state) {
            const state = searchObjectForExcalidrawState(fiber.stateNode.state, `${path}.stateNode.state`);
            if (state) return state;
          }
          
          if (fiber.stateNode.props) {
            const state = searchObjectForExcalidrawState(fiber.stateNode.props, `${path}.stateNode.props`);
            if (state) return state;
          }
          
          // Check for refs or other properties
          const stateNodeKeys = Object.keys(fiber.stateNode).filter(k => 
            !k.startsWith('_') && !['props', 'state', 'context', 'refs'].includes(k)
          );
          
          for (const key of stateNodeKeys) {
            const value = fiber.stateNode[key];
            if (value && typeof value === 'object') {
              const state = searchObjectForExcalidrawState(value, `${path}.stateNode.${key}`);
              if (state) return state;
            }
          }
        }
      }
      
      // Add children to queue
      if (fiber.child) queue.push({ fiber: fiber.child, depth: depth + 1, path: `${path}.child` });
      if (fiber.sibling && depth < 20) queue.push({ fiber: fiber.sibling, depth, path: `${path}.sibling` });
    }
    
    return null;
  }
  
  // Search any object for Excalidraw state patterns
  function searchObjectForExcalidrawState(obj, path, depth = 0) {
    if (!obj || typeof obj !== 'object' || depth > 10) return null;
    
    // Direct check
    if (obj.elements && Array.isArray(obj.elements) && obj.selectedElementIds) {
      console.log(`✅ Found Excalidraw state at ${path}!`);
      return {
        elements: obj.elements,
        selectedElementIds: obj.selectedElementIds
      };
    }
    
    // Check nested objects
    const keys = Object.keys(obj).slice(0, 50); // Limit to prevent infinite loops
    for (const key of keys) {
      if (key === 'elements' && Array.isArray(obj[key]) && obj[key].length > 0) {
        console.log(`Found elements array at ${path}.${key}, length: ${obj[key].length}`);
        // Look for selectedElementIds nearby
        const parent = obj;
        if (parent.selectedElementIds || parent.appState?.selectedElementIds) {
          console.log(`✅ Found complete state at ${path}!`);
          return {
            elements: obj[key],
            selectedElementIds: parent.selectedElementIds || parent.appState.selectedElementIds
          };
        }
      }
      
      if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
        const result = searchObjectForExcalidrawState(obj[key], `${path}.${key}`, depth + 1);
        if (result) return result;
      }
    }
    
    return null;
  }
  
  // Main state checking function
  function checkExcalidrawState() {
    console.log('\n🔍 Checking Excalidraw state...');
    
    // Method 1: Direct fiber access from root
    const rootEl = document.getElementById('root');
    if (rootEl) {
      const reactKeys = Object.keys(rootEl).filter(key => 
        key.startsWith('__reactContainer') || key.startsWith('__reactFiber')
      );
      
      for (const key of reactKeys) {
        if (rootEl[key]) {
          console.log(`Searching from ${key}...`);
          const state = deepSearchFiber(rootEl[key]);
          if (state) {
            console.log('🎉 Found state!', {
              elements: state.elements.length,
              selectedIds: Object.keys(state.selectedElementIds)
            });
            
            const selectedIds = Object.keys(state.selectedElementIds);
            if (JSON.stringify(selectedIds) !== JSON.stringify(lastKnownSelectedIds)) {
              lastKnownSelectedIds = selectedIds;
              notifySelection(state);
            }
            return;
          }
        }
      }
    }
    
    // Method 2: Check window for any Excalidraw references
    const windowKeys = Object.keys(window).filter(k => 
      k.toLowerCase().includes('excalidraw') || 
      k.toLowerCase().includes('app') ||
      k === 'h'
    );
    
    console.log('Window keys that might be Excalidraw:', windowKeys);
    
    for (const key of windowKeys) {
      if (window[key] && typeof window[key] === 'object') {
        const state = searchObjectForExcalidrawState(window[key], `window.${key}`);
        if (state) {
          console.log(`🎉 Found state via window.${key}!`);
          notifySelection(state);
          return;
        }
      }
    }
    
    // Method 3: Try to intercept React renders
    interceptReactRenders();
  }
  
  // Try to intercept React component renders
  function interceptReactRenders() {
    // This is a last resort - try to patch React methods
    if (window.React && !window.React._excalidrawPatched) {
      console.log('Attempting to patch React...');
      
      const originalCreateElement = window.React.createElement;
      window.React.createElement = function(...args) {
        const element = originalCreateElement.apply(this, args);
        
        // Check if props contain Excalidraw state
        if (args[1] && args[1].elements && args[1].selectedElementIds) {
          console.log('🎯 Intercepted React element with Excalidraw state!');
          notifySelection({
            elements: args[1].elements,
            selectedElementIds: args[1].selectedElementIds
          });
        }
        
        return element;
      };
      
      window.React._excalidrawPatched = true;
    }
  }
  
  // Notify content script of selection
  function notifySelection(state) {
    const selectedIds = Object.keys(state.selectedElementIds || {});
    console.log('📤 Notifying content script:', selectedIds);
    
    window.postMessage({
      type: 'EXCALIDRAW_SELECTION_CHANGED',
      selectedIds: selectedIds,
      totalElements: state.elements?.length || 0
    }, '*');
  }
  
  // Alternative: Use the clipboard API more aggressively
  function monitorClipboard() {
    // Override clipboard write to catch when Excalidraw copies
    const originalWrite = navigator.clipboard.write;
    const originalWriteText = navigator.clipboard.writeText;
    
    navigator.clipboard.writeText = async function(text) {
      try {
        const data = JSON.parse(text);
        if (data.type === 'excalidraw/clipboard') {
          console.log('📋 Intercepted Excalidraw clipboard write!');
          // This means something is selected
          if (data.elements && data.elements.length > 0) {
            console.log(`Selected ${data.elements.length} elements`);
          }
        }
      } catch (e) {}
      
      return originalWriteText.call(this, text);
    };
  }
  
  // Initialize everything
  console.log('🚀 Starting selection detection...');
  setupCanvasClickDetection();
  monitorClipboard();
  
  // Initial check
  setTimeout(() => {
    console.log('\n🎬 Initial state check...');
    checkExcalidrawState();
  }, 2000);
})();