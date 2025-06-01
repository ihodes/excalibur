// Exact implementation following diff.diff structure

// Path parsing from Raphael
function parsePathString(pathString) {
  if (!pathString) return null;
  const paramCounts = {a: 7, c: 6, h: 1, l: 2, m: 2, r: 4, q: 4, s: 4, t: 2, v: 1, z: 0};
  const data = [];
  String(pathString).replace(/([astvzqmhlcr])([^astvzqmhlcr]*)/gi, function(_, command, args) {
    const type = command.toLowerCase();
    args = args.match(/-?[.\d]+/g) || [];
    if (type == "m" && args.length > 2) {
      data.push([command].concat(args.splice(0, 2)));
      type = "l";
      command = command == "m" ? "l" : "L";
    }
    while (args.length >= paramCounts[type]) {
      data.push([command].concat(args.splice(0, paramCounts[type])));
      if (!paramCounts[type]) break;
    }
  });
  return data;
}

// Generate path segments exactly as diff.diff does
function generatePathSegments(path) {
  const segments = [];
  let currentX = 0, currentY = 0;

  path.forEach((pathCommand, i) => {
    const command = pathCommand[0];
    
    if (command === "M") {
      currentX = parseFloat(pathCommand[1]);
      currentY = parseFloat(pathCommand[2]);
    } else if (command === "L") {
      segments.push({
        i: i,
        x1: currentX,
        y1: currentY,
        x2: parseFloat(pathCommand[1]),
        y2: parseFloat(pathCommand[2]),
        bez: pathCommand,
        isMove: false,
        pathId: null
      });
      currentX = parseFloat(pathCommand[1]);
      currentY = parseFloat(pathCommand[2]);
    } else if (command === "Z") {
      // Close path - find the last M command
      for (let j = i - 1; j >= 0; j--) {
        if (path[j][0] === "M") {
          const startX = parseFloat(path[j][1]);
          const startY = parseFloat(path[j][2]);
          if (Math.abs(currentX - startX) > 0.1 || Math.abs(currentY - startY) > 0.1) {
            segments.push({
              i: i,
              x1: currentX,
              y1: currentY,
              x2: startX,
              y2: startY,
              bez: ["L", startX, startY],
              isMove: false,
              pathId: null
            });
          }
          currentX = startX;
          currentY = startY;
          break;
        }
      }
    }
  });

  return segments;
}

// Get intersections using simple line-line intersection for now
function getIntersections(path1, path2) {
  const segments1 = generatePathSegments(path1);
  const segments2 = generatePathSegments(path2);
  const intersections = [];

  segments1.forEach((seg1, i) => {
    if (seg1.isMove) return;
    
    segments2.forEach((seg2, j) => {
      if (seg2.isMove) return;
      
      const int = lineIntersection(
        seg1.x1, seg1.y1, seg1.x2, seg1.y2,
        seg2.x1, seg2.y1, seg2.x2, seg2.y2
      );
      
      if (int) {
        intersections.push({
          x: int.x,
          y: int.y,
          t1: int.t1,
          t2: int.t2,
          segment1: i,
          segment2: j,
          bez1: seg1.bez,
          bez2: seg2.bez
        });
      }
    });
  });

  return intersections;
}

