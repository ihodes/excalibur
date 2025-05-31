// Direct state reader for Excalidraw
(function() {
  console.log('📖 Reading Excalidraw State\n');
  
  // Find contexts with Excalidraw state
  function findExcalidrawContexts() {
    const contexts = [];
    const rootEl = document.getElementById('root');
    if (!rootEl) return contexts;
    
    const reactKey = Object.keys(rootEl).find(key => key.startsWith('__reactContainer'));
    if (!reactKey || !rootEl[reactKey]) return contexts;
    
    const visited = new WeakSet();
    const queue = [rootEl[reactKey]];
    
    while (queue.length > 0) {
      const fiber = queue.shift();
      if (!fiber || visited.has(fiber)) continue;
      visited.add(fiber);
      
      // Check for context consumers
      if (fiber.dependencies && fiber.dependencies.firstContext) {
        let context = fiber.dependencies.firstContext;
        
        while (context) {
          // Check if this context has Excalidraw state
          if (context.memoizedValue && typeof context.memoizedValue === 'object') {
            const value = context.memoizedValue;
            
            // Check if it has selectedElementIds
            if (value.selectedElementIds !== undefined) {
              contexts.push({
                fiber: fiber,
                context: context,
                value: value,
                type: 'appState'
              });
            }
            
            // Check if it's a component instance with state
            if (value.scene || value.getSceneElements) {
              contexts.push({
                fiber: fiber,
                context: context,
                value: value,
                type: 'component'
              });
            }
          }
          
          context = context.next;
        }
      }
      
      if (fiber.child) queue.push(fiber.child);
      if (fiber.sibling) queue.push(fiber.sibling);
    }
    
    return contexts;
  }
  
  // Monitor state changes
  let lastSelectedIds = null;
  
  function checkState() {
    const contexts = findExcalidrawContexts();
    
    console.log(`Found ${contexts.length} Excalidraw contexts`);
    
    contexts.forEach((ctx, index) => {
      if (ctx.type === 'appState') {
        const selectedIds = Object.keys(ctx.value.selectedElementIds || {});
        console.log(`\nContext ${index + 1} (AppState):`);
        console.log('  Selected elements:', selectedIds);
        console.log('  Hovered elements:', Object.keys(ctx.value.hoveredElementIds || {}));
        console.log('  Active tool:', ctx.value.activeTool);
        console.log('  Zoom:', ctx.value.zoom);
        
        // Check for changes
        if (JSON.stringify(selectedIds) !== JSON.stringify(lastSelectedIds)) {
          console.log('🎯 SELECTION CHANGED!');
          lastSelectedIds = selectedIds;
          
          // Notify content script
          window.postMessage({
            type: 'EXCALIDRAW_SELECTION_CHANGED',
            selectedIds: selectedIds,
            totalElements: 0 // We don't have elements count here
          }, '*');
        }
      } else if (ctx.type === 'component') {
        console.log(`\nContext ${index + 1} (Component):`);
        if (ctx.value.getSceneElements) {
          try {
            const elements = ctx.value.getSceneElements();
            console.log('  Total elements:', elements.length);
          } catch (e) {
            console.log('  Could not get elements:', e.message);
          }
        }
      }
    });
  }
  
  // Initial check
  checkState();
  
  // Set up monitoring
  console.log('\n🔄 Starting state monitoring...');
  console.log('Click on shapes to see state changes\n');
  
  // Check every 500ms
  setInterval(checkState, 500);
  
  // Also check on any click
  document.addEventListener('click', () => {
    setTimeout(checkState, 100);
  });
})();