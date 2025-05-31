// Minimal content script for debug
console.log('Excalidraw Boolean Operations - Debug Mode');

// Wait for Excalidraw to load
function waitForExcalidraw() {
  const checkInterval = setInterval(() => {
    const app = document.querySelector('[class*="excalidraw-container"], .excalidraw, #root > div');
    if (app) {
      clearInterval(checkInterval);
      initializeDebug();
    }
  }, 1000);
}

function initializeDebug() {
  // Create debug buttons
  const container = document.createElement('div');
  container.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    display: flex;
    gap: 10px;
    z-index: 99999;
    flex-direction: column;
    align-items: flex-end;
  `;
  
  const buttonStyle = `
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 8px;
    font-family: -apple-system, sans-serif;
    font-size: 14px;
    font-weight: bold;
    cursor: pointer;
    min-width: 150px;
  `;
  
  // State reader button  
  const stateButton = document.createElement('button');
  stateButton.textContent = '📖 Read State';
  stateButton.style.cssText = buttonStyle + 'background: #9C27B0;';
  
  // Context explorer button
  const contextButton = document.createElement('button');
  contextButton.textContent = 'Explore Contexts';
  contextButton.style.cssText = buttonStyle + 'background: #00C853;';
  
  // Store hunter button
  const storeButton = document.createElement('button');
  storeButton.textContent = 'Hunt Store';
  storeButton.style.cssText = buttonStyle + 'background: #4444ff;';
  
  // Debug dump button
  const debugButton = document.createElement('button');
  debugButton.textContent = 'Debug Dump';
  debugButton.style.cssText = buttonStyle + 'background: #ff4444;';
  
  // Status div
  const statusDiv = document.createElement('div');
  statusDiv.style.cssText = `
    background: white;
    border: 2px solid #6965DB;
    padding: 10px 20px;
    border-radius: 8px;
    font-family: -apple-system, sans-serif;
    font-size: 14px;
    margin-top: 10px;
  `;
  statusDiv.textContent = 'Waiting for selection...';
  
  stateButton.addEventListener('click', () => {
    console.clear();
    injectScript('scripts/state-reader.js');
  });
  
  contextButton.addEventListener('click', () => {
    console.clear();
    injectScript('scripts/context-explorer.js');
  });
  
  storeButton.addEventListener('click', () => {
    console.clear();
    injectScript('scripts/store-hunter.js');
  });
  
  debugButton.addEventListener('click', () => {
    console.clear();
    injectScript('scripts/debug-dump.js');
  });
  
  container.appendChild(stateButton);
  container.appendChild(contextButton);
  container.appendChild(storeButton);
  container.appendChild(debugButton);
  container.appendChild(statusDiv);
  document.body.appendChild(container);
  
  // Listen for selection changes
  window.addEventListener('message', (event) => {
    if (event.data.type === 'EXCALIDRAW_SELECTION_CHANGED') {
      const { selectedIds, totalElements } = event.data;
      console.log('📨 Selection changed:', selectedIds);
      
      if (selectedIds.length === 0) {
        statusDiv.textContent = 'No shapes selected';
        statusDiv.style.borderColor = '#ccc';
      } else if (selectedIds.length === 1) {
        statusDiv.textContent = '1 shape selected! 🎯';
        statusDiv.style.borderColor = '#6965DB';
      } else {
        statusDiv.textContent = `${selectedIds.length} shapes selected`;
        statusDiv.style.borderColor = '#00C853';
      }
    }
  });
}

function injectScript(src) {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL(src);
  script.onload = function() {
    this.remove();
  };
  (document.head || document.documentElement).appendChild(script);
}

// Start
waitForExcalidraw();