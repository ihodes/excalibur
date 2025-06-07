// Excalidraw Boolean Operations Extension

// State tracking
let currentElements = [];
let currentSelectedIds = {};
let validationInfo = null;

// Wait for Excalidraw to load
function waitForExcalidraw() {
  const checkInterval = setInterval(() => {
    const app = document.querySelector('[class*="excalidraw-container"], .excalidraw, #root > div');
    if (app) {
      clearInterval(checkInterval);
      initializeBooleanOperations();
    }
  }, 1000);
}

function initializeBooleanOperations() {
  // Load boolean operations implementation
  const boolOpsScript = document.createElement('script');
  boolOpsScript.src = chrome.runtime.getURL('scripts/boolean-operations.js');
  boolOpsScript.onload = function() {
    console.log('[Extension] Boolean operations loaded');
    initializeBooleanOperationsCore();
  };
  boolOpsScript.onerror = function() {
    console.error('[Boolean Ops] Failed to load boolean operations');
    showToast('Failed to load required library', 'error');
  };
  document.head.appendChild(boolOpsScript);
}

function initializeBooleanOperationsCore() {
  // Inject state monitor
  injectStateMonitor();
  
  // Wait a bit to ensure override is complete, then inject other scripts
  setTimeout(() => {
    // Inject perform operation handler
    const performScript = document.createElement('script');
    performScript.src = chrome.runtime.getURL('scripts/perform-operation.js');
    document.head.appendChild(performScript);
    
    // Inject update handler
    const updateScript = document.createElement('script');
    updateScript.src = chrome.runtime.getURL('scripts/update-excalidraw.js');
    document.head.appendChild(updateScript);
  }, 100);
  
  // Create validation feedback
  const validationFeedback = document.createElement('div');
  validationFeedback.className = 'boolean-ops-validation';
  validationFeedback.style.display = 'none';
  document.body.appendChild(validationFeedback);
  
  // Create the toolbar (hidden by default)
  const toolbar = document.createElement('div');
  toolbar.className = 'boolean-ops-toolbar';
  toolbar.style.display = 'none';
  toolbar.innerHTML = `
    <div class="boolean-ops-buttons">
      <button class="boolean-op-btn" data-op="union" title="Union — Alt++">
        <svg width="20" height="20" viewBox="0 0 512 512" fill="none">
          <path d="M320 0a192 192 0 00-181.02 128H48c-26.51 0-48 21.49-48 48v288c0 26.51 21.49 48 48 48h288c26.51 0 48-21.49 48-48v-90.98A192 192 0 00512 192 192 192 0 00320 0z" fill="#6965DB"/>
        </svg>
        Union
      </button>
      <button class="boolean-op-btn" data-op="intersection" title="Intersection — Alt+*">
        <svg width="20" height="20" viewBox="0 0 512 512" fill="none">
          <path d="M48 128c-26.51 0-48 21.49-48 48v2.725h46.174a38.914 38.914 0 0110.443-8.668V128zm72.617 0v37h9.291a192 192 0 019.072-37zM0 242.725v42.668h37v-42.668zm0 106.668v42.666h37v-42.666zm384 23.627a192 192 0 01-37 9.072v9.967h37zM0 456.059V464c0 26.51 21.49 48 48 48h8.617v-42.059a38.927 38.927 0 01-14.17-13.882zm341.553 0a38.927 38.927 0 01-7.543 9.13V512H336c26.51 0 48-21.49 48-48v-7.941zM120.617 475v37h42.697v-37zm106.697 0v37h42.696v-37z" fill="#fba94d"/>
          <path d="M287.547 0a194.725 194.725 0 00-80.365 33.285l27.006 27.006a157.2 157.2 0 0153.359-22.102V0zm64.908 0v38.19a157.2 157.2 0 0153.358 22.101l27.005-27.006A194.725 194.725 0 00352.455 0zm126.26 79.182l-27.004 27.004a157.2 157.2 0 0122.101 53.36H512a194.725 194.725 0 00-33.285-80.364zm-317.428.002A194.725 194.725 0 00128 159.547h38.19a157.2 157.2 0 0122.101-53.36l-27.004-27.003zm312.525 145.271a157.2 157.2 0 01-22.103 53.357l27.006 27.006A194.725 194.725 0 00512 224.455h-38.188zm-68 99.256a157.2 157.2 0 01-53.357 22.101V384a194.725 194.725 0 0080.361-33.285l-27.003-27.004z" fill="#fba94d"/>
          <path d="M138.982 128A192 192 0 00128 192a192 192 0 00192 192 192 192 0 0064-10.98V176c0-26.51-21.49-48-48-48z" fill="#6965DB"/>
        </svg>
        Intersect
      </button>
      <button class="boolean-op-btn" data-op="difference" title="Difference — Alt+-">
        <svg width="20" height="20" viewBox="0 0 512 512" fill="none">
          <path d="M48 128c-26.51 0-48 21.49-48 48v288c0 26.51 21.49 48 48 48h288c26.51 0 48-21.49 48-48v-90.98A192 192 0 01320 384a192 192 0 01-192-192 192 192 0 0110.98-64z" fill="#6965DB"/>
          <path d="M290.233 0a194.725 194.725 0 00-80.364 33.286l27.005 27.005a157.2 157.2 0 0153.36-22.102zm64.909 0v38.189A157.2 157.2 0 01408.5 60.29l27.004-27.005A194.725 194.725 0 00355.142 0zM481.4 79.182l-27.002 27.003a157.2 157.2 0 0122.102 53.362h38.187A194.725 194.725 0 00481.4 79.182zm-317.425.002a194.725 194.725 0 00-33.288 80.363h38.188a157.2 157.2 0 0122.102-53.36zm-33.288 145.271a194.725 194.725 0 0033.286 80.363l27.004-27.005a157.2 157.2 0 01-22.102-53.358zm345.813 0a157.2 157.2 0 01-22.104 53.358l27.004 27.005a194.725 194.725 0 0033.287-80.363zm-239.626 99.256l-27.003 27.003A194.725 194.725 0 00290.233 384v-38.189a157.2 157.2 0 01-53.36-22.1zm171.626 0a157.2 157.2 0 01-53.358 22.102V384a194.725 194.725 0 0080.36-33.286z" fill="#fba94d"/>
        </svg>
        Difference
      </button>
      <button class="boolean-op-btn" data-op="exclusion" title="Exclusion — Alt+^">
        <svg width="20" height="20" viewBox="0 0 512 512" fill="none">
          <path d="M320 0a192 192 0 00-181.02 128H336c26.51 0 48 21.49 48 48v197.02A192 192 0 00512 192 192 192 0 00320 0zm64 373.02A192 192 0 01320 384a192 192 0 01-192-192 192 192 0 0110.98-64H48c-26.51 0-48 21.49-48 48v288c0 26.51 21.49 48 48 48h288c26.51 0 48-21.49 48-48v-90.98z" fill="#6965DB"/>
        </svg>
        Exclusion
      </button>
    </div>
  `;
  
  document.body.appendChild(toolbar);
  
  // Add keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.altKey && !e.ctrlKey && !e.metaKey) {
      let operation = null;
      
      if (e.key === '+' || e.key === '=' || e.code === 'Equal') {
        operation = 'union';
      } else if (e.key === '-' || e.key === '_' || e.code === 'Minus') {
        operation = 'difference';
      } else if (e.key === '*' || (e.shiftKey && e.code === 'Digit8')) {
        operation = 'intersection';
      } else if (e.key === '^' || (e.shiftKey && e.code === 'Digit6')) {
        operation = 'exclusion';
      }
      
      if (operation && validationInfo && validationInfo.isValid) {
        e.preventDefault();
        e.stopPropagation();
        performBooleanOperation(operation);
      }
    }
  }, true);
  
  // Visual feedback for Alt key
  let altPressed = false;
  document.addEventListener('keydown', (e) => {
    if (e.altKey && !altPressed) {
      altPressed = true;
      toolbar.classList.add('alt-pressed');
    }
  });
  
  document.addEventListener('keyup', (e) => {
    if (!e.altKey && altPressed) {
      altPressed = false;
      toolbar.classList.remove('alt-pressed');
    }
  });
  
  // Add click handlers
  toolbar.querySelectorAll('.boolean-op-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const operation = btn.dataset.op;
      if (validationInfo && validationInfo.isValid) {
        performBooleanOperation(operation);
      }
    });
  });
  
  // Listen for state updates
  window.addEventListener('message', (event) => {
    if (event.data.type === 'EXCALIDRAW_STATE_UPDATE') {
      const { selectedIds, elements, appState } = event.data;
      currentSelectedIds = {};
      selectedIds.forEach(id => { currentSelectedIds[id] = true; });
      currentElements = elements || [];
      
      // Validate selected shapes
      validationInfo = validateSelectedShapes(currentElements, currentSelectedIds);
      // Update validation feedback
      updateValidationFeedback(validationFeedback, validationInfo);
      
      // Update toolbar visibility and state
      if (validationInfo && validationInfo.selectedCount >= 2) {
        toolbar.style.display = 'block';
        toolbar.classList.add('show');
        
        // Enable/disable buttons based on validation
        toolbar.querySelectorAll('.boolean-op-btn').forEach(btn => {
          if (validationInfo.isValid) {
            btn.removeAttribute('disabled');
            btn.classList.remove('disabled');
          } else {
            btn.setAttribute('disabled', 'true');
            btn.classList.add('disabled');
          }
        });
      } else {
        toolbar.classList.remove('show');
        setTimeout(() => {
          if (!toolbar.classList.contains('show')) {
            toolbar.style.display = 'none';
          }
        }, 200);
        validationFeedback.style.display = 'none';
      }
    } else if (event.data.type === 'DEBUG_STATE_RESULTS') {
      // Debug state results received
    } else if (event.data.type === 'BOOLEAN_OP_RESULT') {
      handleBooleanOpResult(event.data);
    } else if (event.data.type === 'EXCALIDRAW_UPDATE_SUCCESS') {
      showToast('Boolean operation completed', 'success');
    } else if (event.data.type === 'EXCALIDRAW_UPDATE_FAILED') {
      console.error('[Boolean Ops] Update failed:', event.data.error);
      showToast('Failed to update canvas', 'error');
    } else if (event.data.type === 'REQUEST_DEBUG_STATE') {
      injectDebugState();
    }
  });
  
  // Add debug keyboard shortcut (Cmd+Shift+> on Mac, Ctrl+Shift+> on Windows)
  document.addEventListener('keydown', (e) => {
    
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === '>' || e.key === '.')) {
      e.preventDefault();
      injectDebugState();
    }
  });
}

