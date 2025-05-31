// Boolean Operations using Raphael.js methodology
// Based on the Excalibur diff.diff implementation

// Convert Excalidraw element to SVG path string
function elementToPathString(element) {
  switch (element.type) {
    case 'rectangle': {
      const x = element.x;
      const y = element.y; 
      const w = element.width;
      const h = element.height;
      return `M${x},${y}L${x + w},${y}L${x + w},${y + h}L${x},${y + h}Z`;
    }
    
    case 'ellipse': {
      // Convert ellipse to path using bezier curves
      const cx = element.x + element.width / 2;
      const cy = element.y + element.height / 2;
      const rx = element.width / 2;
      const ry = element.height / 2;
      
      // Magic number for bezier curve approximation
      const k = 0.5522847498;
      const ox = rx * k;
      const oy = ry * k;
      
      return `M${cx - rx},${cy}C${cx - rx},${cy - oy},${cx - ox},${cy - ry},${cx},${cy - ry}C${cx + ox},${cy - ry},${cx + rx},${cy - oy},${cx + rx},${cy}C${cx + rx},${cy + oy},${cx + ox},${cy + ry},${cx},${cy + ry}C${cx - ox},${cy + ry},${cx - rx},${cy + oy},${cx - rx},${cy}Z`;
    }
    
    case 'diamond': {
      const x = element.x;
      const y = element.y;
      const w = element.width;
      const h = element.height;
      return `M${x + w/2},${y}L${x + w},${y + h/2}L${x + w/2},${y + h}L${x},${y + h/2}Z`;
    }
    
    case 'line': {
      // Closed polygon
      if (element.points && element.points.length >= 3) {
        let d = `M${element.x + element.points[0][0]},${element.y + element.points[0][1]}`;
        for (let i = 1; i < element.points.length; i++) {
          d += `L${element.x + element.points[i][0]},${element.y + element.points[i][1]}`;
        }
        d += 'Z';
        return d;
      }
      break;
    }
    
    default:
      throw new Error(`Unsupported element type: ${element.type}`);
  }
}

// Generate path segments from normalized path
function generatePathSegments(pathStr) {
  const path = RaphaelUtils.path2curve(pathStr);
  const segments = [];
  
  for (let i = 0; i < path.length; i++) {
    const seg = path[i];
    if (seg[0] === 'M') {
      segments.push({
        type: 'M',
        x: seg[1],
        y: seg[2],
        index: i
      });
    } else if (seg[0] === 'C') {
      segments.push({
        type: 'C',
        x1: segments[segments.length - 1] ? segments[segments.length - 1].x : seg[1],
        y1: segments[segments.length - 1] ? segments[segments.length - 1].y : seg[2],
        cp1x: seg[1],
        cp1y: seg[2],
        cp2x: seg[3],
        cp2y: seg[4],
        x2: seg[5],
        y2: seg[6],
        index: i
      });
    }
  }
  
  return segments;
}

// Mark subpath endings for proper path construction
function markSubpathEndings(segments) {
  for (let i = 0; i < segments.length; i++) {
    if (segments[i].type === 'M') {
      segments[i].subpathStart = true;
      // Find the end of this subpath
      for (let j = i + 1; j < segments.length; j++) {
        if (segments[j].type === 'M') {
          segments[j - 1].subpathEnd = true;
          break;
        }
        if (j === segments.length - 1) {
          segments[j].subpathEnd = true;
        }
      }
    }
  }
}

