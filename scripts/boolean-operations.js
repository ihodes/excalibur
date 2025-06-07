// Proper Boolean Operations for Excalidraw
(function() {
  'use strict';
  
  console.log('[BooleanOps] Script loaded successfully');

  // Convert element to points
  function elementToPoints(element) {
    const points = [];
    
    switch (element.type) {
      case 'rectangle':
        const { x, y, width, height } = element;
        points.push([x, y]);
        points.push([x + width, y]);
        points.push([x + width, y + height]);
        points.push([x, y + height]);
        break;
        
      case 'ellipse':
        // Sample points around the ellipse
        const cx = element.x + element.width / 2;
        const cy = element.y + element.height / 2;
        const rx = element.width / 2;
        const ry = element.height / 2;
        const steps = 32;
        for (let i = 0; i < steps; i++) {
          const angle = (i / steps) * Math.PI * 2;
          points.push([
            cx + rx * Math.cos(angle),
            cy + ry * Math.sin(angle)
          ]);
        }
        break;
        
      case 'diamond':
        const dcx = element.x + element.width / 2;
        const dcy = element.y + element.height / 2;
        points.push([dcx, element.y]);
        points.push([element.x + element.width, dcy]);
        points.push([dcx, element.y + element.height]);
        points.push([element.x, dcy]);
        break;
        
      case 'line':
        if (element.points && element.points.length >= 3) {
          element.points.forEach(p => {
            points.push([element.x + p[0], element.y + p[1]]);
          });
        }
        break;
    }
    
    return points;
  }

  // Cross product of vectors OA and OB
  function cross(O, A, B) {
    return (A[0] - O[0]) * (B[1] - O[1]) - (A[1] - O[1]) * (B[0] - O[0]);
  }

  // Convex hull using Andrew's monotone chain algorithm
  function convexHull(points) {
    points = [...points];
    points.sort((a, b) => a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]);
    
    if (points.length <= 1) return points;
    
    // Build lower hull
    const lower = [];
    for (let i = 0; i < points.length; i++) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], points[i]) <= 0) {
        lower.pop();
      }
      lower.push(points[i]);
    }
    
    // Build upper hull
    const upper = [];
    for (let i = points.length - 1; i >= 0; i--) {
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], points[i]) <= 0) {
        upper.pop();
      }
      upper.push(points[i]);
    }
    
    // Remove last point of each half because it's repeated
    lower.pop();
    upper.pop();
    
    return lower.concat(upper);
  }

  // Check if point is inside polygon (works for both convex and concave)
  function pointInPolygon(point, polygon) {
    let inside = false;
    const x = point[0], y = point[1];
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0], yi = polygon[i][1];
      const xj = polygon[j][0], yj = polygon[j][1];
      
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    
    return inside;
  }
  
  // Check if point is inside convex polygon (kept for compatibility)
  function pointInConvexPolygon(point, polygon) {
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i];
      const b = polygon[(i + 1) % polygon.length];
      if (cross(a, b, point) < 0) {
        return false;
      }
    }
    return true;
  }

  // Find intersection points between two line segments
  function lineIntersection(p1, p2, p3, p4) {
    const x1 = p1[0], y1 = p1[1];
    const x2 = p2[0], y2 = p2[1];
    const x3 = p3[0], y3 = p3[1];
    const x4 = p4[0], y4 = p4[1];
    
    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 1e-10) return null;
    
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
  
  // Check if two points are approximately equal
  function pointsEqual(p1, p2, epsilon = 1e-10) {
    return Math.abs(p1[0] - p2[0]) < epsilon && Math.abs(p1[1] - p2[1]) < epsilon;
  }
  
  // Find all intersections between two polygons
  function findPolygonIntersections(poly1, poly2) {
    const intersections = [];
    
    for (let i = 0; i < poly1.length; i++) {
      const p1 = poly1[i];
      const p2 = poly1[(i + 1) % poly1.length];
      
      for (let j = 0; j < poly2.length; j++) {
        const p3 = poly2[j];
        const p4 = poly2[(j + 1) % poly2.length];
        
        const intersection = lineIntersection(p1, p2, p3, p4);
        if (intersection) {
          intersections.push({
            point: intersection,
            edge1: i,
            edge2: j
          });
        }
      }
    }
    
    return intersections;
  }
  
  // Helper function to check if a segment midpoint is inside the other polygon
  function isSegmentOutside(p1, p2, polygon) {
    const midpoint = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
    return !pointInPolygon(midpoint, polygon);
  }

  // Proper polygon union algorithm
  function polygonUnion(poly1, poly2) {
    // Find all intersections
    const intersections = findPolygonIntersections(poly1, poly2);
    
    // Special cases
    if (intersections.length === 0) {
      // No intersections - check containment
      const poly1Inside = poly1.every(p => pointInPolygon(p, poly2));
      const poly2Inside = poly2.every(p => pointInPolygon(p, poly1));
      
      if (poly1Inside) return poly2;
      if (poly2Inside) return poly1;
      
      // Disjoint polygons - can't create a single union
      // Return the larger polygon as a fallback
      const area1 = Math.abs(polygonArea(poly1));
      const area2 = Math.abs(polygonArea(poly2));
      return area1 > area2 ? poly1 : poly2;
    }
    
    // Build a graph of boundary segments
    const segments = [];
    
    // Add segments from poly1
    for (let i = 0; i < poly1.length; i++) {
      const start = poly1[i];
      const end = poly1[(i + 1) % poly1.length];
      const edgeInters = [];
      
      // Find intersections on this edge
      for (const inter of intersections) {
        if (inter.edge1 === i) {
          edgeInters.push(inter.point);
        }
      }
      
      // Sort intersections along the edge
      edgeInters.sort((a, b) => {
        const distA = (a[0] - start[0]) * (a[0] - start[0]) + (a[1] - start[1]) * (a[1] - start[1]);
        const distB = (b[0] - start[0]) * (b[0] - start[0]) + (b[1] - start[1]) * (b[1] - start[1]);
        return distA - distB;
      });
      
      // Create segments between intersections
      let currentStart = start;
      for (const inter of edgeInters) {
        if (isSegmentOutside(currentStart, inter, poly2)) {
          segments.push({
            start: currentStart,
            end: inter,
            poly: 1
          });
        }
        currentStart = inter;
      }
      if (isSegmentOutside(currentStart, end, poly2)) {
        segments.push({
          start: currentStart,
          end: end,
          poly: 1
        });
      }
    }
    
    // Add segments from poly2
    for (let i = 0; i < poly2.length; i++) {
      const start = poly2[i];
      const end = poly2[(i + 1) % poly2.length];
      const edgeInters = [];
      
      // Find intersections on this edge
      for (const inter of intersections) {
        if (inter.edge2 === i) {
          edgeInters.push(inter.point);
        }
      }
      
      // Sort intersections along the edge
      edgeInters.sort((a, b) => {
        const distA = (a[0] - start[0]) * (a[0] - start[0]) + (a[1] - start[1]) * (a[1] - start[1]);
        const distB = (b[0] - start[0]) * (b[0] - start[0]) + (b[1] - start[1]) * (b[1] - start[1]);
        return distA - distB;
      });
      
      // Create segments between intersections
      let currentStart = start;
      for (const inter of edgeInters) {
        if (isSegmentOutside(currentStart, inter, poly1)) {
          segments.push({
            start: currentStart,
            end: inter,
            poly: 2
          });
        }
        currentStart = inter;
      }
      if (isSegmentOutside(currentStart, end, poly1)) {
        segments.push({
          start: currentStart,
          end: end,
          poly: 2
        });
      }
    }
    
    // Connect segments to form the union boundary
    if (segments.length === 0) {
      // Fallback
      return poly1;
    }
    
    const result = [];
    const used = new Array(segments.length).fill(false);
    const epsilon = 1e-9;
    
    // Start with the first segment
    let currentSegment = segments[0];
    used[0] = true;
    result.push(currentSegment.start);
    result.push(currentSegment.end);
    
    // Connect segments
    while (true) {
      let found = false;
      const currentEnd = result[result.length - 1];
      
      for (let i = 0; i < segments.length; i++) {
        if (used[i]) continue;
        
        // Check if this segment connects to our current end
        if (pointsEqual(segments[i].start, currentEnd, epsilon)) {
          result.push(segments[i].end);
          used[i] = true;
          found = true;
          break;
        }
      }
      
      if (!found) {
        // Check if we've completed the loop
        if (result.length > 3 && pointsEqual(result[0], currentEnd, epsilon)) {
          result.pop(); // Remove duplicate endpoint
          break;
        }
        
        // Find nearest unused segment
        let nearestIdx = -1;
        let nearestDist = Infinity;
        for (let i = 0; i < segments.length; i++) {
          if (used[i]) continue;
          const dist = Math.sqrt(
            Math.pow(segments[i].start[0] - currentEnd[0], 2) +
            Math.pow(segments[i].start[1] - currentEnd[1], 2)
          );
          if (dist < nearestDist) {
            nearestDist = dist;
            nearestIdx = i;
          }
        }
        
        if (nearestIdx >= 0 && nearestDist < 1) {
          // Close enough, connect it
          result.push(segments[nearestIdx].start);
          result.push(segments[nearestIdx].end);
          used[nearestIdx] = true;
        } else {
          break; // Can't continue
        }
      }
    }
    
    return result;
  }
  
  // Calculate polygon area using shoelace formula
  function polygonArea(polygon) {
    let area = 0;
    for (let i = 0; i < polygon.length; i++) {
      const j = (i + 1) % polygon.length;
      area += polygon[i][0] * polygon[j][1];
      area -= polygon[j][0] * polygon[i][1];
    }
    return area / 2;
  }

  // Polygon intersection for convex polygons
  function convexPolygonIntersection(poly1, poly2) {
    let outputList = [...poly1];
    
    for (let i = 0; i < poly2.length; i++) {
      const inputList = outputList;
      outputList = [];
      
      if (inputList.length === 0) break;
      
      const A = poly2[i];
      const B = poly2[(i + 1) % poly2.length];
      
      for (let j = 0; j < inputList.length; j++) {
        const C = inputList[j];
        const D = inputList[(j + 1) % inputList.length];
        
        const crossAC = cross(A, B, C);
        const crossAD = cross(A, B, D);
        
        if (crossAC >= 0) {
          outputList.push(C);
        }
        
        if ((crossAC >= 0 && crossAD < 0) || (crossAC < 0 && crossAD >= 0)) {
          const intersection = lineIntersection(A, B, C, D);
          if (intersection) {
            outputList.push(intersection);
          }
        }
      }
    }
    
    return outputList;
  }

  // Get bounds from points
  function getPointsBounds(points) {
    if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
    
    let minX = points[0][0];
    let minY = points[0][1];
    let maxX = points[0][0];
    let maxY = points[0][1];
    
    for (let i = 1; i < points.length; i++) {
      minX = Math.min(minX, points[i][0]);
      minY = Math.min(minY, points[i][1]);
      maxX = Math.max(maxX, points[i][0]);
      maxY = Math.max(maxY, points[i][1]);
    }
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  // Generate ID
  function generateId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let id = '';
    for (let i = 0; i < 12; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  }

  // Main entry point
  function performExcalidrawBooleanOp(elements, operation) {
    console.log('[BooleanOps] Starting operation:', operation, 'on', elements.length, 'elements');
    
    if (elements.length !== 2) {
      throw new Error('Boolean operations require exactly 2 elements');
    }
    
    try {
      // Get points from elements
      const points1 = elementToPoints(elements[0]);
      const points2 = elementToPoints(elements[1]);
      
      console.log('[BooleanOps] Points from element 1:', points1.length);
      console.log('[BooleanOps] Points from element 2:', points2.length);
      
      // Compute convex hulls
      const hull1 = convexHull(points1);
      const hull2 = convexHull(points2);
      
      console.log('[BooleanOps] Hull 1 points:', hull1.length);
      console.log('[BooleanOps] Hull 2 points:', hull2.length);
      
      let resultPoints = [];
      
      switch (operation) {
        case 'union':
          // Use proper polygon union algorithm
          resultPoints = polygonUnion(points1, points2);
          break;
          
        case 'intersection':
          // Intersection of two convex polygons
          resultPoints = convexPolygonIntersection(hull1, hull2);
          break;
          
        case 'difference':
          // For difference, we need points from hull1 that are not in hull2
          // This is approximate for convex hulls
          resultPoints = hull1.filter(p => !pointInConvexPolygon(p, hull2));
          
          // Find intersection edges and add them
          for (let i = 0; i < hull1.length; i++) {
            const a = hull1[i];
            const b = hull1[(i + 1) % hull1.length];
            
            for (let j = 0; j < hull2.length; j++) {
              const c = hull2[j];
              const d = hull2[(j + 1) % hull2.length];
              
              const intersection = lineIntersection(a, b, c, d);
              if (intersection) {
                resultPoints.push(intersection);
              }
            }
          }
          
          resultPoints = convexHull(resultPoints);
          break;
          
        case 'exclusion':
          // Exclusion is union minus intersection
          const unionHull = convexHull([...points1, ...points2]);
          const intersection = convexPolygonIntersection(hull1, hull2);
          
          if (intersection.length === 0) {
            resultPoints = unionHull;
          } else {
            // This is approximate - we just use the union hull
            // True exclusion with convex hulls is complex
            resultPoints = unionHull;
          }
          break;
          
        default:
          throw new Error(`Unsupported operation: ${operation}`);
      }
      
      console.log('[BooleanOps] Result points:', resultPoints.length);
      
      if (resultPoints.length < 3) {
        throw new Error('Operation resulted in degenerate shape');
      }
      
      // Get bounds and convert to relative points
      const bounds = getPointsBounds(resultPoints);
      const relativePoints = resultPoints.map(p => [
        p[0] - bounds.x,
        p[1] - bounds.y
      ]);
      
      // Close the shape
      if (relativePoints.length > 0) {
        const first = relativePoints[0];
        const last = relativePoints[relativePoints.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
          relativePoints.push([first[0], first[1]]);
        }
      }
      
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
        points: relativePoints,
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
      console.error('[BooleanOps] Error:', error);
      throw error;
    }
  }

  // Expose to window
  window.performExcalidrawBooleanOp = performExcalidrawBooleanOp;
  console.log('[BooleanOps] Function defined:', typeof window.performExcalidrawBooleanOp);
})();