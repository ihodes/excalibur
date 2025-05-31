// Boolean Operations Core Logic
// Implementation based on the Excalibur diff.diff methodology

// Convert Excalidraw element to SVG path string
function elementToPathString(element) {
  switch (element.type) {
    case 'rectangle': {
      const x = element.x;
      const y = element.y; 
      const w = element.width;
      const h = element.height;
      return `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`;
    }
    
    case 'ellipse': {
      // Convert ellipse to path using bezier curves (as per diff.diff)
      const cx = element.x + element.width / 2;
      const cy = element.y + element.height / 2;
      const rx = element.width / 2;
      const ry = element.height / 2;
      
      // Magic number for bezier curve approximation
      const k = 0.5522847498;
      const ox = rx * k;
      const oy = ry * k;
      
      let d = `M ${cx - rx} ${cy} `;
      d += `C ${cx - rx} ${cy - oy} ${cx - ox} ${cy - ry} ${cx} ${cy - ry} `;
      d += `C ${cx + ox} ${cy - ry} ${cx + rx} ${cy - oy} ${cx + rx} ${cy} `;
      d += `C ${cx + rx} ${cy + oy} ${cx + ox} ${cy + ry} ${cx} ${cy + ry} `;
      d += `C ${cx - ox} ${cy + ry} ${cx - rx} ${cy + oy} ${cx - rx} ${cy} Z`;
      return d;
    }
    
    case 'diamond': {
      const x = element.x;
      const y = element.y;
      const w = element.width;
      const h = element.height;
      return `M ${x + w/2} ${y} L ${x + w} ${y + h/2} L ${x + w/2} ${y + h} L ${x} ${y + h/2} Z`;
    }
    
    case 'line': {
      // Closed polygon
      if (element.points && element.points.length >= 3) {
        let d = `M ${element.x + element.points[0][0]} ${element.y + element.points[0][1]}`;
        for (let i = 1; i < element.points.length; i++) {
          d += ` L ${element.x + element.points[i][0]} ${element.y + element.points[i][1]}`;
        }
        d += ' Z';
        return d;
      }
      break;
    }
    
    default:
      throw new Error(`Unsupported element type: ${element.type}`);
  }
}

// Parse SVG path to segments (simplified version based on diff.diff)
function pathToSegments(pathStr) {
  // This is a simplified parser - in production you'd use a full SVG path parser
  const segments = [];
  const commands = pathStr.match(/[MLCZmlcz][^MLCZmlcz]*/g) || [];
  
  let currentX = 0, currentY = 0;
  let startX = 0, startY = 0;
  
  commands.forEach(cmd => {
    const type = cmd[0];
    const coords = cmd.slice(1).trim().split(/[\s,]+/).map(Number);
    
    switch (type.toUpperCase()) {
      case 'M':
        currentX = coords[0];
        currentY = coords[1];
        startX = currentX;
        startY = currentY;
        segments.push({ type: 'M', x: currentX, y: currentY });
        break;
      case 'L':
        segments.push({ 
          type: 'L', 
          x1: currentX, y1: currentY,
          x2: coords[0], y2: coords[1]
        });
        currentX = coords[0];
        currentY = coords[1];
        break;
      case 'C':
        segments.push({
          type: 'C',
          x1: currentX, y1: currentY,
          cp1x: coords[0], cp1y: coords[1],
          cp2x: coords[2], cp2y: coords[3],
          x2: coords[4], y2: coords[5]
        });
        currentX = coords[4];
        currentY = coords[5];
        break;
      case 'Z':
        if (currentX !== startX || currentY !== startY) {
          segments.push({
            type: 'L',
            x1: currentX, y1: currentY,
            x2: startX, y2: startY
          });
        }
        segments.push({ type: 'Z' });
        currentX = startX;
        currentY = startY;
        break;
    }
  });
  
  return segments;
}

