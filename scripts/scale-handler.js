// Simple scale handler for 2-point lines
(function() {
  let scaleReference = null; // {elementId, pixelLength}
  let currentTooltip = null;
  let dimensionBox = null;
  let currentElement = null;

  // Calculate line length
  function getLineLength(element) {
    if (!element || element.type !== 'line' || !element.points || element.points.length !== 2) {
      return null;
    }

    const [p1, p2] = element.points;
    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Remove tooltip functions - we'll use the dimension box instead
  function showTooltip(text, x, y) {
    // No-op - we don't want the black tooltip
  }

  function hideTooltip() {
    // No-op
  }


  // Scale element to target mm
  function scaleElement(element, targetMm) {
    if (!scaleReference || !element || element.type !== 'line' || element.points.length !== 2) {
      return;
    }

    const currentLength = getLineLength(element);
    const targetPixels = (targetMm / scaleReference.mmLength) * scaleReference.pixelLength;
    const scaleFactor = targetPixels / currentLength;

    // Scale from the first point (fixed left side)
    const newElement = {
      ...element,
      points: [
        element.points[0],
        [
          element.points[0][0] + (element.points[1][0] - element.points[0][0]) * scaleFactor,
          element.points[0][1] + (element.points[1][1] - element.points[0][1]) * scaleFactor
        ]
      ],
      updated: Date.now(),
      versionNonce: Math.random() * 2000000000 | 0
    };

    console.log('[Scale] Scaling element:', element.id, 'to', targetMm, 'mm');

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

    const length = getLineLength(element);

    if (!scaleReference) {
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
        if (length) {
          scaleReference = {
            elementId: element.id,
            pixelLength: length,
            mmLength: 100
          };
          console.log('[Scale] Set reference:', element.id, 'as 100mm');
          showToast('Scale reference set: 100mm');
          updateDimensionBox(element); // Update to show dimension input
        }
      });
    } else {
      // Show dimension input
      const mm = (length / scaleReference.pixelLength) * scaleReference.mmLength;

      dimensionBox.innerHTML = `
        <div style="display: flex; gap: 8px; align-items: center;">
          <input id="dimensionInput" type="number" value="${mm.toFixed(1)}" step="0.1" style="
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

      const input = dimensionBox.querySelector('#dimensionInput');
      const applyBtn = dimensionBox.querySelector('#applyDimension');

      applyBtn.addEventListener('click', () => {
        const targetMm = parseFloat(input.value);
        if (targetMm > 0 && element) {
          scaleElement(element, targetMm);
        }
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const targetMm = parseFloat(input.value);
          if (targetMm > 0 && element) {
            scaleElement(element, targetMm);
          }
        }
      });
    }

    dimensionBox.style.display = 'block';
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

      // Check if a single 2-point line is selected
      const selectedElements = elements.filter(el => selectedIds.includes(el.id) && !el.isDeleted);

      if (selectedElements.length === 1) {
        const element = selectedElements[0];
        if (element.type === 'line' && element.points && element.points.length === 2) {
          currentElement = element;
          // Always show dimension box for 2-point lines
          updateDimensionBox(element);
        } else {
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