// Insert intersection points into path segments
function insertIntersectionPoints(segments, pathIndex, intersections) {
  // Sort intersections by segment and parameter
  const segmentIntersections = {};
  
  intersections.forEach(intersection => {
    const segIndex = pathIndex === 1 ? intersection.segment1 : intersection.segment2;
    const t = pathIndex === 1 ? intersection.t1 : intersection.t2;
    
    if (!segmentIntersections[segIndex]) {
      segmentIntersections[segIndex] = [];
    }
    segmentIntersections[segIndex].push({
      ...intersection,
      t: t
    });
  });
  
  // Sort by parameter value
  Object.keys(segmentIntersections).forEach(segIndex => {
    segmentIntersections[segIndex].sort((a, b) => a.t - b.t);
  });
  
  // Insert intersection points
  const newSegments = [];
  
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    
    if (seg.type === 'M') {
      newSegments.push(seg);
      continue;
    }
    
    const intersects = segmentIntersections[seg.index] || [];
    
    if (intersects.length === 0) {
      newSegments.push(seg);
      continue;
    }
    
    // Split segment at intersection points
    let lastT = 0;
    let lastX = seg.x1;
    let lastY = seg.y1;
    
    intersects.forEach(inter => {
      if (inter.t > lastT && inter.t < 1) {
        // Create segment from last point to intersection
        newSegments.push({
          type: 'C',
          x1: lastX,
          y1: lastY,
          cp1x: lastX + (seg.cp1x - seg.x1) * ((inter.t - lastT) / (1 - lastT)),
          cp1y: lastY + (seg.cp1y - seg.y1) * ((inter.t - lastT) / (1 - lastT)),
          cp2x: inter.x - (seg.x2 - seg.cp2x) * (1 - inter.t),
          cp2y: inter.y - (seg.y2 - seg.cp2y) * (1 - inter.t),
          x2: inter.x,
          y2: inter.y,
          intersection: true
        });
        
        lastT = inter.t;
        lastX = inter.x;
        lastY = inter.y;
      }
    });
    
    // Add remaining part of segment
    if (lastT < 1) {
      newSegments.push({
        type: 'C',
        x1: lastX,
        y1: lastY,
        cp1x: lastX + (seg.cp2x - lastX) * (1 - lastT),
        cp1y: lastY + (seg.cp2y - lastY) * (1 - lastT),
        cp2x: seg.cp2x,
        cp2y: seg.cp2y,
        x2: seg.x2,
        y2: seg.y2
      });
    }
  }
  
  return newSegments;
}

// Check if a segment is inside a path
function isSegInsidePath(segment, pathStr) {
  if (segment.type === 'M') return false;
  
  // Get midpoint of segment
  const midX = segment.type === 'C' 
    ? (segment.x1 + segment.cp1x + segment.cp2x + segment.x2) / 4
    : (segment.x1 + segment.x2) / 2;
  const midY = segment.type === 'C'
    ? (segment.y1 + segment.cp1y + segment.cp2y + segment.y2) / 4
    : (segment.y1 + segment.y2) / 2;
  
  return RaphaelUtils.isPointInsidePath(pathStr, midX, midY);
}

// Build new path parts based on operation rules
function buildNewPathParts(operation, segments1, segments2, path1Str, path2Str) {
  const rules = {
    union: { 0: false, 1: false },
    difference: { 0: false, 1: true },
    intersection: { 0: true, 1: true },
    exclusion: { 0: false, 1: false } // Will be handled specially
  };
  
  const rule = rules[operation];
  const selectedSegments = [];
  
  // Process path1 segments
  segments1.forEach(seg => {
    if (seg.type === 'M') return;
    
    const isInside = isSegInsidePath(seg, path2Str);
    const keep = rule[0] ? isInside : !isInside;
    
    if (keep) {
      selectedSegments.push({ ...seg, pathIndex: 1 });
    }
  });
  
  // Process path2 segments
  segments2.forEach(seg => {
    if (seg.type === 'M') return;
    
    const isInside = isSegInsidePath(seg, path1Str);
    const keep = rule[1] ? isInside : !isInside;
    
    if (keep) {
      selectedSegments.push({ ...seg, pathIndex: 2 });
    }
  });
  
  return selectedSegments;
}

// Build final path from segments
function buildNewPath(segments) {
  if (segments.length === 0) return '';
  
  let pathStr = '';
  let currentX = 0;
  let currentY = 0;
  let needsMove = true;
  
  segments.forEach(seg => {
    if (seg.type === 'M') {
      pathStr += `M${seg.x},${seg.y}`;
      currentX = seg.x;
      currentY = seg.y;
      needsMove = false;
    } else if (seg.type === 'C') {
      // Check if we need a move command
      const tolerance = 0.1;
      if (needsMove || Math.abs(currentX - seg.x1) > tolerance || Math.abs(currentY - seg.y1) > tolerance) {
        pathStr += `M${seg.x1},${seg.y1}`;
      }
      pathStr += `C${seg.cp1x},${seg.cp1y},${seg.cp2x},${seg.cp2y},${seg.x2},${seg.y2}`;
      currentX = seg.x2;
      currentY = seg.y2;
      needsMove = false;
    }
  });
  
  // Close the path if it's not already closed
  if (!needsMove) {
    pathStr += 'Z';
  }
  
  return pathStr;
}