// Find intersections between two paths (based on diff.diff methodology)
function findIntersections(segments1, segments2) {
  const intersections = [];
  
  // Check each segment pair for intersections
  segments1.forEach((seg1, i) => {
    if (seg1.type === 'M' || seg1.type === 'Z') return;
    
    segments2.forEach((seg2, j) => {
      if (seg2.type === 'M' || seg2.type === 'Z') return;
      
      // For simplicity, we'll handle line-line intersections
      // Full implementation would handle bezier curves too
      if (seg1.type === 'L' && seg2.type === 'L') {
        const intersection = lineLineIntersection(
          seg1.x1, seg1.y1, seg1.x2, seg1.y2,
          seg2.x1, seg2.y1, seg2.x2, seg2.y2
        );
        
        if (intersection) {
          intersections.push({
            x: intersection.x,
            y: intersection.y,
            seg1Index: i,
            seg2Index: j,
            t1: intersection.t1,
            t2: intersection.t2
          });
        }
      }
    });
  });
  
  return intersections;
}

// Line-line intersection
function lineLineIntersection(x1, y1, x2, y2, x3, y3, x4, y4) {
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 1e-10) return null;
  
  const t1 = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const t2 = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
  
  if (t1 >= 0 && t1 <= 1 && t2 >= 0 && t2 <= 1) {
    return {
      x: x1 + t1 * (x2 - x1),
      y: y1 + t1 * (y2 - y1),
      t1: t1,
      t2: t2
    };
  }
  
  return null;
}

// Check if a point is inside a path using ray casting
function isPointInsidePath(x, y, segments) {
  let inside = false;
  
  segments.forEach(seg => {
    if (seg.type === 'L') {
      const x1 = seg.x1, y1 = seg.y1;
      const x2 = seg.x2, y2 = seg.y2;
      
      // Ray casting algorithm
      if ((y1 > y) !== (y2 > y)) {
        const slope = (x2 - x1) / (y2 - y1);
        if (x < slope * (y - y1) + x1) {
          inside = !inside;
        }
      }
    }
    // For bezier curves, we'd need to subdivide and check
  });
  
  return inside;
}

// Split segments at intersection points
function splitSegmentsAtIntersections(segments, intersections, pathIndex) {
  const result = [];
  
  segments.forEach((seg, i) => {
    if (seg.type === 'M' || seg.type === 'Z') {
      result.push(seg);
      return;
    }
    
    // Find intersections on this segment
    const segIntersections = intersections
      .filter(inter => inter[`seg${pathIndex}Index`] === i)
      .sort((a, b) => a[`t${pathIndex}`] - b[`t${pathIndex}`]);
    
    if (segIntersections.length === 0) {
      result.push(seg);
      return;
    }
    
    // Split segment at intersection points
    let lastT = 0;
    let lastX = seg.x1, lastY = seg.y1;
    
    segIntersections.forEach(inter => {
      const t = inter[`t${pathIndex}`];
      if (seg.type === 'L') {
        result.push({
          type: 'L',
          x1: lastX, y1: lastY,
          x2: inter.x, y2: inter.y
        });
        lastX = inter.x;
        lastY = inter.y;
        lastT = t;
      }
    });
    
    // Add remaining part
    if (lastT < 1) {
      result.push({
        type: 'L',
        x1: lastX, y1: lastY,
        x2: seg.x2, y2: seg.y2
      });
    }
  });
  
  return result;
}

// Get midpoint of a segment for inside/outside testing
function getSegmentMidpoint(seg) {
  if (seg.type === 'L') {
    return {
      x: (seg.x1 + seg.x2) / 2,
      y: (seg.y1 + seg.y2) / 2
    };
  }
  // For bezier curves, evaluate at t=0.5
  return { x: 0, y: 0 };
}