function lineIntersection(x1, y1, x2, y2, x3, y3, x4, y4) {
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

// Build new path parts - exactly as diff.diff
function buildNewPathParts(path1, path2, intersections, rule) {
  const newPathParts = {
    path1: [],
    path2: []
  };
  
  // Add intersection info to segments
  const path1Segs = generatePathSegments(path1);
  const path2Segs = generatePathSegments(path2);
  
  path1Segs.forEach(seg => seg.pathId = 1);
  path2Segs.forEach(seg => seg.pathId = 2);
  
  // Mark intersection points on segments
  intersections.forEach((int, intIdx) => {
    int.id = intIdx; // Give each intersection a unique ID
    path1Segs[int.segment1].hasIntersection = true;
    path1Segs[int.segment1].intersection = int;
    path2Segs[int.segment2].hasIntersection = true;
    path2Segs[int.segment2].intersection = int;
  });
  
  // Process segments with intersection handling
  let currentPath1Segments = [];
  let currentPath2Segments = [];
  
  // Split path1 segments at intersections
  path1Segs.forEach((seg, idx) => {
    if (seg.isMove) return;
    
    if (seg.hasIntersection) {
      const int = seg.intersection;
      // Split segment at intersection
      currentPath1Segments.push({
        ...seg,
        x2: int.x,
        y2: int.y,
        nextIntersection: int
      });
      currentPath1Segments.push({
        ...seg,
        x1: int.x,
        y1: int.y,
        prevIntersection: int
      });
    } else {
      currentPath1Segments.push(seg);
    }
  });
  
  // Split path2 segments at intersections
  path2Segs.forEach((seg, idx) => {
    if (seg.isMove) return;
    
    if (seg.hasIntersection) {
      const int = seg.intersection;
      // Split segment at intersection
      currentPath2Segments.push({
        ...seg,
        x2: int.x,
        y2: int.y,
        nextIntersection: int
      });
      currentPath2Segments.push({
        ...seg,
        x1: int.x,
        y1: int.y,
        prevIntersection: int
      });
    } else {
      currentPath2Segments.push(seg);
    }
  });
  
  // Test which segments to keep
  currentPath1Segments.forEach(seg => {
    const midX = (seg.x1 + seg.x2) / 2;
    const midY = (seg.y1 + seg.y2) / 2;
    const isInside = isPointInsidePath(midX, midY, path2Array);
    
    if (rule === 0 ? !isInside : isInside) {
      newPathParts.path1.push(seg);
    }
  });
  
  currentPath2Segments.forEach(seg => {
    const midX = (seg.x1 + seg.x2) / 2;
    const midY = (seg.y1 + seg.y2) / 2;
    const isInside = isPointInsidePath(midX, midY, path1Array);
    
    if (rule === 0 ? !isInside : isInside) {
      newPathParts.path2.push(seg);
    }
  });
  
  return newPathParts;
}

function isPointInsidePath(x, y, path) {
  let inside = false;
  const segments = generatePathSegments(path);
  
  segments.forEach(seg => {
    if (seg.isMove) return;
    
    if ((seg.y1 > y) !== (seg.y2 > y)) {
      const slope = (seg.x2 - seg.x1) / (seg.y2 - seg.y1);
      if (x < slope * (y - seg.y1) + seg.x1) {
        inside = !inside;
      }
    }
  });
  
  return inside;
}

// Build new path - following diff.diff structure
function buildNewPath(parts, intersections, rule) {
  const allSegments = [...parts.path1, ...parts.path2];
  const paths = [];
  const used = new Set();
  
  while (used.size < allSegments.length) {
    // Find unused segment
    let startIdx = -1;
    for (let i = 0; i < allSegments.length; i++) {
      if (!used.has(i)) {
        startIdx = i;
        break;
      }
    }
    
    if (startIdx === -1) break;
    
    const path = [];
    let currentIdx = startIdx;
    
    while (currentIdx !== -1 && !used.has(currentIdx)) {
      used.add(currentIdx);
      const currentSeg = allSegments[currentIdx];
      path.push(currentSeg);
      
      // Find next segment
      let nextIdx = -1;
      
      // If we're at an intersection, follow the rules
      if (currentSeg.nextIntersection) {
        const int = currentSeg.nextIntersection;
        
        // Find segments at this intersection
        // First, collect all segments at this intersection point
        const segsAtIntersection = [];
        for (let i = 0; i < allSegments.length; i++) {
          if (used.has(i)) continue;
          
          const seg = allSegments[i];
          // Check if segment starts at this intersection
          if (seg.prevIntersection && seg.prevIntersection.id === int.id) {
            segsAtIntersection.push({ seg, idx: i });
          }
        }
        
        // Apply boolean rules
        if (rule === 0) { // Union - switch to other path
          // Find segment from different path
          for (const { seg, idx } of segsAtIntersection) {
            if (seg.pathId !== currentSeg.pathId) {
              nextIdx = idx;
              console.log('[Boolean Exact] Union: switching from path', currentSeg.pathId, 'to path', seg.pathId);
              break;
            }
          }
        } else if (rule === 1) { // Intersection - stay on same path
          // Find segment from same path
          for (const { seg, idx } of segsAtIntersection) {
            if (seg.pathId === currentSeg.pathId) {
              nextIdx = idx;
              break;
            }
          }
        }
      }
      
      // If no intersection-based next segment, find by proximity
      if (nextIdx === -1) {
        const endX = currentSeg.x2;
        const endY = currentSeg.y2;
        
        for (let i = 0; i < allSegments.length; i++) {
          if (used.has(i)) continue;
          
          const seg = allSegments[i];
          const dist = Math.sqrt(
            Math.pow(seg.x1 - endX, 2) + 
            Math.pow(seg.y1 - endY, 2)
          );
          
          if (dist < 0.1) {
            nextIdx = i;
            break;
          }
        }
      }
      
      currentIdx = nextIdx;
    }
    
    if (path.length > 0) {
      paths.push(path);
    }
  }
  
  return paths;
}

// Convert element to path
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
      // Simplified - just use lines for now
      const points = [];
      const steps = 32;
      for (let i = 0; i <= steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        points.push(`${cx + rx * Math.cos(angle)} ${cy + ry * Math.sin(angle)}`);
      }
      return `M ${points[0]} L ${points.slice(1).join(' L ')} Z`;
      
    case 'diamond':
      const dcx = element.x + element.width / 2;
      const dcy = element.y + element.height / 2;
      return `M ${dcx} ${element.y} L ${element.x + element.width} ${dcy} L ${dcx} ${element.y + element.height} L ${element.x} ${dcy} Z`;
      
    default:
      throw new Error(`Unsupported element type: ${element.type}`);
  }
}

