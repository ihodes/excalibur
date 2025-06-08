// Scale handler integrated with sidebar
(function() {
  let scaleReference = null; // {elementId, pixelLength}
  let currentTooltip = null;
  let dimensionBox = null;
  let currentElement = null;
  let scaleUIInjected = false;
  let currentSelectedElements = [];
  let sidebarObserver = null;

  // Calculate line/arrow length
  function getLineLength(element) {
    if (!element || !element.points || element.points.length < 2) {
      return null;
    }

    if (element.type === 'line' || element.type === 'arrow') {
      // Calculate total length for multi-point lines
      let totalLength = 0;
      for (let i = 1; i < element.points.length; i++) {
        const p1 = element.points[i - 1];
        const p2 = element.points[i];
        const dx = p2[0] - p1[0];
        const dy = p2[1] - p1[1];
        totalLength += Math.sqrt(dx * dx + dy * dy);
      }
      return totalLength;
    }
    
    return null;
  }
  
  // Get element dimensions based on type
  function getElementDimensions(element) {
    if (!element) return null;
    
    switch (element.type) {
      case 'line':
      case 'arrow':
        const length = getLineLength(element);
        return length ? { type: 'linear', length } : null;
        
      case 'rectangle':
      case 'diamond':
      case 'ellipse':
        return {
          type: element.type === 'ellipse' ? 'ellipse' : 'box',
          width: Math.abs(element.width),
          height: Math.abs(element.height)
        };
        
      case 'freedraw':
      case 'polygon':
        // Calculate bounding box
        if (!element.points || element.points.length === 0) return null;
        
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        element.points.forEach(point => {
          minX = Math.min(minX, point[0]);
          minY = Math.min(minY, point[1]);
          maxX = Math.max(maxX, point[0]);
          maxY = Math.max(maxY, point[1]);
        });
        
        return {
          type: 'box',
          width: maxX - minX,
          height: maxY - minY
        };
        
      default:
        return null;
    }
  }

  // Remove tooltip functions - we'll use the dimension box instead
  function showTooltip(text, x, y) {
    // No-op - we don't want the black tooltip
  }

  function hideTooltip() {
    // No-op
  }


  // Scale element to target dimensions
  function scaleElement(element, targetDimensions) {
    if (!scaleReference || !element) return;
    
    const dims = getElementDimensions(element);
    if (!dims) return;
    
    let newElement = { ...element };
    const pixelsPerMm = scaleReference.pixelLength / scaleReference.mmLength;
    
    switch (element.type) {
      case 'line':
      case 'arrow':
        // Scale from first point
        const currentLength = dims.length;
        const targetPixels = targetDimensions.length * pixelsPerMm;
        const scaleFactor = targetPixels / currentLength;
        
        // Scale all points relative to the first point
        newElement.points = element.points.map((point, index) => {
          if (index === 0) return point; // Keep first point fixed
          return [
            element.points[0][0] + (point[0] - element.points[0][0]) * scaleFactor,
            element.points[0][1] + (point[1] - element.points[0][1]) * scaleFactor
          ];
        });
        break;
        
      case 'rectangle':
        // Scale from top-left corner
        newElement.width = targetDimensions.width * pixelsPerMm;
        newElement.height = targetDimensions.height * pixelsPerMm;
        break;
        
      case 'ellipse':
      case 'diamond':
        // Scale from center
        const widthScale = (targetDimensions.width * pixelsPerMm) / element.width;
        const heightScale = (targetDimensions.height * pixelsPerMm) / element.height;
        
        newElement.width = targetDimensions.width * pixelsPerMm;
        newElement.height = targetDimensions.height * pixelsPerMm;
        
        // Adjust position to keep center fixed
        newElement.x = element.x + (element.width - newElement.width) / 2;
        newElement.y = element.y + (element.height - newElement.height) / 2;
        break;
        
      case 'freedraw':
      case 'polygon':
        // Scale from bounding box center
        const currentWidth = dims.width;
        const currentHeight = dims.height;
        const targetWidth = targetDimensions.width * pixelsPerMm;
        const targetHeight = targetDimensions.height * pixelsPerMm;
        
        const xScale = targetWidth / currentWidth;
        const yScale = targetHeight / currentHeight;
        
        // Find center of bounding box
        let minX = Infinity, minY = Infinity;
        element.points.forEach(point => {
          minX = Math.min(minX, point[0]);
          minY = Math.min(minY, point[1]);
        });
        
        const centerX = minX + currentWidth / 2;
        const centerY = minY + currentHeight / 2;
        
        // Scale points from center
        newElement.points = element.points.map(point => [
          centerX + (point[0] - centerX) * xScale,
          centerY + (point[1] - centerY) * yScale
        ]);
        break;
    }
    
    newElement.updated = Date.now();
    newElement.versionNonce = Math.random() * 2000000000 | 0;
    
    console.log('[Scale] Scaling element:', element.id, 'to', targetDimensions);
    
    // Update Excalidraw
    window.postMessage({
      type: 'UPDATE_EXCALIDRAW_ELEMENTS',
      newElements: [newElement],  // Changed to array
      originalIds: [element.id]
    }, '*');
  }

  function showToast(message) {
    console.log('[Scale]', message);
  }

  // Set up MutationObserver to watch for scale container removal
  function setupSidebarObserver() {
    if (sidebarObserver) {
      sidebarObserver.disconnect();
    }
    
    const sidebar = document.querySelector('.App-menu__left');
    if (!sidebar) return;
    
    sidebarObserver = new MutationObserver((mutations) => {
      // Check if our scale container was removed
      const scaleContainer = document.getElementById('excalidraw-scale-ext');
      if (!scaleContainer && scaleUIInjected && currentSelectedElements.length > 0) {
        console.log('[Scale] Container was removed, re-injecting...');
        scaleUIInjected = false;
        
        // Re-inject if we have scalable elements selected
        const scalableElements = currentSelectedElements.filter(el => getElementDimensions(el) !== null);
        if (scalableElements.length > 0) {
          injectScaleUIIntoSidebar(scalableElements);
        }
      }
    });
    
    // Observe the sidebar for child list changes
    sidebarObserver.observe(sidebar, {
      childList: true,
      subtree: true
    });
  }

  // Function to inject scale UI into sidebar
  function injectScaleUIIntoSidebar(selectedElements) {
    const checkAndInject = () => {
      const sidebar = document.querySelector('.App-menu__left');
      if (!sidebar) {
        console.log('[Scale] Sidebar not found, retrying...');
        setTimeout(checkAndInject, 500);
        return;
      }
      
      // Check if already injected
      const existing = document.getElementById('excalidraw-scale-ext');
      if (existing) {
        console.log('[Scale] Already injected, updating visibility and content');
        existing.style.display = 'block';
        existing.style.opacity = '1';
        updateScaleUI(selectedElements);
        return;
      }
      
      // Find the selected shape actions DIV (not the section)
      const selectedShapeActions = document.querySelector('div.selected-shape-actions');
      
      if (!selectedShapeActions) {
        console.log('[Scale] Could not find selected-shape-actions div, retrying...');
        setTimeout(checkAndInject, 500);
        return;
      }
      
      // The target container is the selected-shape-actions div
      const targetContainer = selectedShapeActions;
      
      // Create scale container as fieldset
      const scaleContainer = document.createElement('fieldset');
      scaleContainer.className = 'scale-ui-container';
      scaleContainer.id = 'excalidraw-scale-ext';
      scaleContainer.style.display = 'block';
      scaleContainer.style.opacity = '0';
      scaleContainer.style.transition = 'opacity 0.2s ease-in-out';
      
      // Add legend
      const legend = document.createElement('legend');
      legend.textContent = 'Scale';
      scaleContainer.appendChild(legend);
      
      // Create content div
      const contentDiv = document.createElement('div');
      contentDiv.id = 'scale-ui-content';
      scaleContainer.appendChild(contentDiv);
      
      // Append to the target container
      targetContainer.appendChild(scaleContainer);
      
      scaleUIInjected = true;
      console.log('[Scale] Successfully injected into sidebar');
      console.log('[Scale] Scale container parent:', scaleContainer.parentElement);
      console.log('[Scale] Scale container parent class:', scaleContainer.parentElement?.className);
      console.log('[Scale] Children of selected-shape-actions after injection:', selectedShapeActions.children.length);
      console.log('[Scale] Last child of selected-shape-actions:', selectedShapeActions.lastElementChild);
      
      // Fade in the container
      requestAnimationFrame(() => {
        scaleContainer.style.opacity = '1';
      });
      
      updateScaleUI(selectedElements);
      
      // Set up observer to watch for removal - delay to ensure DOM is stable
      setTimeout(() => {
        setupSidebarObserver();
      }, 100);
    };
    
    checkAndInject();
  }
  
  // Set up mutation observer to watch for sidebar changes
  function setupSidebarObserver() {
    if (sidebarObserver) {
      sidebarObserver.disconnect();
    }
    
    // Watch the selected-shape-actions DIV specifically
    const selectedShapeActions = document.querySelector('div.selected-shape-actions');
    if (!selectedShapeActions) {
      // If not found, watch the sidebar
      const sidebar = document.querySelector('.App-menu__left');
      if (!sidebar) return;
      
      sidebarObserver = new MutationObserver((mutations) => {
        // Check if our container was removed
        const container = document.getElementById('excalidraw-scale-ext');
        if (!container && scaleUIInjected && currentSelectedElements.length > 0) {
          console.log('[Scale] Container was removed, re-injecting...');
          scaleUIInjected = false;
          const scalableElements = currentSelectedElements.filter(el => getElementDimensions(el) !== null);
          if (scalableElements.length > 0) {
            injectScaleUIIntoSidebar(scalableElements);
          }
        }
      });
      
      sidebarObserver.observe(sidebar, {
        childList: true,
        subtree: true
      });
    } else {
      // Watch the selected-shape-actions directly
      sidebarObserver = new MutationObserver((mutations) => {
        // Check if our container was removed
        const container = document.getElementById('excalidraw-scale-ext');
        if (!container && scaleUIInjected && currentSelectedElements.length > 0) {
          console.log('[Scale] Container was removed from selected-shape-actions, re-injecting...');
          scaleUIInjected = false;
          const scalableElements = currentSelectedElements.filter(el => getElementDimensions(el) !== null);
          if (scalableElements.length > 0) {
            // Small delay to let React finish its updates
            setTimeout(() => {
              injectScaleUIIntoSidebar(scalableElements);
            }, 50);
          }
        }
      });
      
      sidebarObserver.observe(selectedShapeActions, {
        childList: true,
        subtree: false
      });
    }
  }
  
  // Update scale UI content
  function updateScaleUI(selectedElements) {
    const contentDiv = document.getElementById('scale-ui-content');
    if (!contentDiv) return;
    
    if (!selectedElements || selectedElements.length === 0) {
      contentDiv.innerHTML = '';
      return;
    }
    
    if (selectedElements.length === 1) {
      const element = selectedElements[0];
      updateSingleElementUI(contentDiv, element);
    } else {
      // Multiple elements selected - show scale buttons
      updateMultiElementUI(contentDiv, selectedElements);
    }
  }
  
  // Create or update dimension box (keeping for backwards compatibility)
  function updateDimensionBox(element) {
    // Redirect to sidebar UI
    if (!scaleUIInjected) {
      injectScaleUIIntoSidebar([element]);
    } else {
      updateScaleUI([element]);
    }
  }

  // Update UI for single element
  function updateSingleElementUI(contentDiv, element) {
    // Clear existing content
    contentDiv.innerHTML = '';
    
    const dims = getElementDimensions(element);
    if (!dims) {
      return;
    }

    // Check if this can be a reference (lines and arrows with valid length)
    const canBeReference = (element.type === 'line' || element.type === 'arrow') && 
                          dims && dims.type === 'linear' && dims.length > 0;

    if (!scaleReference && canBeReference) {
      // Show UI to set as reference with ruler icon
      const buttonRow = document.createElement('div');
      buttonRow.className = 'buttonList';
      
      const button = document.createElement('button');
      button.className = 'ToolIcon_type_button ToolIcon_size_medium ToolIcon';
      button.title = 'Set as 100mm reference';
      button.type = 'button';
      button.setAttribute('aria-label', 'Set as 100mm reference');
      
      // Create inner icon wrapper with ruler SVG
      const iconWrapper = document.createElement('div');
      iconWrapper.className = 'ToolIcon__icon';
      iconWrapper.setAttribute('aria-hidden', 'true');
      iconWrapper.innerHTML = `
        <svg aria-hidden="true" focusable="false" role="img" viewBox="0 0 24 24" class="" fill="currentColor">
          <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zm0-10v2h14V7H7z"/>
        </svg>
      `;
      
      button.appendChild(iconWrapper);
      buttonRow.appendChild(button);
      
      contentDiv.innerHTML = '';
      contentDiv.appendChild(buttonRow);

      button.addEventListener('click', () => {
        if (dims.length) {
          scaleReference = {
            elementId: element.id,
            pixelLength: dims.length,
            mmLength: 100
          };
          console.log('[Scale] Set reference:', element.id, 'as 100mm');
          // Immediately update UI to show controls
          updateSingleElementUI(contentDiv, element);
        }
      });
    } else if (!scaleReference) {
      // No reference set and can't use this element as reference
      contentDiv.innerHTML = `
        <div style="font-size: 14px; color: var(--color-text-secondary); text-align: center;">
          Select a line or arrow<br>to set scale reference
        </div>
      `;
    } else {
      // Show dimension inputs based on element type
      const pixelsPerMm = scaleReference.pixelLength / scaleReference.mmLength;
      
      if (dims.type === 'linear') {
        // Single dimension (lines, arrows)
        const mm = dims.length / pixelsPerMm;
        
        // Create dimension input row
        const inputRow = document.createElement('div');
        inputRow.style.cssText = 'display: flex; gap: 8px; align-items: center; margin-bottom: 8px;';
        inputRow.innerHTML = `
          <input id="lengthInput" type="number" value="${mm.toFixed(1)}" step="0.1" style="
            width: 80px;
            padding: 6px;
            border: 1px solid var(--color-border);
            border-radius: 4px;
            font-size: 14px;
            background: var(--color-bg-secondary);
            color: var(--color-text);
          ">
          <span style="font-size: 14px;">mm</span>
        `;
        
        contentDiv.appendChild(inputRow);
        
        // Create scale buttons row
        const buttonRow = document.createElement('div');
        buttonRow.className = 'buttonList';
        
        const scaleOperations = [
          { scale: 0.5, title: 'Halve size (Alt+H)', icon: '½' },
          { scale: 0.9, title: 'Scale down (Alt+↓)', icon: '↓' },
          { scale: 1.1, title: 'Scale up (Alt+↑)', icon: '↑' },
          { scale: 2.0, title: 'Double size (Alt+D)', icon: '2×' }
        ];
        
        scaleOperations.forEach(({ scale, title, icon }) => {
          const button = document.createElement('button');
          button.className = 'ToolIcon_type_button ToolIcon_size_medium ToolIcon';
          button.title = title;
          button.type = 'button';
          button.setAttribute('aria-label', title);
          
          const iconWrapper = document.createElement('div');
          iconWrapper.className = 'ToolIcon__icon';
          iconWrapper.setAttribute('aria-hidden', 'true');
          iconWrapper.innerHTML = `<span style="font-size: 16px; font-weight: bold;">${icon}</span>`;
          
          button.appendChild(iconWrapper);
          
          button.addEventListener('click', () => {
            scaleElements([element], scale);
          });
          
          buttonRow.appendChild(button);
        });
        
        contentDiv.appendChild(buttonRow);
        
        const input = inputRow.querySelector('#lengthInput');
        
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            const targetMm = parseFloat(input.value);
            if (targetMm > 0) {
              scaleElement(element, { length: targetMm });
            }
          }
        });
        
      } else if (dims.type === 'ellipse') {
        // Ellipse/Circle - show diameter for circles, width×height for ellipses
        const widthMm = dims.width / pixelsPerMm;
        const heightMm = dims.height / pixelsPerMm;
        const isCircle = Math.abs(dims.width - dims.height) < 1;
        
        if (isCircle) {
          // Create dimension input row
          const inputRow = document.createElement('div');
          inputRow.style.cssText = 'display: flex; gap: 8px; align-items: center; margin-bottom: 8px;';
          inputRow.innerHTML = `
            <span style="font-size: 14px;">⌀</span>
            <input id="diameterInput" type="number" value="${widthMm.toFixed(1)}" step="0.1" style="
              width: 80px;
              padding: 6px;
              border: 1px solid var(--color-border);
              border-radius: 4px;
              font-size: 14px;
              background: var(--color-bg-secondary);
              color: var(--color-text);
            ">
            <span style="font-size: 14px;">mm</span>
          `;
          
          contentDiv.appendChild(inputRow);
          
          // Create scale buttons row
          const buttonRow = document.createElement('div');
          buttonRow.className = 'buttonList';
          
          const scaleOperations = [
            { scale: 0.5, title: 'Halve size (Alt+H)', icon: '½' },
            { scale: 0.9, title: 'Scale down (Alt+↓)', icon: '↓' },
            { scale: 1.1, title: 'Scale up (Alt+↑)', icon: '↑' },
            { scale: 2.0, title: 'Double size (Alt+D)', icon: '2×' }
          ];
          
          scaleOperations.forEach(({ scale, title, icon }) => {
            const button = document.createElement('button');
            button.className = 'ToolIcon_type_button ToolIcon_size_medium ToolIcon';
            button.title = title;
            button.type = 'button';
            button.setAttribute('aria-label', title);
            
            const iconWrapper = document.createElement('div');
            iconWrapper.className = 'ToolIcon__icon';
            iconWrapper.setAttribute('aria-hidden', 'true');
            iconWrapper.innerHTML = `<span style="font-size: 16px; font-weight: bold;">${icon}</span>`;
            
            button.appendChild(iconWrapper);
            
            button.addEventListener('click', () => {
              scaleElements([element], scale);
            });
            
            buttonRow.appendChild(button);
          });
          
          contentDiv.appendChild(buttonRow);
          
          const input = inputRow.querySelector('#diameterInput');
          
          input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              const diameter = parseFloat(input.value);
              if (diameter > 0) {
                scaleElement(element, { width: diameter, height: diameter });
              }
            }
          });
        } else {
          // Ellipse with different width/height
          createTwoDimensionUI(contentDiv, element, widthMm, heightMm, pixelsPerMm);
        }
        
      } else {
        // Box type (rectangles, diamonds, polygons)
        const widthMm = dims.width / pixelsPerMm;
        const heightMm = dims.height / pixelsPerMm;
        createTwoDimensionUI(contentDiv, element, widthMm, heightMm, pixelsPerMm);
      }
    }
  }
  
  // Update UI for multiple elements
  function updateMultiElementUI(contentDiv, selectedElements) {
    // Clear existing content
    contentDiv.innerHTML = '';
    
    // Create scale buttons using native Excalidraw button classes
    const buttonRow = document.createElement('div');
    buttonRow.className = 'buttonList';
    
    const scaleOperations = [
      { scale: 0.5, title: 'Halve size (Alt+H)', icon: '½' },
      { scale: 0.9, title: 'Scale down (Alt+↓)', icon: '↓' },
      { scale: 1.1, title: 'Scale up (Alt+↑)', icon: '↑' },
      { scale: 2.0, title: 'Double size (Alt+D)', icon: '2×' }
    ];
    
    scaleOperations.forEach(({ scale, title, icon }) => {
      const button = document.createElement('button');
      button.className = 'ToolIcon_type_button ToolIcon_size_medium ToolIcon';
      button.title = title;
      button.type = 'button';
      button.setAttribute('aria-label', title);
      
      // Create inner icon wrapper
      const iconWrapper = document.createElement('div');
      iconWrapper.className = 'ToolIcon__icon';
      iconWrapper.setAttribute('aria-hidden', 'true');
      iconWrapper.innerHTML = `<span style="font-size: 16px; font-weight: bold;">${icon}</span>`;
      
      button.appendChild(iconWrapper);
      
      // Add click handler
      button.addEventListener('click', () => {
        scaleElements(selectedElements, scale);
      });
      
      buttonRow.appendChild(button);
    });
    
    contentDiv.innerHTML = '';
    contentDiv.appendChild(buttonRow);
  }
  
  // Helper function for two-dimension UI
  function createTwoDimensionUI(contentDiv, element, widthMm, heightMm, pixelsPerMm) {
    contentDiv.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; gap: 8px; align-items: center;">
          <label style="font-size: 12px; width: 45px;">Width:</label>
          <input id="widthInput" type="number" value="${widthMm.toFixed(1)}" step="0.1" style="
            width: 70px;
            padding: 6px;
            border: 1px solid var(--color-border);
            border-radius: 4px;
            font-size: 14px;
            background: var(--color-bg-secondary);
            color: var(--color-text);
          ">
          <span style="font-size: 14px;">mm</span>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <label style="font-size: 12px; width: 45px;">Height:</label>
          <input id="heightInput" type="number" value="${heightMm.toFixed(1)}" step="0.1" style="
            width: 70px;
            padding: 6px;
            border: 1px solid var(--color-border);
            border-radius: 4px;
            font-size: 14px;
            background: var(--color-bg-secondary);
            color: var(--color-text);
          ">
          <span style="font-size: 14px;">mm</span>
        </div>
      </div>
    `;
    
    // Create scale buttons row
    const buttonRow = document.createElement('div');
    buttonRow.className = 'buttonList';
    buttonRow.style.marginTop = '8px';
    
    const scaleOperations = [
      { scale: 0.5, title: 'Halve size (Alt+H)', icon: '½' },
      { scale: 0.9, title: 'Scale down (Alt+↓)', icon: '↓' },
      { scale: 1.1, title: 'Scale up (Alt+↑)', icon: '↑' },
      { scale: 2.0, title: 'Double size (Alt+D)', icon: '2×' }
    ];
    
    scaleOperations.forEach(({ scale, title, icon }) => {
      const button = document.createElement('button');
      button.className = 'ToolIcon_type_button ToolIcon_size_medium ToolIcon';
      button.title = title;
      button.type = 'button';
      button.setAttribute('aria-label', title);
      
      const iconWrapper = document.createElement('div');
      iconWrapper.className = 'ToolIcon__icon';
      iconWrapper.setAttribute('aria-hidden', 'true');
      iconWrapper.innerHTML = `<span style="font-size: 16px; font-weight: bold;">${icon}</span>`;
      
      button.appendChild(iconWrapper);
      
      button.addEventListener('click', () => {
        scaleElements([element], scale);
      });
      
      buttonRow.appendChild(button);
    });
    
    contentDiv.appendChild(buttonRow);
    
    const widthInput = contentDiv.querySelector('#widthInput');
    const heightInput = contentDiv.querySelector('#heightInput');
    
    const applyDimensions = () => {
      const width = parseFloat(widthInput.value);
      const height = parseFloat(heightInput.value);
      if (width > 0 && height > 0) {
        scaleElement(element, { width, height });
      }
    };
    
    widthInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') applyDimensions();
    });
    
    heightInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') applyDimensions();
    });
  }
  
  // Scale multiple elements
  function scaleElements(elements, scaleFactor) {
    const updatedElements = elements.map(element => {
      const newElement = { ...element };
      
      if (element.type === 'line' || element.type === 'arrow') {
        // Scale points from first point
        newElement.points = element.points.map((point, index) => {
          if (index === 0) return point;
          return [
            element.points[0][0] + (point[0] - element.points[0][0]) * scaleFactor,
            element.points[0][1] + (point[1] - element.points[0][1]) * scaleFactor
          ];
        });
      } else {
        // Scale width and height
        newElement.width = element.width * scaleFactor;
        newElement.height = element.height * scaleFactor;
        
        // For center-based scaling (ellipse, diamond)
        if (element.type === 'ellipse' || element.type === 'diamond') {
          newElement.x = element.x + (element.width - newElement.width) / 2;
          newElement.y = element.y + (element.height - newElement.height) / 2;
        }
      }
      
      newElement.updated = Date.now();
      newElement.versionNonce = Math.random() * 2000000000 | 0;
      
      return newElement;
    });
    
    console.log('[Scale] Scaling', elements.length, 'elements by', scaleFactor);
    
    // Update Excalidraw
    window.postMessage({
      type: 'UPDATE_EXCALIDRAW_ELEMENTS',
      newElements: updatedElements,
      originalIds: elements.map(el => el.id)
    }, '*');
  }

  function hideDimensionBox() {
    // Hide the scale container
    const container = document.getElementById('excalidraw-scale-ext');
    if (container) {
      container.style.display = 'none';
    }
    updateScaleUI([]);
  }

  // Listen for state updates and clicks
  window.addEventListener('message', (event) => {
    if (event.data.type === 'EXCALIDRAW_STATE_UPDATE') {
      const { selectedIds, elements } = event.data;

      // Get all selected elements
      const selectedElements = elements.filter(el => selectedIds.includes(el.id) && !el.isDeleted);
      currentSelectedElements = selectedElements;

      // Filter to only scalable elements
      const scalableElements = selectedElements.filter(el => {
        const dims = getElementDimensions(el);
        return dims !== null;
      });

      if (scalableElements.length > 0) {
        // Check if container still exists
        const container = document.getElementById('excalidraw-scale-ext');
        
        if (!container) {
          // Container was removed, need to re-inject
          console.log('[Scale] Container missing, re-injecting...');
          scaleUIInjected = false;
          injectScaleUIIntoSidebar(scalableElements);
        } else if (!scaleUIInjected) {
          // First time injection
          injectScaleUIIntoSidebar(scalableElements);
        } else {
          // Container exists, just update it
          container.style.display = 'block';
          updateScaleUI(scalableElements);
        }
      } else {
        // No scalable elements - hide the container
        const container = document.getElementById('excalidraw-scale-ext');
        if (container) {
          container.style.display = 'none';
        }
        updateScaleUI([]);
      }
    }
  });
  
  // Add keyboard shortcuts for scaling
  document.addEventListener('keydown', (e) => {
    if (e.altKey && !e.ctrlKey && !e.metaKey && currentSelectedElements.length > 0) {
      let scaleFactor = null;
      
      if (e.key === 'ArrowUp') {
        scaleFactor = 1.1;
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        scaleFactor = 0.9;
        e.preventDefault();
      } else if (e.key.toLowerCase() === 'd') {
        scaleFactor = 2.0;
        e.preventDefault();
      } else if (e.key.toLowerCase() === 'h') {
        scaleFactor = 0.5;
        e.preventDefault();
      }
      
      if (scaleFactor && currentSelectedElements.length > 0) {
        const scalableElements = currentSelectedElements.filter(el => getElementDimensions(el) !== null);
        if (scalableElements.length > 0) {
          scaleElements(scalableElements, scaleFactor);
        }
      }
    }
  }, true);

  // Handle clicks on canvas - removed to prevent popup UI

  // Removed click detection and popup UI - we only use the bottom-right dimension box now
  
  // Clean up observer on unload
  window.addEventListener('beforeunload', () => {
    if (sidebarObserver) {
      sidebarObserver.disconnect();
    }
  });
})();
