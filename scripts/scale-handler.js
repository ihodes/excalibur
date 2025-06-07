// Simple scale handler for 2-point lines
(function() {
  let scaleReference = null; // {elementId, pixelLength}
  let currentTooltip = null;
  let dimensionBox = null;
  let currentElement = null;

  // Calculate line/arrow length
  function getLineLength(element) {
    if (!element || !element.points || element.points.length < 2) {
      return null;
    }

    if (element.type === 'line' || element.type === 'arrow') {
      const [p1, p2] = element.points;
      const dx = p2[0] - p1[0];
      const dy = p2[1] - p1[1];
      return Math.sqrt(dx * dx + dy * dy);
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
        
        newElement.points = [
          element.points[0],
          [
            element.points[0][0] + (element.points[1][0] - element.points[0][0]) * scaleFactor,
            element.points[0][1] + (element.points[1][1] - element.points[0][1]) * scaleFactor
          ]
        ];
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
      newElement: newElement,
      originalIds: [element.id]
    }, '*');
  }

  function showToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 100px;
      left: 50%;
      transform: translateX(-50%);
      background: #333;
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      z-index: 100000;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => { toast.style.opacity = '1'; }, 10);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  // Create or update dimension box
  function updateDimensionBox(element) {
    if (!dimensionBox) {
      dimensionBox = document.createElement('div');
      dimensionBox.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: white;
        border: 2px solid #6965DB;
        border-radius: 8px;
        padding: 12px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 100001;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        min-width: 200px;
      `;
      document.body.appendChild(dimensionBox);
    }

    const dims = getElementDimensions(element);
    if (!dims) {
      hideDimensionBox();
      return;
    }

    // Check if this can be a reference (only 2-point lines/arrows)
    const canBeReference = (element.type === 'line' || element.type === 'arrow') && 
                          element.points && element.points.length === 2;

    if (!scaleReference && canBeReference) {
      // Show UI to set as reference
      dimensionBox.innerHTML = `
        <div style="margin-bottom: 8px; font-size: 14px; color: #333;">Set as scale reference:</div>
        <button id="setReference" style="
          background: #6965DB;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          width: 100%;
        ">Set as 100mm reference</button>
      `;

      dimensionBox.querySelector('#setReference').addEventListener('click', () => {
        if (dims.length) {
          scaleReference = {
            elementId: element.id,
            pixelLength: dims.length,
            mmLength: 100
          };
          console.log('[Scale] Set reference:', element.id, 'as 100mm');
          showToast('Scale reference set: 100mm');
          updateDimensionBox(element); // Update to show dimension input
        }
      });
    } else if (!scaleReference) {
      // No reference set and can't use this element as reference
      dimensionBox.innerHTML = `
        <div style="font-size: 14px; color: #666; text-align: center;">
          Select a 2-point line<br>to set scale reference
        </div>
      `;
    } else {
      // Show dimension inputs based on element type
      const pixelsPerMm = scaleReference.pixelLength / scaleReference.mmLength;
      
      if (dims.type === 'linear') {
        // Single dimension (lines, arrows)
        const mm = dims.length / pixelsPerMm;
        dimensionBox.innerHTML = `
          <div style="display: flex; gap: 8px; align-items: center;">
            <input id="lengthInput" type="number" value="${mm.toFixed(1)}" step="0.1" style="
              width: 80px;
              padding: 6px;
              border: 1px solid #ddd;
              border-radius: 4px;
              font-size: 14px;
            ">
            <span style="font-size: 14px; color: #666;">mm</span>
            <button id="applyDimension" style="
              background: #6965DB;
              color: white;
              border: none;
              padding: 6px 12px;
              border-radius: 4px;
              cursor: pointer;
              font-size: 14px;
            ">Apply</button>
          </div>
        `;
        
        const input = dimensionBox.querySelector('#lengthInput');
        const applyBtn = dimensionBox.querySelector('#applyDimension');
        
        applyBtn.addEventListener('click', () => {
          const targetMm = parseFloat(input.value);
          if (targetMm > 0) {
            scaleElement(element, { length: targetMm });
          }
        });
        
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
          dimensionBox.innerHTML = `
            <div style="display: flex; gap: 8px; align-items: center;">
              <span style="font-size: 14px; color: #666;">⌀</span>
              <input id="diameterInput" type="number" value="${widthMm.toFixed(1)}" step="0.1" style="
                width: 80px;
                padding: 6px;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 14px;
              ">
              <span style="font-size: 14px; color: #666;">mm</span>
              <button id="applyDimension" style="
                background: #6965DB;
                color: white;
                border: none;
                padding: 6px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
              ">Apply</button>
            </div>
          `;
          
          const input = dimensionBox.querySelector('#diameterInput');
          const applyBtn = dimensionBox.querySelector('#applyDimension');
          
          applyBtn.addEventListener('click', () => {
            const diameter = parseFloat(input.value);
            if (diameter > 0) {
              scaleElement(element, { width: diameter, height: diameter });
            }
          });
          
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
          createTwoDimensionUI(element, widthMm, heightMm, pixelsPerMm);
        }
        
      } else {
        // Box type (rectangles, diamonds, polygons)
        const widthMm = dims.width / pixelsPerMm;
        const heightMm = dims.height / pixelsPerMm;
        createTwoDimensionUI(element, widthMm, heightMm, pixelsPerMm);
      }
    }

    dimensionBox.style.display = 'block';
  }
  
  // Helper function for two-dimension UI
  function createTwoDimensionUI(element, widthMm, heightMm, pixelsPerMm) {
    dimensionBox.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; gap: 8px; align-items: center;">
            <label style="font-size: 12px; color: #666; width: 45px;">Width:</label>
            <input id="widthInput" type="number" value="${widthMm.toFixed(1)}" step="0.1" style="
              width: 70px;
              padding: 6px;
              border: 1px solid #ddd;
              border-radius: 4px;
              font-size: 14px;
            ">
            <span style="font-size: 14px; color: #666;">mm</span>
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <label style="font-size: 12px; color: #666; width: 45px;">Height:</label>
            <input id="heightInput" type="number" value="${heightMm.toFixed(1)}" step="0.1" style="
              width: 70px;
              padding: 6px;
              border: 1px solid #ddd;
              border-radius: 4px;
              font-size: 14px;
            ">
            <span style="font-size: 14px; color: #666;">mm</span>
          </div>
        </div>
        <button id="applyDimension" style="
          background: #6965DB;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          width: 100%;
        ">Apply</button>
      </div>
    `;
    
    const widthInput = dimensionBox.querySelector('#widthInput');
    const heightInput = dimensionBox.querySelector('#heightInput');
    const applyBtn = dimensionBox.querySelector('#applyDimension');
    
    const applyDimensions = () => {
      const width = parseFloat(widthInput.value);
      const height = parseFloat(heightInput.value);
      if (width > 0 && height > 0) {
        scaleElement(element, { width, height });
      }
    };
    
    applyBtn.addEventListener('click', applyDimensions);
    
    widthInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') applyDimensions();
    });
    
    heightInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') applyDimensions();
    });
  }

  function hideDimensionBox() {
    if (dimensionBox) {
      dimensionBox.style.display = 'none';
    }
  }

  // Listen for state updates and clicks
  window.addEventListener('message', (event) => {
    if (event.data.type === 'EXCALIDRAW_STATE_UPDATE') {
      const { selectedIds, elements } = event.data;

      // Check if a single element is selected
      const selectedElements = elements.filter(el => selectedIds.includes(el.id) && !el.isDeleted);

      if (selectedElements.length === 1) {
        const element = selectedElements[0];
        const dims = getElementDimensions(element);
        
        if (dims) {
          currentElement = element;
          updateDimensionBox(element);
        } else {
          // Unsupported element type (text, image, etc.)
          currentElement = null;
          hideDimensionBox();
        }
      } else {
        currentElement = null;
        hideDimensionBox();
      }
    }
  });

  // Handle clicks on canvas - removed to prevent popup UI

  // Removed click detection and popup UI - we only use the bottom-right dimension box now
})();