// Simplified union for non-intersecting shapes
function simpleUnion(path1Str, path2Str) {
  // For union of non-intersecting shapes, just combine them as separate subpaths
  console.log('[Boolean Ops] Creating simple union');
  console.log('[Boolean Ops] Path 1:', path1Str);
  console.log('[Boolean Ops] Path 2:', path2Str);
  
  // Remove any trailing Z and add proper separation
  const cleanPath1 = path1Str.replace(/Z\s*$/, '');
  const cleanPath2 = path2Str.replace(/Z\s*$/, '');
  
  const result = cleanPath1 + 'Z' + cleanPath2 + 'Z';
  console.log('[Boolean Ops] Combined path:', result);
  return result;
}

// Main boolean operation function
function operateBool(operation, path1Str, path2Str) {
  console.log('[Boolean Ops] Starting operation:', operation);
  console.log('[Boolean Ops] Path 1:', path1Str);
  console.log('[Boolean Ops] Path 2:', path2Str);
  
  // Generate path segments
  const segments1 = generatePathSegments(path1Str);
  const segments2 = generatePathSegments(path2Str);
  
  console.log('[Boolean Ops] Segments 1:', segments1.length);
  console.log('[Boolean Ops] Segments 2:', segments2.length);
  
  // Mark subpath endings
  markSubpathEndings(segments1);
  markSubpathEndings(segments2);
  
  // Find intersections
  const intersections = RaphaelUtils.pathIntersection(path1Str, path2Str);
  console.log('[Boolean Ops] Found intersections:', intersections.length);
  
  // For union operation with no intersections, simply combine paths
  if (operation === 'union' && intersections.length === 0) {
    console.log('[Boolean Ops] No intersections - combining paths');
    return simpleUnion(path1Str, path2Str);
  }
  
  // Insert intersection points
  const newSegs1 = intersections.length > 0 
    ? insertIntersectionPoints(segments1, 1, intersections)
    : segments1;
  const newSegs2 = intersections.length > 0
    ? insertIntersectionPoints(segments2, 2, intersections)
    : segments2;
  
  console.log('[Boolean Ops] Split segments 1:', newSegs1.length);
  console.log('[Boolean Ops] Split segments 2:', newSegs2.length);
  
  // Build new path parts
  const selectedSegments = buildNewPathParts(operation, newSegs1, newSegs2, path1Str, path2Str);
  console.log('[Boolean Ops] Selected segments:', selectedSegments.length);
  
  // If no segments selected, fallback to simple combination for union
  if (selectedSegments.length === 0 && operation === 'union') {
    return simpleUnion(path1Str, path2Str);
  }
  
  // Build final path
  const resultPath = buildNewPath(selectedSegments);
  console.log('[Boolean Ops] Result path:', resultPath);
  
  return resultPath;
}

// Parse SVG path to points for Excalidraw
function pathToPoints(pathStr, bounds) {
  console.log('[Boolean Ops] Converting path to points:', pathStr);
  console.log('[Boolean Ops] Bounds:', bounds);
  
  if (!pathStr) {
    console.error('[Boolean Ops] Empty path string');
    return [];
  }
  
  try {
    const path = RaphaelUtils.path2curve(pathStr);
    const points = [];
    
    for (let i = 0; i < path.length; i++) {
      const seg = path[i];
      if (seg[0] === 'M') {
        points.push([seg[1] - bounds.x, seg[2] - bounds.y]);
      } else if (seg[0] === 'C') {
        // For bezier curves, we'll approximate with line segments
        const steps = 3; // Reduced steps for simpler polygon
        for (let t = 1; t <= steps; t++) { // Start from 1 to skip duplicate point
          const tt = t / steps;
          const x = Math.pow(1 - tt, 3) * seg[1] + 
                    3 * Math.pow(1 - tt, 2) * tt * seg[3] +
                    3 * (1 - tt) * Math.pow(tt, 2) * seg[5] +
                    Math.pow(tt, 3) * seg[7];
          const y = Math.pow(1 - tt, 3) * seg[2] + 
                    3 * Math.pow(1 - tt, 2) * tt * seg[4] +
                    3 * (1 - tt) * Math.pow(tt, 2) * seg[6] +
                    Math.pow(tt, 3) * seg[8];
          points.push([x - bounds.x, y - bounds.y]);
        }
      }
    }
    
    console.log('[Boolean Ops] Generated points:', points.length, points);
    
    // Ensure we have at least 3 points for a valid polygon
    if (points.length < 3) {
      console.warn('[Boolean Ops] Not enough points, adding fallback points');
      // Create a simple rectangle as fallback
      return [
        [0, 0],
        [bounds.width, 0],
        [bounds.width, bounds.height],
        [0, bounds.height]
      ];
    }
    
    return points;
  } catch (error) {
    console.error('[Boolean Ops] Error converting path to points:', error);
    // Return fallback rectangle
    return [
      [0, 0],
      [bounds.width, 0],
      [bounds.width, bounds.height],
      [0, bounds.height]
    ];
  }
}

