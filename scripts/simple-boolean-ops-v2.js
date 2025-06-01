// Simplified Boolean Operations following diff.diff logic more closely
// This version focuses on getting the connectivity right

// Convert Excalidraw element to SVG path string
function elementToPath(element) {
  switch (element.type) {
    case 'rectangle':
      const { x, y, width, height } = element;
      return `M ${x} ${y} L ${x + width} ${y} L ${x + width} ${y + height} L ${x} ${y + height} Z`;
    
    case 'ellipse':
      const cx = element.x + element.width / 2;
      const cy = element.y + element.height / 2;
      const rx = element.width / 2;
      const ry = element.height / 2;
      return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 0 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 0 0 ${cx - rx} ${cy} Z`;
      
    case 'diamond':
      const dcx = element.x + element.width / 2;
      const dcy = element.y + element.height / 2;
      return `M ${dcx} ${element.y} L ${element.x + element.width} ${dcy} L ${dcx} ${element.y + element.height} L ${element.x} ${dcy} Z`;
      
    case 'line':
      if (element.points && element.points.length >= 3) {
        let path = `M ${element.x + element.points[0][0]} ${element.y + element.points[0][1]}`;
        for (let i = 1; i < element.points.length; i++) {
          path += ` L ${element.x + element.points[i][0]} ${element.y + element.points[i][1]}`;
        }
        const first = element.points[0];
        const last = element.points[element.points.length - 1];
        const isClosed = Math.abs(first[0] - last[0]) < 1 && Math.abs(first[1] - last[1]) < 1;
        if (isClosed) path += ' Z';
        return path;
      }
      throw new Error('Line must have at least 3 points');
      
    default:
      throw new Error(`Unsupported element type: ${element.type}`);
  }
}

// Simple segment representation
function pathToSegments(pathStr) {
  const segments = [];
  const commands = pathStr.match(/[MLHVCSQTAZ][^MLHVCSQTAZ]*/gi);
  
  let currentX = 0, currentY = 0;
  let startX = 0, startY = 0;
  
  commands.forEach(cmd => {
    const type = cmd[0].toUpperCase();
    const coords = cmd.slice(1).trim().split(/[\s,]+/).map(parseFloat);
    
    switch (type) {
      case 'M':
        currentX = coords[0];
        currentY = coords[1];
        startX = currentX;
        startY = currentY;
        break;
        
      case 'L':
        segments.push({
          type: 'line',
          x1: currentX,
          y1: currentY,
          x2: coords[0],
          y2: coords[1],
          pathId: null
        });
        currentX = coords[0];
        currentY = coords[1];
        break;
        
      case 'Z':
        if (Math.abs(currentX - startX) > 0.1 || Math.abs(currentY - startY) > 0.1) {
          segments.push({
            type: 'line',
            x1: currentX,
            y1: currentY,
            x2: startX,
            y2: startY,
            pathId: null
          });
        }
        currentX = startX;
        currentY = startY;
        break;
        
      case 'A':
        // Approximate arc with line segments
        const arcSegments = approximateArc(
          currentX, currentY,
          coords[0], coords[1], // rx, ry
          coords[2], // rotation
          coords[3], coords[4], // large arc, sweep
          coords[5], coords[6]  // end x, y
        );
        segments.push(...arcSegments);
        currentX = coords[5];
        currentY = coords[6];
        break;
    }
  });
  
  return segments;
}

// Approximate arc with line segments
function approximateArc(x1, y1, rx, ry, rotation, largeArc, sweep, x2, y2) {
  const segments = [];
  const steps = 16; // Number of line segments
  
  // This is simplified - just interpolate along the arc
  for (let i = 0; i < steps; i++) {
    const t1 = i / steps;
    const t2 = (i + 1) / steps;
    
    // Simple interpolation for demonstration
    const angle1 = t1 * Math.PI * 2;
    const angle2 = t2 * Math.PI * 2;
    
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    
    segments.push({
      type: 'line',
      x1: cx + rx * Math.cos(angle1),
      y1: cy + ry * Math.sin(angle1),
      x2: cx + rx * Math.cos(angle2),
      y2: cy + ry * Math.sin(angle2),
      pathId: null
    });
  }
  
  return segments;
}

// Find line-line intersection
function lineIntersection(seg1, seg2) {
  const x1 = seg1.x1, y1 = seg1.y1;
  const x2 = seg1.x2, y2 = seg1.y2;
  const x3 = seg2.x1, y3 = seg2.y1;
  const x4 = seg2.x2, y4 = seg2.y2;
  
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 1e-10) return null;
  
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
  
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      x: x1 + t * (x2 - x1),
      y: y1 + t * (y2 - y1),
      t1: t,
      t2: u
    };
  }
  
  return null;
}

// Split segment at parameter t
function splitSegment(seg, t) {
  const x = seg.x1 + t * (seg.x2 - seg.x1);
  const y = seg.y1 + t * (seg.y2 - seg.y1);
  
  return [
    { ...seg, x2: x, y2: y },
    { ...seg, x1: x, y1: y }
  ];
}

// Check if point is inside polygon
function isPointInPolygon(x, y, segments) {
  let inside = false;
  
  segments.forEach(seg => {
    if ((seg.y1 > y) !== (seg.y2 > y)) {
      const slope = (seg.x2 - seg.x1) / (seg.y2 - seg.y1);
      if (x < slope * (y - seg.y1) + seg.x1) {
        inside = !inside;
      }
    }
  });
  
  return inside;
}

// Main boolean operation
function performBooleanOp(path1Str, path2Str, operation) {
  console.log('[Boolean Ops V2] Starting', operation);
  
  // Convert paths to segments
  const segments1 = pathToSegments(path1Str);
  const segments2 = pathToSegments(path2Str);
  
  segments1.forEach(seg => seg.pathId = 1);
  segments2.forEach(seg => seg.pathId = 2);
  
  console.log('[Boolean Ops V2] Path1 segments:', segments1.length);
  console.log('[Boolean Ops V2] Path2 segments:', segments2.length);
  
  // Find all intersections
  const intersections = [];
  segments1.forEach((seg1, i) => {
    segments2.forEach((seg2, j) => {
      const int = lineIntersection(seg1, seg2);
      if (int) {
        int.seg1Index = i;
        int.seg2Index = j;
        intersections.push(int);
      }
    });
  });
  
  console.log('[Boolean Ops V2] Found intersections:', intersections.length);
  
  // Split segments at intersections
  let allSegments = [...segments1, ...segments2];
  
  // Sort intersections by segment and t value
  const splitPoints = new Map();
  
  intersections.forEach(int => {
    // For path1 segment
    const key1 = `1_${int.seg1Index}`;
    if (!splitPoints.has(key1)) splitPoints.set(key1, []);
    splitPoints.get(key1).push({ t: int.t1, int });
    
    // For path2 segment
    const key2 = `2_${int.seg2Index}`;
    if (!splitPoints.has(key2)) splitPoints.set(key2, []);
    splitPoints.get(key2).push({ t: int.t2, int });
  });
  
  // Split segments
  const finalSegments = [];
  
  segments1.forEach((seg, idx) => {
    const key = `1_${idx}`;
    const splits = splitPoints.get(key);
    
    if (!splits || splits.length === 0) {
      finalSegments.push(seg);
    } else {
      // Sort by t value
      splits.sort((a, b) => a.t - b.t);
      
      let currentSeg = seg;
      let lastT = 0;
      
      splits.forEach(split => {
        const adjustedT = (split.t - lastT) / (1 - lastT);
        const [before, after] = splitSegment(currentSeg, adjustedT);
        finalSegments.push(before);
        currentSeg = after;
        lastT = split.t;
      });
      
      finalSegments.push(currentSeg);
    }
  });
  
  segments2.forEach((seg, idx) => {
    const key = `2_${idx}`;
    const splits = splitPoints.get(key);
    
    if (!splits || splits.length === 0) {
      finalSegments.push(seg);
    } else {
      // Sort by t value
      splits.sort((a, b) => a.t - b.t);
      
      let currentSeg = seg;
      let lastT = 0;
      
      splits.forEach(split => {
        const adjustedT = (split.t - lastT) / (1 - lastT);
        const [before, after] = splitSegment(currentSeg, adjustedT);
        finalSegments.push(before);
        currentSeg = after;
        lastT = split.t;
      });
      
      finalSegments.push(currentSeg);
    }
  });
  
  console.log('[Boolean Ops V2] Segments after splitting:', finalSegments.length);
  
  // Filter segments based on operation
  const rules = {
    union: { 1: false, 2: false }, // Keep segments NOT inside other shape
    intersection: { 1: true, 2: true }, // Keep segments inside other shape
    difference: { 1: false, 2: true }, // Path1 not inside, path2 inside
    exclusion: { 1: false, 2: false } // Same as union, then handle separately
  };
  
  const rule = rules[operation];
  const keptSegments = [];
  
  finalSegments.forEach(seg => {
    const midX = (seg.x1 + seg.x2) / 2;
    const midY = (seg.y1 + seg.y2) / 2;
    
    const otherSegments = finalSegments.filter(s => s.pathId !== seg.pathId);
    const isInside = isPointInPolygon(midX, midY, otherSegments);
    
    const shouldKeep = rule[seg.pathId] ? isInside : !isInside;
    
    if (shouldKeep) {
      keptSegments.push(seg);
    }
  });
  
  console.log('[Boolean Ops V2] Kept segments:', keptSegments.length);
  
  // Build connected paths
  const paths = buildConnectedPaths(keptSegments);
  
  return paths;
}

// Build connected paths from segments
function buildConnectedPaths(segments) {
  const paths = [];
  const used = new Set();
  const EPSILON = 0.1;
  
  while (used.size < segments.length) {
    // Find unused segment
    let start = null;
    for (let i = 0; i < segments.length; i++) {
      if (!used.has(i)) {
        start = i;
        break;
      }
    }
    
    if (start === null) break;
    
    const path = [];
    let current = start;
    
    // Build path
    while (current !== null && !used.has(current)) {
      used.add(current);
      path.push(segments[current]);
      
      // Find next segment
      const endX = segments[current].x2;
      const endY = segments[current].y2;
      let next = null;
      let minDist = Infinity;
      
      for (let i = 0; i < segments.length; i++) {
        if (used.has(i)) continue;
        
        const dist = Math.sqrt(
          Math.pow(segments[i].x1 - endX, 2) + 
          Math.pow(segments[i].y1 - endY, 2)
        );
        
        if (dist < EPSILON && dist < minDist) {
          next = i;
          minDist = dist;
        }
      }
      
      current = next;
    }
    
    if (path.length > 0) {
      paths.push(path);
    }
  }
  
  return paths;
}

// Convert paths to Excalidraw element
function pathsToElement(paths, originalElement) {
  if (paths.length === 0) return null;
  
  // Find bounds
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;
  
  paths.forEach(path => {
    path.forEach(seg => {
      minX = Math.min(minX, seg.x1, seg.x2);
      maxX = Math.max(maxX, seg.x1, seg.x2);
      minY = Math.min(minY, seg.y1, seg.y2);
      maxY = Math.max(maxY, seg.y1, seg.y2);
    });
  });
  
  // Convert to points
  const points = [];
  if (paths[0] && paths[0].length > 0) {
    // Start from first segment
    points.push([paths[0][0].x1 - minX, paths[0][0].y1 - minY]);
    
    paths[0].forEach(seg => {
      points.push([seg.x2 - minX, seg.y2 - minY]);
    });
  }
  
  return {
    id: generateId(),
    type: 'line',
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    angle: 0,
    strokeColor: originalElement.strokeColor || '#000000',
    backgroundColor: originalElement.backgroundColor || 'transparent',
    fillStyle: originalElement.fillStyle || 'solid',
    strokeWidth: originalElement.strokeWidth || 1,
    strokeStyle: originalElement.strokeStyle || 'solid',
    roughness: originalElement.roughness || 1,
    opacity: originalElement.opacity || 100,
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

// Generate random ID
function generateId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 12; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

// Main entry point
window.performExcalidrawBooleanOpV2 = function(elements, operation) {
  console.log('[Boolean Ops V2] Starting operation:', operation);
  
  if (elements.length !== 2) {
    throw new Error('Boolean operations require exactly 2 elements');
  }
  
  try {
    const path1 = elementToPath(elements[0]);
    const path2 = elementToPath(elements[1]);
    
    const paths = performBooleanOp(path1, path2, operation);
    
    if (paths.length === 0) {
      throw new Error('Operation resulted in empty shape');
    }
    
    return pathsToElement(paths, elements[0]);
  } catch (error) {
    console.error('[Boolean Ops V2] Error:', error);
    throw error;
  }
};