// Build new path from selected segments
function buildPathFromSegments(segments) {
  if (segments.length === 0) return '';
  
  let path = '';
  let currentX = 0, currentY = 0;
  let needsMove = true;
  
  segments.forEach(seg => {
    if (seg.type === 'M') {
      path += `M ${seg.x} ${seg.y} `;
      currentX = seg.x;
      currentY = seg.y;
      needsMove = false;
    } else if (seg.type === 'L') {
      // Check if we need a move command
      if (needsMove || Math.abs(currentX - seg.x1) > 0.1 || Math.abs(currentY - seg.y1) > 0.1) {
        path += `M ${seg.x1} ${seg.y1} `;
      }
      path += `L ${seg.x2} ${seg.y2} `;
      currentX = seg.x2;
      currentY = seg.y2;
      needsMove = false;
    } else if (seg.type === 'C') {
      if (needsMove || Math.abs(currentX - seg.x1) > 0.1 || Math.abs(currentY - seg.y1) > 0.1) {
        path += `M ${seg.x1} ${seg.y1} `;
      }
      path += `C ${seg.cp1x} ${seg.cp1y} ${seg.cp2x} ${seg.cp2y} ${seg.x2} ${seg.y2} `;
      currentX = seg.x2;
      currentY = seg.y2;
      needsMove = false;
    } else if (seg.type === 'Z') {
      path += 'Z ';
      needsMove = true;
    }
  });
  
  return path.trim();
}

// Perform boolean operation
function performBooleanOp(elements, operation, paper) {
  if (elements.length !== 2) {
    throw new Error('Boolean operations require exactly 2 elements');
  }
  
  console.log('[Boolean Ops Core] Starting operation:', operation);
  
  // Convert elements to path strings
  const path1Str = elementToPathString(elements[0]);
  const path2Str = elementToPathString(elements[1]);
  
  // Parse paths to segments
  const segments1 = pathToSegments(path1Str);
  const segments2 = pathToSegments(path2Str);
  
  console.log('[Boolean Ops Core] Path 1 segments:', segments1.length);
  console.log('[Boolean Ops Core] Path 2 segments:', segments2.length);
  
  // Find intersections
  const intersections = findIntersections(segments1, segments2);
  console.log('[Boolean Ops Core] Found', intersections.length, 'intersections');
  
  // Split segments at intersections
  const splitSegs1 = splitSegmentsAtIntersections(segments1, intersections, 1);
  const splitSegs2 = splitSegmentsAtIntersections(segments2, intersections, 2);
  
  // Define rules for each operation (from diff.diff)
  const rules = {
    union: {
      0: false,  // path1 - keep segments NOT inside path2
      1: false,  // path2 - keep segments NOT inside path1
    },
    difference: {
      0: false,  // path1 - keep segments NOT inside path2
      1: true,   // path2 - keep segments inside path1 (inverted)
    },
    intersection: {
      0: true,   // path1 - keep segments inside path2
      1: true,   // path2 - keep segments inside path1
    },
    exclusion: {
      // Handled as (A ∪ B) - (A ∩ B)
      0: false,
      1: false,
    }
  };
  
  // Select segments based on rules
  const selectedSegments = [];
  const rule = rules[operation];
  
  // Process path1 segments
  splitSegs1.forEach(seg => {
    if (seg.type === 'M' || seg.type === 'Z') return;
    
    const midpoint = getSegmentMidpoint(seg);
    const isInside = isPointInsidePath(midpoint.x, midpoint.y, segments2);
    const keep = rule[0] ? isInside : !isInside;
    
    if (keep) {
      selectedSegments.push(seg);
    }
  });
  
  // Process path2 segments
  splitSegs2.forEach(seg => {
    if (seg.type === 'M' || seg.type === 'Z') return;
    
    const midpoint = getSegmentMidpoint(seg);
    const isInside = isPointInsidePath(midpoint.x, midpoint.y, segments1);
    const keep = rule[1] ? isInside : !isInside;
    
    if (keep) {
      selectedSegments.push(seg);
    }
  });
  
  console.log('[Boolean Ops Core] Selected', selectedSegments.length, 'segments');
  
  // Build result path
  const resultPathStr = buildPathFromSegments(selectedSegments);
  
  if (!resultPathStr) {
    throw new Error('Boolean operation resulted in empty shape');
  }
  
  // Create Paper.js path from result
  const resultPath = new paper.Path(resultPathStr);
  
  // Simplify and clean up the path
  resultPath.simplify(1.5);
  
  return resultPath;
}

