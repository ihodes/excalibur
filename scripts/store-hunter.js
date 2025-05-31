// Hunt for the state store
(function() {
  console.log('🎯 Hunting for state store...\n');
  
  // Find all contexts with get/set/sub pattern
  function findStateStores() {
    const stores = [];
    const rootEl = document.getElementById('root');
    if (!rootEl) return stores;
    
    const reactKeys = Object.keys(rootEl).filter(key => key.startsWith('__react'));
    for (const key of reactKeys) {
      if (rootEl[key]) {
        searchFiberForStores(rootEl[key], stores, new WeakSet());
      }
    }
    
    return stores;
  }
  
  function searchFiberForStores(fiber, stores, visited) {
    if (!fiber || visited.has(fiber)) return;
    visited.add(fiber);
    
    // Check if this is a context consumer with store pattern
    if (fiber.dependencies && fiber.dependencies.firstContext) {
      let context = fiber.dependencies.firstContext;
      while (context) {
        if (context.memoizedValue && 
            typeof context.memoizedValue.get === 'function' &&
            typeof context.memoizedValue.set === 'function' &&
            typeof context.memoizedValue.sub === 'function') {
          stores.push({
            fiber: fiber,
            store: context.memoizedValue,
            context: context
          });
        }
        context = context.next;
      }
    }
    
    if (fiber.child) searchFiberForStores(fiber.child, stores, visited);
    if (fiber.sibling) searchFiberForStores(fiber.sibling, stores, visited);
  }
  
  // Try to extract state from store
  function exploreStore(store) {
    console.log('\n📦 Exploring store...');
    
    // Try to get the state
    try {
      // Common patterns for state stores
      const attempts = [
        () => store.get(),
        () => store.get(state => state),
        () => store.getState(),
        () => store.state,
        () => store._state,
        () => store.value
      ];
      
      for (const attempt of attempts) {
        try {
          const state = attempt();
          if (state) {
            console.log('Got state:', state);
            
            // Look for Excalidraw-specific properties
            if (state.elements || state.scene || state.appState) {
              console.log('🎉 Found Excalidraw state!');
              return state;
            }
            
            // If state is an object, explore its properties
            if (typeof state === 'object') {
              const keys = Object.keys(state);
              console.log('State keys:', keys);
              
              // Check each property
              for (const key of keys) {
                const value = state[key];
                if (value && typeof value === 'object') {
                  if (value.elements || value.selectedElementIds) {
                    console.log(`Found Excalidraw data in state.${key}:`, value);
                    return value;
                  }
                }
              }
            }
          }
        } catch (e) {
          // Continue trying
        }
      }
    } catch (e) {
      console.log('Error exploring store:', e.message);
    }
  }
  
  // Find and explore all stores
  const stores = findStateStores();
  console.log(`Found ${stores.length} stores with get/set/sub pattern`);
  
  stores.forEach((storeInfo, index) => {
    console.log(`\n=== Store ${index + 1} ===`);
    const state = exploreStore(storeInfo.store);
    
    // Try subscribing to changes
    if (state) {
      try {
        console.log('Attempting to subscribe to store changes...');
        storeInfo.store.sub((newState) => {
          console.log('🔔 Store updated!', newState);
          
          // Check for selection changes
          if (newState.selectedElementIds) {
            const selectedCount = Object.keys(newState.selectedElementIds).length;
            console.log(`Selection changed: ${selectedCount} elements selected`);
            
            window.postMessage({
              type: 'EXCALIDRAW_SELECTION_CHANGED',
              selectedIds: Object.keys(newState.selectedElementIds),
              totalElements: newState.elements?.length || 0
            }, '*');
          }
        });
        console.log('✅ Subscribed to store changes');
      } catch (e) {
        console.log('Could not subscribe:', e.message);
      }
    }
  });
  
  // Also try window/global objects that might be stores
  console.log('\n=== Checking window for store patterns ===');
  const windowKeys = Object.keys(window);
  for (const key of windowKeys) {
    const value = window[key];
    if (value && typeof value === 'object' && 
        typeof value.get === 'function' &&
        typeof value.set === 'function') {
      console.log(`Found store-like object at window.${key}`);
      exploreStore(value);
    }
  }
})();