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
  
  // Create validation feedback (hidden)
  const validationFeedback = document.createElement('div');
  validationFeedback.className = 'boolean-ops-validation';
  validationFeedback.style.display = 'none';
  document.body.appendChild(validationFeedback);
  
  // We'll inject buttons into the sidebar instead of creating a separate toolbar
  let booleanOpsInjected = false;
  let sidebarObserver = null;
  
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
  
  // Function to inject boolean ops into Excalidraw's sidebar
  function injectBooleanOpsIntoSidebar(isValid = false) {
    const checkAndInject = () => {
      // First, let's find the sidebar and understand its structure
      const sidebar = document.querySelector('.App-menu__left');
      if (!sidebar) {
        console.log('[Boolean Ops] Sidebar not found, retrying...');
        setTimeout(checkAndInject, 500);
        return;
      }
      
      // Log the sidebar structure to understand it better
      console.log('[Boolean Ops] Sidebar found:', sidebar);
      
      // Try multiple ways to find sections
      let sections = sidebar.querySelectorAll('.Island');
      if (sections.length === 0) {
        sections = sidebar.querySelectorAll('[class*="Island"]');
      }
      if (sections.length === 0) {
        sections = sidebar.querySelectorAll('section');
      }
      if (sections.length === 0) {
        sections = sidebar.children;
      }
      
      console.log('[Boolean Ops] Found', sections.length, 'sections');
      
      Array.from(sections).forEach((section, index) => {
        const buttons = section.querySelectorAll('button');
        const labels = Array.from(buttons).map(b => b.getAttribute('aria-label') || b.getAttribute('title') || b.textContent?.trim()).filter(Boolean);
        if (labels.length > 0) {
          console.log(`[Boolean Ops] Section ${index}:`, labels.slice(0, 3).join(', ') + (labels.length > 3 ? '...' : ''));
        }
      });
      
      // Find the bottom section - work backwards through sections
      let actionsSection = null;
      const allSections = Array.from(sections);
      
      // Look for the last section that has buttons
      for (let i = allSections.length - 1; i >= 0; i--) {
        const section = allSections[i];
        const hasButtons = section.querySelector('button');
        const hasColorPicker = section.querySelector('input[type="color"], [aria-label*="color" i], [aria-label*="Color"]');
        
        if (hasButtons && !hasColorPicker) {
          actionsSection = section;
          console.log('[Boolean Ops] Found bottom action section at index', i);
          break;
        }
      }
      
      // If still not found, try specific selectors
      if (!actionsSection) {
        const bottomSelectors = [
          '.App-menu__left .Island:last-child',
          '.App-menu__left > div:last-child',
          '[class*="footer"]',
          '[class*="actions"]'
        ];
        
        for (const selector of bottomSelectors) {
          actionsSection = sidebar.querySelector(selector);
          if (actionsSection && actionsSection.querySelector('button')) {
            console.log('[Boolean Ops] Found section with selector:', selector);
            break;
          }
        }
      }
      
      if (!actionsSection) {
        console.log('[Boolean Ops] Could not find suitable action section, retrying...');
        setTimeout(checkAndInject, 500);
        return;
      }
      
      // Create boolean ops container as fieldset like native sections
      const booleanOpsContainer = document.createElement('fieldset');
      booleanOpsContainer.className = 'boolean-ops-container';
      booleanOpsContainer.style.display = 'none';
      
      // Add legend like native sections
      const legend = document.createElement('legend');
      legend.textContent = 'Boolean ops';
      booleanOpsContainer.appendChild(legend);
      
      // Create button container using native buttonList class
      const buttonRow = document.createElement('div');
      buttonRow.className = 'buttonList';
      
      // Create buttons with SVGs from diff.diff
      const operations = [
        { 
          op: 'union', 
          title: 'Union (Alt++)', 
          path: 'M320 0a192 192 0 00-181.02 128H48c-26.51 0-48 21.49-48 48v288c0 26.51 21.49 48 48 48h288c26.51 0 48-21.49 48-48v-90.98A192 192 0 00512 192 192 192 0 00320 0z' 
        },
        { 
          op: 'intersection', 
          title: 'Intersection (Alt+*)', 
          paths: [
            { path: 'M48 128c-26.51 0-48 21.49-48 48v2.725h46.174a38.914 38.914 0 0110.443-8.668V128zm72.617 0v37h9.291a192 192 0 019.072-37zM0 242.725v42.668h37v-42.668zm0 106.668v42.666h37v-42.666zm384 23.627a192 192 0 01-37 9.072v9.967h37zM0 456.059V464c0 26.51 21.49 48 48 48h8.617v-42.059a38.927 38.927 0 01-14.17-13.882zm341.553 0a38.927 38.927 0 01-7.543 9.13V512H336c26.51 0 48-21.49 48-48v-7.941zM120.617 475v37h42.697v-37zm106.697 0v37h42.696v-37z', fill: '#fba94d' },
            { path: 'M287.547 0a194.725 194.725 0 00-80.365 33.285l27.006 27.006a157.2 157.2 0 0153.359-22.102V0zm64.908 0v38.19a157.2 157.2 0 0153.358 22.101l27.005-27.006A194.725 194.725 0 00352.455 0zm126.26 79.182l-27.004 27.004a157.2 157.2 0 0122.101 53.36H512a194.725 194.725 0 00-33.285-80.364zm-317.428.002A194.725 194.725 0 00128 159.547h38.19a157.2 157.2 0 0122.101-53.36l-27.004-27.003zm312.525 145.271a157.2 157.2 0 01-22.103 53.357l27.006 27.006A194.725 194.725 0 00512 224.455h-38.188zm-68 99.256a157.2 157.2 0 01-53.357 22.101V384a194.725 194.725 0 0080.361-33.285l-27.003-27.004z', fill: '#fba94d' },
            { path: 'M138.982 128A192 192 0 00128 192a192 192 0 00192 192 192 192 0 0064-10.98V176c0-26.51-21.49-48-48-48z', fill: 'currentColor' }
          ]
        },
        { 
          op: 'difference', 
          title: 'Difference (Alt+-)', 
          paths: [
            { path: 'M48 128c-26.51 0-48 21.49-48 48v288c0 26.51 21.49 48 48 48h288c26.51 0 48-21.49 48-48v-90.98A192 192 0 01320 384a192 192 0 01-192-192 192 192 0 0110.98-64z', fill: 'currentColor' },
            { path: 'M290.233 0a194.725 194.725 0 00-80.364 33.286l27.005 27.005a157.2 157.2 0 0153.36-22.102zm64.909 0v38.189A157.2 157.2 0 01408.5 60.29l27.004-27.005A194.725 194.725 0 00355.142 0zM481.4 79.182l-27.002 27.003a157.2 157.2 0 0122.102 53.362h38.187A194.725 194.725 0 00481.4 79.182zm-317.425.002a194.725 194.725 0 00-33.288 80.363h38.188a157.2 157.2 0 0122.102-53.36zm-33.288 145.271a194.725 194.725 0 0033.286 80.363l27.004-27.005a157.2 157.2 0 01-22.102-53.358zm345.813 0a157.2 157.2 0 01-22.104 53.358l27.004 27.005a194.725 194.725 0 0033.287-80.363zm-239.626 99.256l-27.003 27.003A194.725 194.725 0 00290.233 384v-38.189a157.2 157.2 0 01-53.36-22.1zm171.626 0a157.2 157.2 0 01-53.358 22.102V384a194.725 194.725 0 0080.36-33.286z', fill: '#fba94d' }
          ]
        },
        { 
          op: 'exclusion', 
          title: 'Exclusion (Alt+^)', 
          path: 'M320 0a192 192 0 00-181.02 128H336c26.51 0 48 21.49 48 48v197.02A192 192 0 00512 192 192 192 0 00320 0zm64 373.02A192 192 0 01320 384a192 192 0 01-192-192 192 192 0 0110.98-64H48c-26.51 0-48 21.49-48 48v288c0 26.51 21.49 48 48 48h288c26.51 0 48-21.49 48-48v-90.98z' 
        }
      ];
      
      operations.forEach((opConfig) => {
        const { op, title } = opConfig;
        const button = document.createElement('button');
        
        // Use native Excalidraw button classes
        button.className = 'ToolIcon_type_button ToolIcon_size_medium ToolIcon_type_button--show ToolIcon';
        
        button.dataset.op = op;
        button.title = title;
        button.type = 'button';
        button.setAttribute('aria-label', title);
        
        // Create inner icon wrapper like native buttons
        const iconWrapper = document.createElement('div');
        iconWrapper.className = 'ToolIcon__icon';
        iconWrapper.setAttribute('aria-hidden', 'true');
        iconWrapper.setAttribute('aria-disabled', 'false');
        
        console.log('[Boolean Ops] Using native ToolIcon button classes');
        
        // Handle single path or multiple paths
        if (opConfig.path) {
          iconWrapper.innerHTML = `
            <svg aria-hidden="true" focusable="false" role="img" viewBox="0 0 512 512" class="" fill="currentColor">
              <path d="${opConfig.path}"/>
            </svg>
          `;
        } else if (opConfig.paths) {
          // Replace the orange color with a brighter one for dark mode
          const pathElements = opConfig.paths.map(p => {
            const fill = p.fill === '#fba94d' ? '#ffb84d' : (p.fill || 'currentColor');
            return `<path d="${p.path}" fill="${fill}"/>`;
          }).join('\n');
          iconWrapper.innerHTML = `
            <svg aria-hidden="true" focusable="false" role="img" viewBox="0 0 512 512" class="">
              ${pathElements}
            </svg>
          `;
        }
        
        button.appendChild(iconWrapper);
        
        // Add click handler
        button.addEventListener('click', () => {
          if (validationInfo && validationInfo.isValid) {
            performBooleanOperation(op);
          }
        });
        
        buttonRow.appendChild(button);
      });
      
      booleanOpsContainer.appendChild(buttonRow);
      
      // Add a unique ID to track our container
      booleanOpsContainer.id = 'excalidraw-boolean-ops-ext';
      
      // Try different injection strategies
      let injected = false;
      
      // First, check if we're already injected
      const existing = document.getElementById('excalidraw-boolean-ops-ext');
      if (existing) {
        console.log('[Boolean Ops] Already injected, updating visibility');
        existing.style.display = isValid ? 'flex' : 'none';
        return;
      }
      
      // Make sure we're not in the color section
      const hasColorPicker = actionsSection.querySelector('[aria-label*="color"], [aria-label*="Color"], input[type="color"]');
      if (hasColorPicker) {
        console.log('[Boolean Ops] Skipping color section, looking for bottom section...');
        // Try to find the actual bottom actions section
        const allSections = document.querySelectorAll('.App-menu__left > .Island, .App-menu__left > section');
        for (let i = allSections.length - 1; i >= 0; i--) {
          const section = allSections[i];
          // Look for sections with action buttons but no color pickers
          if (section.querySelector('button') && !section.querySelector('input[type="color"]')) {
            actionsSection = section;
            console.log('[Boolean Ops] Found bottom action section');
            break;
          }
        }
      }
      
      if (!actionsSection) {
        console.log('[Boolean Ops] Could not find suitable section');
        setTimeout(checkAndInject, 500);
        return;
      }
      
      // Now inject into the bottom section
      // Look for the content area within the section
      let targetContainer = actionsSection.querySelector('[class*="Island_content"], .Island_content__sLouC');
      
      if (!targetContainer) {
        // If no content area, use the section itself
        targetContainer = actionsSection;
      }
      
      // Append container directly without spacing
      targetContainer.appendChild(booleanOpsContainer);
      injected = true;
      
      if (injected) {
        booleanOpsInjected = true;
        console.log('[Boolean Ops] Successfully injected');
        // Show immediately if valid
        booleanOpsContainer.style.display = isValid ? 'flex' : 'none';
        
        // Debug: log the DOM structure
        console.log('[Boolean Ops] Container parent:', booleanOpsContainer.parentElement);
        console.log('[Boolean Ops] Container visible:', window.getComputedStyle(booleanOpsContainer).display);
      }
    };
    
    checkAndInject();
  }
  
  // Function to update boolean ops visibility
  function updateBooleanOpsVisibility(isValid) {
    const container = document.querySelector('.boolean-ops-container');
    if (container) {
      container.style.display = isValid ? 'flex' : 'none';
    } else if (isValid) {
      // Container was removed, need to re-inject
      console.log('[Boolean Ops] Container not found, re-injecting...');
      booleanOpsInjected = false;
      injectBooleanOpsIntoSidebar(isValid);
    }
  }
  
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
      
      // Inject boolean ops into sidebar if not already done
      if (!booleanOpsInjected) {
        injectBooleanOpsIntoSidebar(validationInfo && validationInfo.isValid);
      }
      
      // Update button visibility based on validation
      updateBooleanOpsVisibility(validationInfo && validationInfo.isValid);
    } else if (event.data.type === 'DEBUG_STATE_RESULTS') {
      // Debug state results received
    } else if (event.data.type === 'BOOLEAN_OP_RESULT') {
      handleBooleanOpResult(event.data);
    } else if (event.data.type === 'EXCALIDRAW_UPDATE_SUCCESS') {
      // Toast disabled - operation completed successfully
    } else if (event.data.type === 'EXCALIDRAW_UPDATE_FAILED') {
      console.error('[Boolean Ops] Update failed:', event.data.error);
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
      element: element,
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
  
  // Check if shapes overlap (required for boolean operations)
  if (validation.isValid) {
    const shapesOverlap = checkShapesOverlap(validation.validShapes.map(s => s.element));
    if (!shapesOverlap) {
      validation.isValid = false;
      validation.message = 'Shapes must overlap for boolean operations';
      return validation;
    }
  }
  
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

// Check if shapes' bounding boxes overlap
function checkShapesOverlap(shapes) {
  if (shapes.length < 2) return false;
  
  // Get bounding box for each shape
  const getBounds = (shape) => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    if (shape.type === 'line' && shape.points) {
      // For polygons
      shape.points.forEach(point => {
        const x = shape.x + point[0];
        const y = shape.y + point[1];
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      });
    } else if (['rectangle', 'ellipse', 'diamond'].includes(shape.type)) {
      // For regular shapes
      minX = shape.x;
      minY = shape.y;
      maxX = shape.x + shape.width;
      maxY = shape.y + shape.height;
    }
    
    return { minX, minY, maxX, maxY };
  };
  
  // Check if any pair of shapes overlaps
  for (let i = 0; i < shapes.length - 1; i++) {
    for (let j = i + 1; j < shapes.length; j++) {
      const bounds1 = getBounds(shapes[i]);
      const bounds2 = getBounds(shapes[j]);
      
      // Check for bounding box overlap
      const overlapX = bounds1.maxX > bounds2.minX && bounds2.maxX > bounds1.minX;
      const overlapY = bounds1.maxY > bounds2.minY && bounds2.maxY > bounds1.minY;
      
      if (overlapX && overlapY) {
        return true; // At least one pair overlaps
      }
    }
  }
  
  return false; // No overlapping shapes found
}

function updateValidationFeedback(feedbackElement, validation) {
  // Hide validation feedback UI - log to console instead
  feedbackElement.style.display = 'none';
  
  if (validation && validation.message) {
    console.log('[Boolean Ops Validation]', validation.message, validation.isValid ? '✓' : '✗');
  }
}

async function performBooleanOperation(operation) {
  if (!validationInfo || !validationInfo.isValid) {
    console.log('[Boolean Ops] Invalid selection for operation');
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
    // Remove loading state
    document.querySelectorAll('.boolean-op-btn.loading').forEach(btn => {
      btn.classList.remove('loading');
    });
  }
}

// Toast notifications removed - using console logging instead

// Handle boolean operation results
function handleBooleanOpResult(data) {
  // Remove loading state from all buttons
  document.querySelectorAll('.boolean-op-btn.loading').forEach(btn => {
    btn.classList.remove('loading');
  });
  
  if (!data.success) {
    console.error('[Boolean Ops] Operation failed:', data.error);
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