// Convert Paper.js path back to Excalidraw element
function pathToExcalidrawElement(path, originalElements, operation) {
  // Get the bounds
  const bounds = path.bounds;
  
  // Get segments
  const segments = path.segments;
  const points = segments.map(segment => [
    segment.point.x - bounds.x,
    segment.point.y - bounds.y
  ]);
  
  // Ensure the path is closed
  if (points.length > 0) {
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    const distance = Math.sqrt(
      Math.pow(firstPoint[0] - lastPoint[0], 2) + 
      Math.pow(firstPoint[1] - lastPoint[1], 2)
    );
    
    if (distance > 1) {
      points.push([firstPoint[0], firstPoint[1]]);
    }
  }
  
  // Get properties from first original element
  const firstElement = originalElements[0];
  
  return {
    id: generateId(),
    type: 'line',
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    angle: 0,
    strokeColor: firstElement.strokeColor,
    backgroundColor: firstElement.backgroundColor,
    fillStyle: firstElement.fillStyle,
    strokeWidth: firstElement.strokeWidth,
    strokeStyle: firstElement.strokeStyle,
    roughness: firstElement.roughness,
    opacity: firstElement.opacity,
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
}

// Generate a random ID similar to Excalidraw's format
function generateId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 12; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

// Main entry point for boolean operations
window.performExcalidrawBooleanOp = function(elements, operation) {
  console.log('[Boolean Ops Core] Starting operation with elements:', elements);
  console.log('[Boolean Ops Core] Operation type:', operation);
  
  // Validate Paper.js is loaded
  if (typeof paper === 'undefined') {
    throw new Error('Paper.js library not loaded');
  }
  
  // Initialize Paper.js with a temporary canvas
  const canvas = document.createElement('canvas');
  canvas.width = 2000;
  canvas.height = 2000;
  paper.setup(canvas);
  
  try {
    // Handle exclusion as special case
    if (operation === 'exclusion') {
      // Exclusion = Union - Intersection
      const unionPath = performBooleanOp(elements, 'union', paper);
      const intersectionPath = performBooleanOp(elements, 'intersection', paper);
      
      // Create temporary elements
      const unionBounds = unionPath.bounds;
      const interBounds = intersectionPath.bounds;
      
      const tempElements = [
        {
          type: 'line',
          x: unionBounds.x,
          y: unionBounds.y,
          width: unionBounds.width,
          height: unionBounds.height,
          points: unionPath.segments.map(s => [s.point.x - unionBounds.x, s.point.y - unionBounds.y])
        },
        {
          type: 'line',
          x: interBounds.x,
          y: interBounds.y,
          width: interBounds.width,
          height: interBounds.height,
          points: intersectionPath.segments.map(s => [s.point.x - interBounds.x, s.point.y - interBounds.y])
        }
      ];
      
      const resultPath = performBooleanOp(tempElements, 'difference', paper);
      
      unionPath.remove();
      intersectionPath.remove();
      
      const newElement = pathToExcalidrawElement(resultPath, elements, operation);
      resultPath.remove();
      
      return newElement;
    }
    
    // Perform the boolean operation
    const resultPath = performBooleanOp(elements, operation, paper);
    
    console.log('[Boolean Ops Core] Result path created');
    
    // Convert back to Excalidraw element
    const newElement = pathToExcalidrawElement(resultPath, elements, operation);
    
    console.log('[Boolean Ops Core] Created element:', newElement);
    
    // Clean up
    resultPath.remove();
    
    return newElement;
  } catch (error) {
    console.error('[Boolean Ops Core] Error:', error);
    throw error;
  } finally {
    // Clean up Paper.js
    paper.project.clear();
  }
};