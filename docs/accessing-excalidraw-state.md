# Accessing Excalidraw's Internal State from a Chrome Extension

This document outlines various approaches to access Excalidraw's internal state (particularly `selectedElementIds` and `elements`) from a Chrome extension without relying on clipboard operations.

## 1. React DevTools Global Hook Approach

Excalidraw is built with React, and we can leverage the React DevTools hook to access the React fiber tree and component state.

### Implementation:

```javascript
// Content script that needs to be injected into the page context
function injectScript() {
  const script = document.createElement('script');
  script.textContent = `
    (function() {
      // Wait for React DevTools hook
      const checkReactDevTools = setInterval(() => {
        if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
          clearInterval(checkReactDevTools);
          
          // Access React fiber tree
          const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
          
          // Function to find React fiber from DOM element
          window.findReactFiber = function(element) {
            for (const key in element) {
              if (key.startsWith('__reactInternalInstance$') || 
                  key.startsWith('__reactFiber$')) {
                return element[key];
              }
            }
            return null;
          };
          
          // Function to find Excalidraw component state
          window.getExcalidrawState = function() {
            const canvas = document.querySelector('canvas.interactive');
            if (!canvas) return null;
            
            // Traverse up to find the Excalidraw component
            let element = canvas;
            while (element) {
              const fiber = findReactFiber(element);
              if (fiber) {
                // Traverse up the fiber tree
                let currentFiber = fiber;
                while (currentFiber) {
                  // Check if this is the Excalidraw component
                  if (currentFiber.memoizedState && 
                      currentFiber.memoizedState.selectedElementIds) {
                    return {
                      selectedElementIds: currentFiber.memoizedState.selectedElementIds,
                      elements: currentFiber.memoizedState.elements
                    };
                  }
                  currentFiber = currentFiber.return;
                }
              }
              element = element.parentElement;
            }
            return null;
          };
          
          // Expose to content script via custom event
          window.addEventListener('getExcalidrawState', (e) => {
            const state = window.getExcalidrawState();
            window.dispatchEvent(new CustomEvent('excalidrawState', {
              detail: state
            }));
          });
        }
      }, 100);
    })();
  `;
  document.head.appendChild(script);
  script.remove();
}
```

## 2. Excalidraw API Hook Approach

If Excalidraw exposes an API instance globally or through the component, we can access it directly.

```javascript
// Check for global Excalidraw API
function checkExcalidrawAPI() {
  const script = document.createElement('script');
  script.textContent = `
    (function() {
      // Check various possible locations
      const possibleAPIs = [
        window.excalidrawAPI,
        window.excalidraw,
        window.Excalidraw,
        window.EXCALIDRAW,
        window.ExcalidrawLib
      ];
      
      for (const api of possibleAPIs) {
        if (api && (api.getSceneElements || api.getSelectedElements)) {
          window.__excalidrawAPI = api;
          break;
        }
      }
      
      // Listen for API exposure
      window.addEventListener('getExcalidrawElements', () => {
        if (window.__excalidrawAPI) {
          const elements = window.__excalidrawAPI.getSceneElements?.() || [];
          const selectedElements = window.__excalidrawAPI.getSelectedElements?.() || [];
          
          window.dispatchEvent(new CustomEvent('excalidrawElements', {
            detail: { elements, selectedElements }
          }));
        }
      });
    })();
  `;
  document.head.appendChild(script);
  script.remove();
}
```

## 3. MutationObserver Approach

Monitor DOM changes to detect selection state changes:

```javascript
function setupMutationObserver() {
  // Watch for changes in the Excalidraw container
  const targetNode = document.querySelector('.excalidraw-container') || 
                     document.querySelector('[class*="excalidraw"]');
  
  if (!targetNode) {
    console.log('Excalidraw container not found');
    return;
  }
  
  const config = {
    attributes: true,
    childList: true,
    subtree: true,
    attributeOldValue: true
  };
  
  const callback = (mutationsList) => {
    for (const mutation of mutationsList) {
      // Look for selection-related changes
      if (mutation.type === 'attributes') {
        // Check for aria-selected or data attributes
        if (mutation.attributeName === 'aria-selected' ||
            mutation.attributeName?.includes('selected')) {
          console.log('Selection change detected:', mutation);
        }
      }
      
      // Check for class changes that might indicate selection
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        const classes = mutation.target.className;
        if (classes.includes('selected') || classes.includes('active')) {
          console.log('Selected element:', mutation.target);
        }
      }
    }
  };
  
  const observer = new MutationObserver(callback);
  observer.observe(targetNode, config);
}
```