// Get bounding box of path
function getPathBounds(pathStr) {
  console.log('[Boolean Ops] Getting bounds for path:', pathStr);
  
  if (!pathStr) {
    return { x: 0, y: 0, width: 100, height: 100 };
  }
  
  try {
    const path = RaphaelUtils.path2curve(pathStr);
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    for (let i = 0; i < path.length; i++) {
      const seg = path[i];
      if (seg[0] === 'M' || seg[0] === 'C') {
        for (let j = 1; j < seg.length; j += 2) {
          if (seg[j] !== undefined && seg[j + 1] !== undefined) {
            minX = Math.min(minX, seg[j]);
            maxX = Math.max(maxX, seg[j]);
            minY = Math.min(minY, seg[j + 1]);
            maxY = Math.max(maxY, seg[j + 1]);
          }
        }
      }
    }
    
    // Check if we got valid bounds
    if (minX === Infinity || maxX === -Infinity || minY === Infinity || maxY === -Infinity) {
      console.warn('[Boolean Ops] Invalid bounds, using fallback');
      return { x: 0, y: 0, width: 100, height: 100 };
    }
    
    const bounds = {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
    
    console.log('[Boolean Ops] Calculated bounds:', bounds);
    return bounds;
  } catch (error) {
    console.error('[Boolean Ops] Error calculating bounds:', error);
    return { x: 0, y: 0, width: 100, height: 100 };
  }
}

// Main entry point for boolean operations
window.performExcalidrawBooleanOp = function(elements, operation) {
  console.log('[Boolean Ops Core] Starting operation with elements:', elements);
  console.log('[Boolean Ops Core] Operation type:', operation);
  
  if (elements.length !== 2) {
    throw new Error('Boolean operations require exactly 2 elements');
  }
  
  try {
    // Handle exclusion as special case
    if (operation === 'exclusion') {
      // Exclusion = Union - Intersection
      const unionResult = window.performExcalidrawBooleanOp(elements, 'union');
      const intersectionResult = window.performExcalidrawBooleanOp(elements, 'intersection');
      
      return window.performExcalidrawBooleanOp([unionResult, intersectionResult], 'difference');
    }
    
    // Convert elements to path strings
    const path1Str = elementToPathString(elements[0]);
    const path2Str = elementToPathString(elements[1]);
    
    // Perform boolean operation
    const resultPathStr = operateBool(operation, path1Str, path2Str);
    
    if (!resultPathStr) {
      throw new Error('Boolean operation resulted in empty shape');
    }
    
    // Get bounds of result
    let bounds = getPathBounds(resultPathStr);
    
    // Always use combined bounds of original elements for now (simpler approach)
    console.log('[Boolean Ops] Using element bounds');
    const el1 = elements[0];
    const el2 = elements[1];
    bounds = {
      x: Math.min(el1.x, el2.x),
      y: Math.min(el1.y, el2.y),
      width: Math.max(el1.x + el1.width, el2.x + el2.width) - Math.min(el1.x, el2.x),
      height: Math.max(el1.y + el1.height, el2.y + el2.height) - Math.min(el1.y, el2.y)
    };
    console.log('[Boolean Ops] Using bounds:', bounds);
    
    // For now, create a simple polygon that covers both shapes (union approximation)
    let points;
    if (operation === 'union') {
      // Create a simple bounding box union for testing
      points = [
        [0, 0],
        [bounds.width, 0],
        [bounds.width, bounds.height],
        [0, bounds.height]
      ];
      console.log('[Boolean Ops] Using simple union bounds as points');
    } else {
      // Convert to points for other operations
      points = pathToPoints(resultPathStr, bounds);
      
      // Ensure points is a valid array
      if (!Array.isArray(points) || points.length === 0) {
        console.warn('[Boolean Ops] No points generated, using bounding box');
        points = [
          [0, 0],
          [bounds.width, 0],
          [bounds.width, bounds.height],
          [0, bounds.height]
        ];
      }
    }
    
    console.log('[Boolean Ops] Final points:', points);
    
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
    console.error('[Boolean Ops Core] Error:', error);
    throw error;
  }
};

// Generate a random ID similar to Excalidraw's format
function generateId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 12; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}