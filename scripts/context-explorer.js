// Deep exploration of React contexts
(function() {
  console.log('🔍 Deep Context Explorer\n');
  
  // Find all React contexts
  function findAllContexts() {
    const contexts = [];
    const rootEl = document.getElementById('root');
    if (!rootEl) return contexts;
    
    const reactKey = Object.keys(rootEl).find(key => key.startsWith('__reactContainer'));
    if (!reactKey || !rootEl[reactKey]) return contexts;
    
    // Traverse fiber tree
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
        
        while (context) {
          contexts.push({
            fiber: fiber,
            context: context,
            value: context.memoizedValue,
            index: contextIndex++,
            path: getFiberPath(fiber)
          });
          context = context.next;
        }
      }
      
      // Check for context providers
      if (fiber.elementType && fiber.elementType._context) {
        contexts.push({
          fiber: fiber,
          context: fiber.elementType._context,
          value: fiber.memoizedProps?.value,
          isProvider: true,
          path: getFiberPath(fiber)
        });
      }
      
      if (fiber.child) queue.push(fiber.child);
      if (fiber.sibling) queue.push(fiber.sibling);
    }
    
    return contexts;
  }
  
  // Get fiber path for debugging
  function getFiberPath(fiber) {
    const path = [];
    let current = fiber;
    let depth = 0;
    
    while (current && depth < 10) {
      const name = current.type?.name || current.elementType?.name || 'Unknown';
      path.unshift(name);
      current = current.return;
      depth++;
    }
    
    return path.join(' > ');
  }
  
  // Explore a context value deeply
  function exploreContextValue(contextInfo) {
    const { value, path } = contextInfo;
    
    console.log(`\n📍 Context at: ${path}`);
    console.log('Value type:', typeof value);
    
    if (!value) {
      console.log('Value is null/undefined');
      return;
    }
    
    // If it's a store-like object
    if (typeof value.get === 'function' && typeof value.set === 'function') {
      console.log('✅ Found store-like object with get/set methods');
      
      // Try to get state
      try {
        // Try different invocation patterns
        const attempts = [
          { name: 'get()', fn: () => value.get() },
          { name: 'get(s => s)', fn: () => value.get(s => s) },
          { name: 'get(undefined)', fn: () => value.get(undefined) },
          { name: 'get(null)', fn: () => value.get(null) },
        ];
        
        for (const attempt of attempts) {
          try {
            console.log(`\nTrying ${attempt.name}...`);
            const result = attempt.fn();
            
            if (result !== undefined) {
              console.log('Result:', result);
              
              // If result is an object, explore it
              if (result && typeof result === 'object') {
                const keys = Object.keys(result);
                console.log('Keys:', keys);
                
                // Look for Excalidraw patterns
                const interestingKeys = keys.filter(k => 
                  k.includes('element') || 
                  k.includes('selected') || 
                  k.includes('scene') || 
                  k.includes('app') ||
                  k.includes('canvas') ||
                  k.includes('state')
                );
                
                if (interestingKeys.length > 0) {
                  console.log('🎯 Interesting keys found:', interestingKeys);
                  
                  interestingKeys.forEach(key => {
                    const val = result[key];
                    console.log(`\n${key}:`, val);
                    
                    // If it's an object, show its keys
                    if (val && typeof val === 'object') {
                      console.log(`  Sub-keys:`, Object.keys(val).slice(0, 20));
                    }
                  });
                }
                
                // Also check if any values are arrays that might be elements
                keys.forEach(key => {
                  if (Array.isArray(result[key]) && result[key].length > 0) {
                    const firstItem = result[key][0];
                    if (firstItem && firstItem.type && firstItem.x !== undefined) {
                      console.log(`\n🎨 Found potential elements array at "${key}":`, result[key].length, 'items');
                      console.log('First item:', firstItem);
                    }
                  }
                });
              }
            }
          } catch (e) {
            console.log(`Error:`, e.message);
          }
        }
        
        // Try to subscribe
        if (typeof value.sub === 'function') {
          console.log('\n📡 Attempting to subscribe...');
          try {
            const unsubscribe = value.sub((state) => {
              console.log('🔔 Store updated!');
              console.log('New state:', state);
              
              // Look for selection changes
              const checkForSelection = (obj, path = '') => {
                if (!obj || typeof obj !== 'object') return;
                
                Object.keys(obj).forEach(key => {
                  if (key.includes('selected') || key.includes('Selection')) {
                    console.log(`Selection-related key "${path}${key}":`, obj[key]);
                  }
                  
                  if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
                    checkForSelection(obj[key], `${path}${key}.`);
                  }
                });
              };
              
              checkForSelection(state);
            });
            
            console.log('✅ Successfully subscribed to store updates');
            
            // Store unsubscribe function globally for cleanup
            window._excalidrawStoreUnsubscribe = unsubscribe;
          } catch (e) {
            console.log('Could not subscribe:', e.message);
          }
        }
      } catch (e) {
        console.log('Error exploring store:', e);
      }
    } else {
      // Not a store, show what it is
      console.log('Value:', value);
      if (value && typeof value === 'object') {
        console.log('Keys:', Object.keys(value));
      }
    }
  }
  
  // Main execution
  const contexts = findAllContexts();
  console.log(`Found ${contexts.length} React contexts\n`);
  
  // Group by value type
  const storeContexts = contexts.filter(c => 
    c.value && 
    typeof c.value.get === 'function' && 
    typeof c.value.set === 'function'
  );
  
  console.log(`Found ${storeContexts.length} store-like contexts`);
  
  // Explore each store context
  storeContexts.forEach((contextInfo, index) => {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`STORE CONTEXT ${index + 1}`);
    console.log(`${'='.repeat(50)}`);
    exploreContextValue(contextInfo);
  });
  
  // Also show non-store contexts that might be interesting
  console.log(`\n\n${'='.repeat(50)}`);
  console.log('OTHER CONTEXTS');
  console.log(`${'='.repeat(50)}`);
  
  contexts.filter(c => !storeContexts.includes(c)).forEach((contextInfo, index) => {
    if (contextInfo.value && typeof contextInfo.value === 'object') {
      const keys = Object.keys(contextInfo.value);
      if (keys.some(k => k.includes('element') || k.includes('state') || k.includes('scene'))) {
        console.log(`\nContext ${index + 1}:`, contextInfo.path);
        console.log('Value keys:', keys);
      }
    }
  });
})();