## 4. Canvas Event Interception

Intercept canvas pointer events to track selection:

```javascript
function interceptCanvasEvents() {
  const script = document.createElement('script');
  script.textContent = `
    (function() {
      const canvas = document.querySelector('canvas.interactive') || 
                     document.querySelector('canvas');
      
      if (!canvas) return;
      
      // Store original methods
      const originalAddEventListener = canvas.addEventListener;
      const originalDispatchEvent = canvas.dispatchEvent;
      
      // Track selection events
      canvas.addEventListener = function(type, listener, options) {
        if (type === 'pointerdown' || type === 'pointerup' || 
            type === 'pointermove') {
          // Wrap the original listener
          const wrappedListener = function(event) {
            // Log selection-related events
            console.log('Canvas event:', type, event);
            
            // Call original listener
            listener.call(this, event);
            
            // Try to get state after event
            setTimeout(() => {
              const state = window.getExcalidrawState?.();
              if (state) {
                console.log('State after event:', state);
              }
            }, 0);
          };
          
          return originalAddEventListener.call(this, type, wrappedListener, options);
        }
        
        return originalAddEventListener.call(this, type, listener, options);
      };
    })();
  `;
  document.head.appendChild(script);
  script.remove();
}
```

## 5. Proxy-based State Tracking

Use JavaScript Proxy to intercept state changes:

```javascript
function setupStateProxy() {
  const script = document.createElement('script');
  script.textContent = `
    (function() {
      // Function to create a proxy for tracking state changes
      function createStateProxy(target, path = '') {
        return new Proxy(target, {
          set(obj, prop, value) {
            const fullPath = path ? \`\${path}.\${prop}\` : prop;
            
            // Track selectedElementIds changes
            if (prop === 'selectedElementIds' || fullPath.includes('selectedElementIds')) {
              console.log('Selection changed:', value);
              window.dispatchEvent(new CustomEvent('selectionChange', {
                detail: { selectedElementIds: value }
              }));
            }
            
            // Set the value
            obj[prop] = value;
            return true;
          },
          get(obj, prop) {
            const value = obj[prop];
            if (typeof value === 'object' && value !== null) {
              return createStateProxy(value, path ? \`\${path}.\${prop}\` : prop);
            }
            return value;
          }
        });
      }
      
      // Try to hook into React component lifecycle
      const originalSetState = React.Component.prototype.setState;
      React.Component.prototype.setState = function(updater, callback) {
        // Check if this is an Excalidraw component
        if (this.state && this.state.selectedElementIds !== undefined) {
          console.log('Excalidraw setState called:', updater);
        }
        return originalSetState.call(this, updater, callback);
      };
    })();
  `;
  document.head.appendChild(script);
  script.remove();
}
```

## 6. Integration Approach

Combine multiple approaches for robustness:

```javascript
// Main content script
async function initializeExcalidrawAccess() {
  // Inject all detection scripts
  injectScript();
  checkExcalidrawAPI();
  setupMutationObserver();
  interceptCanvasEvents();
  setupStateProxy();
  
  // Set up communication between page and content script
  window.addEventListener('excalidrawState', (event) => {
    console.log('Received Excalidraw state:', event.detail);
    // Process the state data
    if (event.detail) {
      handleExcalidrawState(event.detail);
    }
  });
  
  // Periodically check for state
  setInterval(() => {
    window.dispatchEvent(new Event('getExcalidrawState'));
    window.dispatchEvent(new Event('getExcalidrawElements'));
  }, 1000);
}

function handleExcalidrawState(state) {
  const { selectedElementIds, elements } = state;
  
  // Filter selected elements
  const selectedElements = elements?.filter(el => 
    selectedElementIds && selectedElementIds[el.id]
  );
  
  console.log('Selected elements:', selectedElements);
  
  // Update UI or perform operations
  updateBooleanOperationsUI(selectedElements);
}
```

## Recommendations

1. **React DevTools Hook**: Most reliable for accessing React component state
2. **API Detection**: Cleanest approach if Excalidraw exposes a global API
3. **MutationObserver**: Good for detecting UI changes but may not give direct access to state
4. **Canvas Events**: Useful for tracking user interactions
5. **Combined Approach**: Use multiple methods for better reliability

## Notes

- Content scripts run in an isolated world, so we need to inject scripts into the page context
- The specific implementation depends on Excalidraw's version and how it's built
- Some approaches may break with Excalidraw updates
- Always check for null/undefined values and handle errors gracefully