// Main operation function
function operateBool(type, path1, path2) {
  const rules = {
    union: 0,
    intersection: 1,
    difference: 0,
    exclusion: 0
  };
  
  const rule = rules[type];
  
  const path1Array = parsePathString(path1);
  const path2Array = parsePathString(path2);
  
  console.log('[Boolean Exact] Path1 array:', path1Array);
  console.log('[Boolean Exact] Path2 array:', path2Array);
  
  const intersections = getIntersections(path1Array, path2Array);
  console.log('[Boolean Exact] Found intersections:', intersections.length);
  
  const parts = buildNewPathParts(path1Array, path2Array, intersections, rule);
  console.log('[Boolean Exact] Parts - path1:', parts.path1.length, 'path2:', parts.path2.length);
  
  const paths = buildNewPath(parts, intersections, rule);
  console.log('[Boolean Exact] Built paths:', paths.length);
  
  return paths;
}

// Convert paths back to Excalidraw
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

function generateId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 12; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

// Entry point
window.performExcalidrawBooleanOpExact = function(elements, operation) {
  if (elements.length !== 2) {
    throw new Error('Boolean operations require exactly 2 elements');
  }
  
  try {
    const path1 = elementToPath(elements[0]);
    const path2 = elementToPath(elements[1]);
    
    console.log('[Boolean Exact] Path1:', path1);
    console.log('[Boolean Exact] Path2:', path2);
    
    const paths = operateBool(operation, path1, path2);
    
    console.log('[Boolean Exact] Result paths:', paths.length);
    
    if (paths.length === 0) {
      throw new Error('Operation resulted in empty shape');
    }
    
    return pathsToElement(paths, elements[0]);
  } catch (error) {
    console.error('[Boolean Exact] Error:', error);
    throw error;
  }
};