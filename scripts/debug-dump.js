// Comprehensive debug dump for Excalidraw state
(function() {
  console.log('🔍 Starting comprehensive debug dump...\n');
  
  // Helper to safely stringify objects
  function safeStringify(obj, depth = 2) {
    const seen = new WeakSet();
    return JSON.stringify(obj, function(key, value) {
      if (depth <= 0) return '[Depth Limit]';
      if (value === null || value === undefined) return value;
      if (typeof value === 'function') return `[Function: ${value.name || 'anonymous'}]`;
      if (typeof value === 'object') {
        if (seen.has(value)) return '[Circular]';
        seen.add(value);
        if (Array.isArray(value)) return value.length > 10 ? `[Array(${value.length})]` : value;
      }
      return value;
    }, 2);
  }
  
  // 1. Dump React Fiber Tree Structure
  function dumpFiberTree() {
    console.log('===== REACT FIBER TREE =====\n');
    
    const rootEl = document.getElementById('root');
    if (!rootEl) {
      console.log('No #root element found');
      return;
    }
    
    const reactKeys = Object.keys(rootEl).filter(key => key.startsWith('__react'));
    console.log('React keys on root:', reactKeys);
    
    for (const key of reactKeys) {
      if (rootEl[key]) {
        console.log(`\nTraversing from ${key}:`);
        printFiberTree(rootEl[key], 0, 5); // Print 5 levels deep
      }
    }
  }
  
  function printFiberTree(fiber, depth = 0, maxDepth = 5) {
    if (!fiber || depth > maxDepth) return;
    
    const indent = '  '.repeat(depth);
    const type = fiber.type?.name || fiber.type || fiber.elementType?.name || '[Unknown]';
    
    console.log(`${indent}├─ ${type} (tag: ${fiber.tag})`);
    
    // Print memoizedState structure
    if (fiber.memoizedState) {
      const stateKeys = Object.keys(fiber.memoizedState).filter(k => k !== 'next');
      if (stateKeys.length > 0) {
        console.log(`${indent}│  memoizedState keys: ${stateKeys.join(', ')}`);
      }
      
      // Check for hooks (linked list)
      if (fiber.memoizedState && fiber.memoizedState.next) {
        console.log(`${indent}│  Has hooks chain`);
        printHooks(fiber.memoizedState, indent + '│  ');
      }
    }
    
    // Print memoizedProps keys
    if (fiber.memoizedProps) {
      const propKeys = Object.keys(fiber.memoizedProps).slice(0, 10);
      if (propKeys.length > 0) {
        console.log(`${indent}│  memoizedProps keys: ${propKeys.join(', ')}`);
      }
    }
    
    // Print stateNode info
    if (fiber.stateNode && typeof fiber.stateNode === 'object' && fiber.stateNode.nodeType !== 1) {
      if (fiber.stateNode.state) {
        const stateKeys = Object.keys(fiber.stateNode.state).slice(0, 10);
        console.log(`${indent}│  stateNode.state keys: ${stateKeys.join(', ')}`);
      }
    }
    
    // Continue tree
    if (fiber.child) {
      printFiberTree(fiber.child, depth + 1, maxDepth);
    }
    if (fiber.sibling && depth > 0) {
      printFiberTree(fiber.sibling, depth, maxDepth);
    }
  }
  
  function printHooks(hook, indent) {
    let current = hook;
    let count = 0;
    while (current && count < 10) {
      if (current.memoizedState !== undefined) {
        const value = current.memoizedState;
        const valueStr = typeof value === 'object' ? 
          `{${Object.keys(value || {}).slice(0, 5).join(', ')}}` : 
          String(value).slice(0, 50);
        console.log(`${indent}Hook ${count}: ${valueStr}`);
      }
      current = current.next;
      count++;
    }
  }
  
  // 2. Dump Window Properties
  function dumpWindowProperties() {
    console.log('\n===== WINDOW PROPERTIES =====\n');
    
    const standardProps = new Set(['window', 'document', 'location', 'navigator', 'console', 'setTimeout', 'setInterval', 'fetch', 'XMLHttpRequest', 'localStorage', 'sessionStorage']);
    const customProps = Object.keys(window).filter(key => !standardProps.has(key) && !key.startsWith('webkit'));
    
    console.log('Non-standard window properties:', customProps.length);
    
    customProps.forEach(prop => {
      const value = window[prop];
      const type = typeof value;
      
      if (type === 'object' && value !== null) {
        const keys = Object.keys(value).slice(0, 20);
        console.log(`\nwindow.${prop} (${type}):`);
        console.log(`  Keys: ${keys.join(', ')}`);
        
        // Deep inspect if it might be app-related
        if (prop.toLowerCase().includes('app') || prop.toLowerCase().includes('excalidraw')) {
          console.log(`  Deep inspection of window.${prop}:`);
          console.log(safeStringify(value, 3));
        }
      } else if (type === 'function') {
        console.log(`window.${prop}: [Function: ${value.name || 'anonymous'}]`);
      } else {
        console.log(`window.${prop}: ${value}`);
      }
    });
  }
  
  // 3. Find and Dump All React Contexts
  function dumpContexts() {
    console.log('\n===== REACT CONTEXTS =====\n');
    
    const rootEl = document.getElementById('root');
    if (!rootEl) return;
    
    const reactKeys = Object.keys(rootEl).filter(key => key.startsWith('__react'));
    for (const key of reactKeys) {
      if (rootEl[key]) {
        findContextsInFiber(rootEl[key], 0, new WeakSet());
      }
    }
  }
  
  function findContextsInFiber(fiber, depth, visited) {
    if (!fiber || visited.has(fiber) || depth > 20) return;
    visited.add(fiber);
    
    // Check for context providers
    if (fiber.elementType && fiber.elementType._context) {
      console.log(`Found Context Provider at depth ${depth}:`);
      console.log(`  Context:`, fiber.elementType._context);
      if (fiber.memoizedProps && fiber.memoizedProps.value) {
        console.log(`  Value:`, safeStringify(fiber.memoizedProps.value, 3));
      }
    }
    
    // Check for context consumers
    if (fiber.dependencies && fiber.dependencies.firstContext) {
      console.log(`Found Context Consumer at depth ${depth}`);
      let context = fiber.dependencies.firstContext;
      while (context) {
        console.log(`  Context value:`, safeStringify(context.memoizedValue, 3));
        context = context.next;
      }
    }
    
    if (fiber.child) findContextsInFiber(fiber.child, depth + 1, visited);
    if (fiber.sibling) findContextsInFiber(fiber.sibling, depth, visited);
  }
  
  // 4. Dump Canvas Event Listeners
  function dumpCanvasListeners() {
    console.log('\n===== CANVAS EVENT LISTENERS =====\n');
    
    const canvases = document.querySelectorAll('canvas');
    canvases.forEach((canvas, index) => {
      console.log(`\nCanvas ${index}:`);
      
      // Get event listeners using Chrome DevTools API if available
      if (window.getEventListeners) {
        const listeners = getEventListeners(canvas);
        Object.keys(listeners).forEach(eventType => {
          console.log(`  ${eventType}: ${listeners[eventType].length} listeners`);
        });
      }
      
      // Check for properties that might contain handlers
      const props = Object.keys(canvas);
      const handlerProps = props.filter(p => p.startsWith('on') || p.includes('listener') || p.includes('handler'));
      if (handlerProps.length > 0) {
        console.log(`  Handler properties: ${handlerProps.join(', ')}`);
      }
    });
  }
  
  // 5. Search for State Management Libraries
  function dumpStateManagement() {
    console.log('\n===== STATE MANAGEMENT SEARCH =====\n');
    
    // Check for Redux
    if (window.__REDUX_DEVTOOLS_EXTENSION__) {
      console.log('Redux DevTools detected!');
      const stores = window.__REDUX_DEVTOOLS_EXTENSION__.stores;
      if (stores) {
        console.log('Redux stores:', stores);
      }
    }
    
    // Check for Zustand
    const zustandKeys = Object.keys(window).filter(k => k.includes('zustand') || k.includes('store'));
    if (zustandKeys.length > 0) {
      console.log('Possible Zustand keys:', zustandKeys);
    }
    
    // Check for MobX
    if (window.$mobx) {
      console.log('MobX detected:', window.$mobx);
    }
    
    // Check for Recoil
    const recoilKeys = Object.keys(window).filter(k => k.includes('recoil'));
    if (recoilKeys.length > 0) {
      console.log('Possible Recoil keys:', recoilKeys);
    }
  }
  
  // 6. Deep search specific objects
  function deepSearchForState() {
    console.log('\n===== DEEP STATE SEARCH =====\n');
    
    // Objects to deep search
    const searchTargets = [
      { name: 'EXCALIDRAW_ASSET_PATH', obj: window.EXCALIDRAW_ASSET_PATH },
      { name: 'document.body dataset', obj: document.body.dataset },
      { name: 'root element properties', obj: document.getElementById('root') }
    ];
    
    searchTargets.forEach(target => {
      if (target.obj) {
        console.log(`\nSearching ${target.name}:`);
        findStateInObject(target.obj, target.name, 0, new WeakSet());
      }
    });
  }
  
  function findStateInObject(obj, path, depth, visited) {
    if (!obj || typeof obj !== 'object' || visited.has(obj) || depth > 5) return;
    visited.add(obj);
    
    const keys = Object.keys(obj);
    
    // Look for state indicators
    const stateKeys = keys.filter(k => 
      k.includes('state') || 
      k.includes('element') || 
      k.includes('selected') ||
      k.includes('scene') ||
      k.includes('app')
    );
    
    if (stateKeys.length > 0) {
      console.log(`  ${path} has interesting keys: ${stateKeys.join(', ')}`);
      stateKeys.forEach(key => {
        const value = obj[key];
        if (value && typeof value === 'object') {
          console.log(`    ${key}: ${safeStringify(value, 2)}`);
        }
      });
    }
    
    // Recurse into objects
    keys.forEach(key => {
      if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
        findStateInObject(obj[key], `${path}.${key}`, depth + 1, visited);
      }
    });
  }
  
  // Run all dumps
  console.log('Running comprehensive debug dump...\n');
  console.log('Copy everything below this line:\n');
  console.log('='.repeat(50));
  
  dumpFiberTree();
  dumpWindowProperties();
  dumpContexts();
  dumpCanvasListeners();
  dumpStateManagement();
  deepSearchForState();
  
  console.log('\n' + '='.repeat(50));
  console.log('End of debug dump');
})();