function injectStateMonitor() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('scripts/state-monitor.js');
  script.onload = function() {
    this.remove();
  };
  (document.head || document.documentElement).appendChild(script);
}

function injectDebugState() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('scripts/debug-state.js');
  script.onload = function() {
    this.remove();
  };
  (document.head || document.documentElement).appendChild(script);
}

function validateSelectedShapes(elements, selectedIds) {
  const selectedElements = elements.filter(el => 
    selectedIds[el.id] && !el.isDeleted
  );
  
  const validation = {
    selectedCount: selectedElements.length,
    isValid: false,
    validShapes: [],
    invalidShapes: [],
    message: ''
  };
  
  if (selectedElements.length < 2) {
    validation.message = 'Select at least 2 shapes';
    return validation;
  }
  
  // Categorize shapes
  selectedElements.forEach(element => {
    const shapeInfo = {
      id: element.id,
      type: element.type,
      isValid: false,
      reason: ''
    };
    
    if (['arrow', 'text', 'freedraw', 'image'].includes(element.type)) {
      shapeInfo.reason = `${element.type} elements cannot be used`;
      validation.invalidShapes.push(shapeInfo);
    } else if (element.type === 'line') {
      const points = element.points;
      if (!points || points.length < 3) {
        shapeInfo.reason = 'Line must have at least 3 points';
        validation.invalidShapes.push(shapeInfo);
      } else {
        const first = points[0];
        const last = points[points.length - 1];
        const isClosed = Math.abs(first[0] - last[0]) < 1 && Math.abs(first[1] - last[1]) < 1;
        
        if (isClosed) {
          shapeInfo.isValid = true;
          shapeInfo.displayType = 'polygon';
          validation.validShapes.push(shapeInfo);
        } else {
          shapeInfo.reason = 'Line must be closed';
          validation.invalidShapes.push(shapeInfo);
        }
      }
    } else if (['rectangle', 'ellipse', 'diamond'].includes(element.type)) {
      shapeInfo.isValid = true;
      shapeInfo.displayType = element.type;
      validation.validShapes.push(shapeInfo);
    } else {
      shapeInfo.reason = `Unknown type: ${element.type}`;
      validation.invalidShapes.push(shapeInfo);
    }
  });
  
  // Set validation status
  validation.isValid = validation.validShapes.length >= 2;
  
  // Generate message
  if (validation.isValid) {
    const typeCounts = {};
    validation.validShapes.forEach(shape => {
      const type = shape.displayType || shape.type;
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });
    
    const typeStrings = Object.entries(typeCounts).map(([type, count]) => 
      count > 1 ? `${count} ${type}s` : `1 ${type}`
    );
    
    validation.message = `${typeStrings.join(', ')} selected ✓`;
  } else if (validation.validShapes.length === 1) {
    validation.message = 'Need at least 2 valid shapes';
  } else if (validation.invalidShapes.length > 0) {
    validation.message = validation.invalidShapes[0].reason;
  }
  
  return validation;
}

