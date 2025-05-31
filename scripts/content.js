// Excalidraw Boolean Operations Extension
console.log('Excalidraw Boolean Operations extension loaded');

// State tracking
let lastSelectedCount = 0;

// Wait for Excalidraw to load
function waitForExcalidraw() {
  const checkInterval = setInterval(() => {
    const app = document.querySelector('[class*="excalidraw-container"], .excalidraw, #root > div');
    if (app) {
      clearInterval(checkInterval);
      console.log('Excalidraw detected, initializing boolean operations...');
      initializeBooleanOperations();
    }
  }, 1000);
}

function initializeBooleanOperations() {
  console.log('Boolean operations initialized');
  
  // Inject selection detector script
  injectSelectionDetector();
  
  // Create minimal UI for now - just a status div
  const statusDiv = document.createElement('div');
  statusDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: white;
    border: 2px solid #6965DB;
    padding: 10px 20px;
    border-radius: 8px;
    font-family: -apple-system, sans-serif;
    font-size: 14px;
    z-index: 99999;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  `;
  statusDiv.textContent = 'Waiting for selection...';
  document.body.appendChild(statusDiv);
  
  // Listen for selection changes from injected script
  window.addEventListener('message', (event) => {
    if (event.data.type === 'EXCALIDRAW_SELECTION_CHANGED') {
      const { selectedIds, totalElements } = event.data;
      console.log('📨 Selection changed message received:', {
        selectedIds,
        totalElements
      });
      
      if (selectedIds.length !== lastSelectedCount) {
        lastSelectedCount = selectedIds.length;
        
        if (selectedIds.length === 0) {
          statusDiv.textContent = 'No shapes selected';
          statusDiv.style.borderColor = '#ccc';
        } else if (selectedIds.length === 1) {
          statusDiv.textContent = '1 shape selected! 🎯';
          statusDiv.style.borderColor = '#6965DB';
          console.log('🎉 ONE SHAPE SELECTED! ID:', selectedIds[0]);
        } else {
          statusDiv.textContent = `${selectedIds.length} shapes selected`;
          statusDiv.style.borderColor = '#00C853';
        }
      }
    }
  });
}

function injectSelectionDetector() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('scripts/selection-detector.js');
  script.onload = function() {
    console.log('Selection detector script injected successfully');
    this.remove();
  };
  script.onerror = function() {
    console.error('Failed to load selection detector script');
  };
  (document.head || document.documentElement).appendChild(script);
}

// Start watching for Excalidraw
waitForExcalidraw();