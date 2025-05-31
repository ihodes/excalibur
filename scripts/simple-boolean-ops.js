// Simplified Boolean Operations
// This provides basic working union operations for testing

// Convert Excalidraw element to simple coordinate array
function elementToCoords(element) {
  switch (element.type) {
    case 'rectangle':
      return [
        [element.x, element.y],
        [element.x + element.width, element.y],
        [element.x + element.width, element.y + element.height],
        [element.x, element.y + element.height]
      ];
    
    case 'ellipse':
      // Approximate ellipse with octagon
      const cx = element.x + element.width / 2;
      const cy = element.y + element.height / 2;
      const rx = element.width / 2;
      const ry = element.height / 2;
      const coords = [];
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI * 2) / 8;
        coords.push([
          cx + rx * Math.cos(angle),
          cy + ry * Math.sin(angle)
        ]);
      }
      return coords;
    
    case 'diamond':
      return [
        [element.x + element.width / 2, element.y],
        [element.x + element.width, element.y + element.height / 2],
        [element.x + element.width / 2, element.y + element.height],
        [element.x, element.y + element.height / 2]
      ];
    
    case 'line':
      if (element.points && element.points.length >= 3) {
        return element.points.map(point => [
          element.x + point[0],
          element.y + point[1]
        ]);
      }
      break;
    
    default:
      throw new Error(`Unsupported element type: ${element.type}`);
  }
}

// Simple convex hull algorithm (Gift wrapping)
function convexHull(points) {
  if (points.length < 3) return points;
  
  // Find the leftmost point
  let leftmost = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i][0] < points[leftmost][0] || 
        (points[i][0] === points[leftmost][0] && points[i][1] < points[leftmost][1])) {
      leftmost = i;
    }
  }
  
  const hull = [];
  let p = leftmost;
  
  do {
    hull.push(points[p]);
    let q = (p + 1) % points.length;
    
    for (let i = 0; i < points.length; i++) {
      if (orientation(points[p], points[i], points[q]) === 2) {
        q = i;
      }
    }
    
    p = q;
  } while (p !== leftmost);
  
  return hull;
}

// Calculate orientation of ordered triplet (p, q, r)
// Returns 0 if collinear, 1 if clockwise, 2 if counterclockwise
function orientation(p, q, r) {
  const val = (q[1] - p[1]) * (r[0] - q[0]) - (q[0] - p[0]) * (r[1] - q[1]);
  if (val === 0) return 0;
  return val > 0 ? 1 : 2;
}

// Simple union: combine all points and find convex hull
function simpleUnion(coords1, coords2) {
  console.log('[Simple Boolean] Computing union of', coords1.length, 'and', coords2.length, 'points');
  
  // Combine all points
  const allPoints = [...coords1, ...coords2];
  
  // Find convex hull
  const hull = convexHull(allPoints);
  
  console.log('[Simple Boolean] Union result:', hull.length, 'points');
  return hull;
}

// Simple intersection: find overlapping area (simplified)
function simpleIntersection(coords1, coords2) {
  // For now, just return a simple overlap rectangle
  const bounds1 = getBounds(coords1);
  const bounds2 = getBounds(coords2);
  
  const overlapX = Math.max(bounds1.x, bounds2.x);
  const overlapY = Math.max(bounds1.y, bounds2.y);
  const overlapRight = Math.min(bounds1.x + bounds1.width, bounds2.x + bounds2.width);
  const overlapBottom = Math.min(bounds1.y + bounds1.height, bounds2.y + bounds2.height);
  
  if (overlapRight > overlapX && overlapBottom > overlapY) {
    return [
      [overlapX, overlapY],
      [overlapRight, overlapY],
      [overlapRight, overlapBottom],
      [overlapX, overlapBottom]
    ];
  }
  
  return [];
}

// Get bounding box of coordinates
function getBounds(coords) {
  if (coords.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  
  let minX = coords[0][0], maxX = coords[0][0];
  let minY = coords[0][1], maxY = coords[0][1];
  
  for (let i = 1; i < coords.length; i++) {
    minX = Math.min(minX, coords[i][0]);
    maxX = Math.max(maxX, coords[i][0]);
    minY = Math.min(minY, coords[i][1]);
    maxY = Math.max(maxY, coords[i][1]);
  }
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

// Convert coordinates to Excalidraw points relative to bounds
function coordsToPoints(coords, bounds) {
  const points = coords.map(coord => [
    coord[0] - bounds.x,
    coord[1] - bounds.y
  ]);
  
  // Ensure the path is closed by adding the first point at the end if needed
  if (points.length > 0) {
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    const distance = Math.sqrt(
      Math.pow(firstPoint[0] - lastPoint[0], 2) + 
      Math.pow(firstPoint[1] - lastPoint[1], 2)
    );
    
    // Only add closing point if it's not already close enough
    if (distance > 0.1) {
      points.push([firstPoint[0], firstPoint[1]]);
    }
  }
  
  return points;
}

// Generate a random ID
function generateId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 12; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

// Main entry point for simple boolean operations
window.performExcalidrawBooleanOp = function(elements, operation) {
  console.log('[Simple Boolean] Starting operation:', operation, 'on', elements.length, 'elements');
  
  if (elements.length !== 2) {
    throw new Error('Boolean operations require exactly 2 elements');
  }
  
  try {
    // Convert elements to coordinate arrays
    const coords1 = elementToCoords(elements[0]);
    const coords2 = elementToCoords(elements[1]);
    
    console.log('[Simple Boolean] Element 1 coords:', coords1);
    console.log('[Simple Boolean] Element 2 coords:', coords2);
    
    // Perform the operation
    let resultCoords;
    switch (operation) {
      case 'union':
        resultCoords = simpleUnion(coords1, coords2);
        break;
      case 'intersection':
        resultCoords = simpleIntersection(coords1, coords2);
        break;
      case 'difference':
        // For now, just return first shape
        resultCoords = coords1;
        break;
      case 'exclusion':
        // For now, return union (placeholder)
        resultCoords = simpleUnion(coords1, coords2);
        break;
      default:
        throw new Error(`Unsupported operation: ${operation}`);
    }
    
    if (resultCoords.length === 0) {
      throw new Error('Operation resulted in empty shape');
    }
    
    // Get bounds and convert to Excalidraw format
    const bounds = getBounds(resultCoords);
    const points = coordsToPoints(resultCoords, bounds);
    
    console.log('[Simple Boolean] Result bounds:', bounds);
    console.log('[Simple Boolean] Result points:', points);
    
    // Create new element
    const firstElement = elements[0];
    
    return {
      id: generateId(),
      type: 'line',
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      angle: 0,
      strokeColor: firstElement.strokeColor || '#000000',
      backgroundColor: firstElement.backgroundColor || 'transparent',
      fillStyle: firstElement.fillStyle || 'solid',
      strokeWidth: firstElement.strokeWidth || 1,
      strokeStyle: firstElement.strokeStyle || 'solid',
      roughness: firstElement.roughness || 1,
      opacity: firstElement.opacity || 100,
      points: points,
      lastCommittedPoint: null,
      startBinding: null,
      endBinding: null,
      startArrowhead: null,
      endArrowhead: null,
      versionNonce: Math.floor(Math.random() * 2000000000),
      updated: Date.now(),
      seed: Math.floor(Math.random() * 2000000000),
      locked: false,
      isDeleted: false,
      boundElements: [],
      link: null,
      customData: null,
      groupIds: [],
      roundness: null,
      frameId: null,
      index: 'a0'
    };
  } catch (error) {
    console.error('[Simple Boolean] Error:', error);
    throw error;
  }
};