function updateValidationFeedback(feedbackElement, validation) {
  if (!validation || validation.selectedCount === 0) {
    feedbackElement.style.display = 'none';
    return;
  }
  
  if (validation.selectedCount >= 2) {
    feedbackElement.style.display = 'block';
    feedbackElement.className = `boolean-ops-validation ${validation.isValid ? 'valid' : 'invalid'}`;
    feedbackElement.textContent = validation.message;
  } else {
    feedbackElement.style.display = 'none';
  }
}

async function performBooleanOperation(operation) {
  if (!validationInfo || !validationInfo.isValid) {
    showToast('Please select at least 2 valid shapes', 'error');
    return;
  }
  
  // Get valid elements
  const validIds = validationInfo.validShapes.map(shape => shape.id);
  const validElements = currentElements.filter(el => 
    validIds.includes(el.id) && !el.isDeleted
  );
  
  // Show loading state
  const button = document.querySelector(`.boolean-op-btn[data-op="${operation}"]`);
  if (button) {
    button.classList.add('loading');
  }
  
  try {
    // Send message to perform operation
    window.postMessage({
      type: 'PERFORM_BOOLEAN_OP',
      elements: validElements,
      operation: operation,
      validIds: validIds
    }, '*');
  } catch (error) {
    console.error('[Boolean Ops] Error:', error);
    showToast('Failed to perform boolean operation', 'error');
    // Remove loading state
    document.querySelectorAll('.boolean-op-btn.loading').forEach(btn => {
      btn.classList.remove('loading');
    });
  }
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `boolean-ops-toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Handle boolean operation results
function handleBooleanOpResult(data) {
  // Remove loading state from all buttons
  document.querySelectorAll('.boolean-op-btn.loading').forEach(btn => {
    btn.classList.remove('loading');
  });
  
  if (!data.success) {
    console.error('[Boolean Ops] Operation failed:', data.error);
    showToast(data.error || 'Boolean operation failed', 'error');
    return;
  }
  
  const { elements, operation, originalIds } = data;
  
  // Send message to update Excalidraw
  window.postMessage({
    type: 'UPDATE_EXCALIDRAW_ELEMENTS',
    newElements: elements,  // Changed from newElement to newElements
    originalIds: originalIds
  }, '*');
}

// Start
waitForExcalidraw();

// Load scale handler
setTimeout(() => {
  const scaleScript = document.createElement('script');
  scaleScript.src = chrome.runtime.getURL('scripts/scale-handler.js');
  document.head.appendChild(scaleScript);
}, 1500);

// For easier debugging, inject the debug helper
setTimeout(() => {
  const debugScript = document.createElement('script');
  debugScript.src = chrome.runtime.getURL('scripts/debug-helper.js');
  document.head.appendChild(debugScript);
}, 1000);