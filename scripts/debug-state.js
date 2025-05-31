// Debug script to find where Excalidraw stores its elements
(function() {
  console.log('[DEBUG-STATE] Starting comprehensive search for elements array at', new Date().toISOString());
  
  const results = {
    windowProperties: [],
    reactFiber: [],
    contexts: [],
    elementsFound: [],
    sceneObjects: []
  };
  
  // 1. Search window object for elements/scene properties
  function searchWindowObject() {
    console.log('[DEBUG-STATE] Searching window object...');
    
    function searchObject(obj, path = 'window', depth = 0, visited = new WeakSet()) {
      if (depth > 5 || !obj || typeof obj !== 'object' || visited.has(obj)) return;
      visited.add(obj);
      
      try {
        for (const key in obj) {
          if (!obj.hasOwnProperty(key)) continue;
          
          const value = obj[key];
          const currentPath = `${path}.${key}`;
          
          // Look for arrays that might be elements
          if (Array.isArray(value) && value.length > 0) {
            const firstItem = value[0];
            if (firstItem && typeof firstItem === 'object') {
              // Check if it looks like an Excalidraw element
              if (firstItem.type && firstItem.id && firstItem.x !== undefined && firstItem.y !== undefined) {
                results.elementsFound.push({
                  path: currentPath,
                  count: value.length,
                  sample: firstItem,
                  allKeys: Object.keys(firstItem)
                });
                console.log(`[DEBUG-STATE] Found potential elements array at ${currentPath} with ${value.length} items`);
              }
            }
          }
          
          // Look for objects with elements/scene properties
          if (value && typeof value === 'object') {
            if ('elements' in value || 'scene' in value || 'sceneElements' in value || 'getSceneElements' in value) {
              results.sceneObjects.push({
                path: currentPath,
                keys: Object.keys(value),
                hasElements: 'elements' in value,
                hasScene: 'scene' in value,
                hasSceneElements: 'sceneElements' in value,
                hasGetSceneElements: 'getSceneElements' in value
              });
              console.log(`[DEBUG-STATE] Found scene-related object at ${currentPath}`);
            }
            
            // Recurse into object
            if (depth < 5) {
              searchObject(value, currentPath, depth + 1, visited);
            }
          }
        }
      } catch (e) {
        // Ignore errors from inaccessible properties
      }
    }
    
    searchObject(window);
  }
  
  // 2. Search React fiber tree
  function searchReactFiber() {
    console.log('[DEBUG-STATE] Searching React fiber tree...');
    
    const rootEl = document.getElementById('root');
    if (!rootEl) {
      console.log('[DEBUG-STATE] No root element found');
      return;
    }
    
    const reactKey = Object.keys(rootEl).find(key => key.startsWith('__reactContainer'));
    if (!reactKey || !rootEl[reactKey]) {
      console.log('[DEBUG-STATE] No React container found');
      return;
    }
    
    const visited = new WeakSet();
    const queue = [rootEl[reactKey]];
    let fiberCount = 0;
    
    while (queue.length > 0 && fiberCount < 1000) {
      const fiber = queue.shift();
      if (!fiber || visited.has(fiber)) continue;
      visited.add(fiber);
      fiberCount++;
      
      // Check fiber properties for elements
      const checkForElements = (obj, source) => {
        if (!obj || typeof obj !== 'object') return;
        
        // Direct elements array
        if (Array.isArray(obj.elements) && obj.elements.length > 0) {
          const firstElement = obj.elements[0];
          if (firstElement && firstElement.type && firstElement.id) {
            results.reactFiber.push({
              source: source,
              fiberType: fiber.elementType?.name || 'Unknown',
              elementsCount: obj.elements.length,
              sample: firstElement,
              path: `fiber.${source}.elements`
            });
            console.log(`[DEBUG-STATE] Found elements in fiber ${source}:`, obj.elements.length, 'items');
          }
        }
        
        // Check for scene/getSceneElements
        if (obj.scene || obj.getSceneElements || obj.sceneElements) {
          results.reactFiber.push({
            source: source,
            fiberType: fiber.elementType?.name || 'Unknown',
            hasScene: !!obj.scene,
            hasGetSceneElements: !!obj.getSceneElements,
            hasSceneElements: !!obj.sceneElements,
            keys: Object.keys(obj).filter(k => !k.startsWith('_'))
          });
          console.log(`[DEBUG-STATE] Found scene methods in fiber ${source}`);
        }
      };
      
      // Check memoizedProps
      if (fiber.memoizedProps) {
        checkForElements(fiber.memoizedProps, 'memoizedProps');
      }
      
      // Check memoizedState
      if (fiber.memoizedState) {
        checkForElements(fiber.memoizedState, 'memoizedState');
        
        // Check linked list of states
        let current = fiber.memoizedState;
        let stateIndex = 0;
        while (current && stateIndex < 50) {
          if (current.memoizedState) {
            checkForElements(current.memoizedState, `memoizedState[${stateIndex}].memoizedState`);
          }
          checkForElements(current, `memoizedState[${stateIndex}]`);
          current = current.next;
          stateIndex++;
        }
      }
      
      // Check stateNode
      if (fiber.stateNode && typeof fiber.stateNode === 'object') {
        checkForElements(fiber.stateNode, 'stateNode');
        
        // Check stateNode properties deeply
        try {
          for (const key in fiber.stateNode) {
            if (key.startsWith('_') || key.startsWith('__')) continue;
            const value = fiber.stateNode[key];
            if (value && typeof value === 'object') {
              checkForElements(value, `stateNode.${key}`);
            }
          }
        } catch (e) {
          // Ignore errors
        }
      }
      
      // Add children to queue
      if (fiber.child) queue.push(fiber.child);
      if (fiber.sibling) queue.push(fiber.sibling);
    }
    
    console.log(`[DEBUG-STATE] Searched ${fiberCount} fiber nodes`);
  }
  
  // 3. Search for contexts with get/set/sub pattern
  function searchContexts() {
    console.log('[DEBUG-STATE] Searching for contexts with get/set/sub pattern...');
    
    const rootEl = document.getElementById('root');
    if (!rootEl) return;
    
    const reactKey = Object.keys(rootEl).find(key => key.startsWith('__reactContainer'));
    if (!reactKey || !rootEl[reactKey]) return;
    
    const visited = new WeakSet();
    const queue = [rootEl[reactKey]];
    
    while (queue.length > 0) {
      const fiber = queue.shift();
      if (!fiber || visited.has(fiber)) continue;
      visited.add(fiber);
      
      // Check for context consumers
      if (fiber.dependencies && fiber.dependencies.firstContext) {
        let context = fiber.dependencies.firstContext;
        let contextIndex = 0;
        
        while (context && contextIndex < 20) {
          if (context.memoizedValue && typeof context.memoizedValue === 'object') {
            const value = context.memoizedValue;
            
            // Check for get/set/sub pattern
            if (value.get && value.set && value.sub) {
              results.contexts.push({
                type: 'get/set/sub context',
                keys: Object.keys(value),
                fiberType: fiber.elementType?.name || 'Unknown'
              });
              console.log('[DEBUG-STATE] Found get/set/sub context');
              
              // Try to call get() to see what's inside
              try {
                const state = value.get();
                if (state && typeof state === 'object') {
                  if (Array.isArray(state.elements)) {
                    results.contexts.push({
                      type: 'elements via get()',
                      count: state.elements.length,
                      stateKeys: Object.keys(state)
                    });
                    console.log('[DEBUG-STATE] Found elements via context.get():', state.elements.length, 'items');
                  }
                }
              } catch (e) {
                console.log('[DEBUG-STATE] Error calling context.get():', e);
              }
            }
            
            // Check for direct elements/scene properties
            if (value.elements || value.scene || value.selectedElementIds) {
              results.contexts.push({
                type: 'direct properties',
                hasElements: !!value.elements,
                hasScene: !!value.scene,
                hasSelectedElementIds: !!value.selectedElementIds,
                keys: Object.keys(value).filter(k => !k.startsWith('_'))
              });
              console.log('[DEBUG-STATE] Found context with direct properties');
            }
          }
          
          context = context.next;
          contextIndex++;
        }
      }
      
      if (fiber.child) queue.push(fiber.child);
      if (fiber.sibling) queue.push(fiber.sibling);
    }
  }
  
  // 4. Check React DevTools
  function checkReactDevTools() {
    console.log('[DEBUG-STATE] Checking React DevTools...');
    
    const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (!hook) {
      console.log('[DEBUG-STATE] No React DevTools found');
      return;
    }
    
    try {
      const renderers = hook.renderers;
      if (renderers && renderers.size > 0) {
        for (const [id, renderer] of renderers) {
          const roots = hook.getFiberRoots(id);
          if (roots && roots.size > 0) {
            console.log(`[DEBUG-STATE] Found ${roots.size} React roots via DevTools`);
          }
        }
      }
    } catch (e) {
      console.log('[DEBUG-STATE] Error accessing React DevTools:', e);
    }
  }
  
  // 5. Check for global Excalidraw objects
  function checkGlobalExcalidraw() {
    console.log('[DEBUG-STATE] Checking for global Excalidraw objects...');
    
    // Common global names
    const globals = ['Excalidraw', 'excalidraw', 'EXCALIDRAW', 'ExcalidrawLib', 'excalidrawLib'];
    
    globals.forEach(name => {
      if (window[name]) {
        results.windowProperties.push({
          name: name,
          type: typeof window[name],
          keys: typeof window[name] === 'object' ? Object.keys(window[name]) : []
        });
        console.log(`[DEBUG-STATE] Found global: ${name}`);
      }
    });
  }
  
  // Run all searches
  function runDebugSearch() {
    searchWindowObject();
    searchReactFiber();
    searchContexts();
    checkReactDevTools();
    checkGlobalExcalidraw();
    
    // Log comprehensive results
    console.log('[DEBUG-STATE] ===== SEARCH RESULTS =====');
    console.log('Window Properties:', results.windowProperties);
    console.log('React Fiber Results:', results.reactFiber);
    console.log('Context Results:', results.contexts);
    console.log('Elements Arrays Found:', results.elementsFound);
    console.log('Scene Objects:', results.sceneObjects);
    
    // Send results to content script
    window.postMessage({
      type: 'DEBUG_STATE_RESULTS',
      results: results,
      timestamp: new Date().toISOString()
    }, '*');
  }
  
  // Run immediately and after a delay
  runDebugSearch();
  setTimeout(runDebugSearch, 2000);
  setTimeout(runDebugSearch, 5000);
  
  // Also run on user interaction
  document.addEventListener('click', () => {
    console.log('[DEBUG-STATE] Running search after click...');
    setTimeout(runDebugSearch, 100);
  }, { once: true });
})();