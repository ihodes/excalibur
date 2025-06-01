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
      // High-resolution ellipse approximation
      const cx = element.x + element.width / 2;
      const cy = element.y + element.height / 2;
      const rx = element.width / 2;
      const ry = element.height / 2;
      const coords = [];
      
      // Use adaptive resolution based on size
      const perimeter = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
      const numPoints = Math.max(32, Math.min(128, Math.floor(perimeter / 5))); // 5 pixels per segment
      
      for (let i = 0; i < numPoints; i++) {
        const angle = (i * Math.PI * 2) / numPoints;
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

// Simple intersection: find overlapping area
function simpleIntersection(coords1, coords2) {
  console.log('[Simple Boolean] Computing intersection');
  
  // Find points from shape1 that are inside shape2
  const pointsInside1 = coords1.filter(point => isPointInPolygon(point, coords2));
  // Find points from shape2 that are inside shape1
  const pointsInside2 = coords2.filter(point => isPointInPolygon(point, coords1));
  
  // Find intersection points between edges
  const intersectionPoints = findPolygonIntersections(coords1, coords2);
  
  // Combine all points that define the intersection
  const allIntersectionPoints = [...pointsInside1, ...pointsInside2, ...intersectionPoints];
  
  if (allIntersectionPoints.length < 3) {
    // No valid intersection
    return [];
  }
  
  // Find convex hull of intersection points
  const intersectionHull = convexHull(allIntersectionPoints);
  
  console.log('[Simple Boolean] Intersection result:', intersectionHull.length, 'points');
  return intersectionHull;
}

// Simple difference: subtract second shape from first
function simpleDifference(coords1, coords2) {
  console.log('[Simple Boolean] Computing difference');
  
  // For a simple implementation, check if shapes overlap
  const bounds1 = getBounds(coords1);
  const bounds2 = getBounds(coords2);
  
  // Check if there's any overlap
  if (bounds1.x + bounds1.width < bounds2.x || bounds2.x + bounds2.width < bounds1.x ||
      bounds1.y + bounds1.height < bounds2.y || bounds2.y + bounds2.height < bounds1.y) {
    // No overlap, return first shape unchanged
    return coords1;
  }
  
  // Find points from shape1 that are NOT inside shape2
  const pointsOutside = coords1.filter(point => !isPointInPolygon(point, coords2));
  
  if (pointsOutside.length < 3) {
    // First shape is entirely inside second shape
    return [];
  }
  
  // For now, return the convex hull of points outside
  // A proper implementation would trace the boundary
  return convexHull(pointsOutside);
}

// Simple exclusion: symmetric difference (union minus intersection)
function simpleExclusion(coords1, coords2) {
  console.log('[Simple Boolean] Computing exclusion');
  
  // Exclusion = parts in shape1 but not shape2, plus parts in shape2 but not shape1
  
  // Find points from shape1 that are NOT inside shape2
  const points1NotIn2 = coords1.filter(point => !isPointInPolygon(point, coords2));
  
  // Find points from shape2 that are NOT inside shape1
  const points2NotIn1 = coords2.filter(point => !isPointInPolygon(point, coords1));
  
  // If one shape is entirely inside the other, return the outer shape
  if (points1NotIn2.length === 0) {
    // Shape1 is entirely inside shape2, return shape2
    return coords2;
  }
  if (points2NotIn1.length === 0) {
    // Shape2 is entirely inside shape1, return shape1
    return coords1;
  }
  
  // Check if shapes don't overlap at all
  const intersectionTest = simpleIntersection(coords1, coords2);
  if (intersectionTest.length === 0) {
    // No overlap, return union
    return simpleUnion(coords1, coords2);
  }
  
  // For overlapping shapes, we need to create two separate regions
  // This is a simplified approach - just combine the non-overlapping points
  const exclusionPoints = [...points1NotIn2, ...points2NotIn1];
  
  if (exclusionPoints.length < 3) {
    // Not enough points for a valid shape
    return [];
  }
  
  // Create convex hull of the exclusion points
  // Note: This is simplified - a proper implementation would create
  // multiple polygons or a polygon with a hole
  const hull = convexHull(exclusionPoints);
  
  console.log('[Simple Boolean] Exclusion result:', hull.length, 'points');
  return hull;
}

// Check if a point is inside a polygon
function isPointInPolygon(point, polygon) {
  let inside = false;
  const x = point[0], y = point[1];
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    
    const intersect = ((yi > y) !== (yj > y)) && 
                      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  
  return inside;
}

// Find intersection points between two polygons
function findPolygonIntersections(coords1, coords2) {
  const intersections = [];
  
  // Check each edge of polygon1 against each edge of polygon2
  for (let i = 0; i < coords1.length - 1; i++) {
    for (let j = 0; j < coords2.length - 1; j++) {
      const intersection = lineIntersection(
        coords1[i], coords1[i + 1],
        coords2[j], coords2[j + 1]
      );
      
      if (intersection) {
        intersections.push(intersection);
      }
    }
  }
  
  return intersections;
}

// Find intersection point of two line segments
function lineIntersection(p1, p2, p3, p4) {
  const x1 = p1[0], y1 = p1[1];
  const x2 = p2[0], y2 = p2[1];
  const x3 = p3[0], y3 = p3[1];
  const x4 = p4[0], y4 = p4[1];
  
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 0.001) return null; // Parallel lines
  
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
  
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return [
      x1 + t * (x2 - x1),
      y1 + t * (y2 - y1)
    ];
  }
  
  return null;
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
        resultCoords = simpleDifference(coords1, coords2);
        break;
      case 'exclusion':
        resultCoords = simpleExclusion(coords1, coords2);
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