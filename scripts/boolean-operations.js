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

  // Ensure counter-clockwise winding order
  function ensureCCW(polygon) {
    const area = polygonArea(polygon);
    if (area < 0) {
      return [...polygon].reverse();
    }
    return polygon;
  }

  // Sort points by angle from centroid
  function sortPointsByAngle(points) {
    if (points.length === 0) return [];
    
    // Calculate centroid
    const cx = points.reduce((sum, p) => sum + p[0], 0) / points.length;
    const cy = points.reduce((sum, p) => sum + p[1], 0) / points.length;
    
    // Sort by angle
    return points.sort((a, b) => {
      const angleA = Math.atan2(a[1] - cy, a[0] - cx);
      const angleB = Math.atan2(b[1] - cy, b[0] - cx);
      return angleA - angleB;
    });
  }

  // Find closest points between two polygons
  function findClosestPoints(poly1, poly2) {
    let minDist = Infinity;
    let closestPair = null;
    
    for (let i = 0; i < poly1.length; i++) {
      for (let j = 0; j < poly2.length; j++) {
        const dist = Math.sqrt(
          (poly1[i][0] - poly2[j][0]) ** 2 + 
          (poly1[i][1] - poly2[j][1]) ** 2
        );
        if (dist < minDist) {
          minDist = dist;
          closestPair = { p1: i, p2: j, dist: minDist };
        }
      }
    }
    
    return closestPair;
  }

  // Polygon difference (poly1 - poly2)
  function polygonDifference(poly1, poly2) {
    const intersections = findPolygonIntersections(poly1, poly2);
    
    console.log('[BooleanOps] Difference - found', intersections.length, 'intersections');
    
    // Check if poly2 is completely inside poly1
    const poly2Inside = poly2.every(p => pointInPolygon(p, poly1));
    const poly1Inside = poly1.every(p => pointInPolygon(p, poly2));
    
    if (poly1Inside) {
      // poly1 is inside poly2, difference is empty
      return [];
    }
    
    if (poly2Inside && intersections.length === 0) {
      // poly2 is completely inside poly1 - create a hole
      console.log('[BooleanOps] Creating hole - poly2 is inside poly1');
      
      // Find the closest points between the two polygons
      const closest = findClosestPoints(poly1, poly2);
      if (!closest) return poly1;
      
      const resultPoints = [];
      
      // Trace poly1 up to the cut point
      for (let i = 0; i <= closest.p1; i++) {
        resultPoints.push([...poly1[i]]);
      }
      
      // Move directly to the closest point on poly2 (zero-width cut)
      const bridge1 = [...poly2[closest.p2]];
      resultPoints.push(bridge1);
      
      // Trace poly2 in reverse order (to create the hole)
      for (let i = 1; i <= poly2.length; i++) {
        const idx = (closest.p2 - i + poly2.length) % poly2.length;
        resultPoints.push([...poly2[idx]]);
      }
      
      // Return to the cut point on poly1 (completing the zero-width bridge)
      const bridge2 = [...poly1[closest.p1]];
      resultPoints.push(bridge2);
      
      // Continue tracing poly1 from where we left off
      for (let i = closest.p1 + 1; i < poly1.length; i++) {
        resultPoints.push([...poly1[i]]);
      }
      
      console.log('[BooleanOps] Created hole with', resultPoints.length, 'points');
      return resultPoints;
    }
    
    // Standard difference with intersections
    const resultSegments = [];
    
    // Process each edge of poly1
    for (let i = 0; i < poly1.length; i++) {
      const start = poly1[i];
      const end = poly1[(i + 1) % poly1.length];
      
      // Find all intersections on this edge
      const edgeIntersections = intersections
        .filter(inter => inter.edge1 === i)
        .map(inter => inter.point)
        .sort((a, b) => {
          // Sort by distance from start
          const distA = (a[0] - start[0]) ** 2 + (a[1] - start[1]) ** 2;
          const distB = (b[0] - start[0]) ** 2 + (b[1] - start[1]) ** 2;
          return distA - distB;
        });
      
      // Add start point and intersections
      const edgePoints = [start, ...edgeIntersections, end];
      
      // Check each segment
      for (let j = 0; j < edgePoints.length - 1; j++) {
        const segStart = edgePoints[j];
        const segEnd = edgePoints[j + 1];
        const midpoint = [
          (segStart[0] + segEnd[0]) / 2,
          (segStart[1] + segEnd[1]) / 2
        ];
        
        // Keep segment if midpoint is outside poly2
        if (!pointInPolygon(midpoint, poly2)) {
          resultSegments.push({ start: segStart, end: segEnd });
        }
      }
    }
    
    // Process edges from poly2 that are inside poly1
    for (let i = 0; i < poly2.length; i++) {
      const start = poly2[i];
      const end = poly2[(i + 1) % poly2.length];
      
      // Find all intersections on this edge
      const edgeIntersections = intersections
        .filter(inter => inter.edge2 === i)
        .map(inter => inter.point)
        .sort((a, b) => {
          // Sort by distance from start
          const distA = (a[0] - start[0]) ** 2 + (a[1] - start[1]) ** 2;
          const distB = (b[0] - start[0]) ** 2 + (b[1] - start[1]) ** 2;
          return distA - distB;
        });
      
      // Add start point and intersections
      const edgePoints = [start, ...edgeIntersections, end];
      
      // Check each segment (in reverse for difference)
      for (let j = edgePoints.length - 2; j >= 0; j--) {
        const segStart = edgePoints[j + 1];
        const segEnd = edgePoints[j];
        const midpoint = [
          (segStart[0] + segEnd[0]) / 2,
          (segStart[1] + segEnd[1]) / 2
        ];
        
        // Keep segment if midpoint is inside poly1
        if (pointInPolygon(midpoint, poly1)) {
          resultSegments.push({ start: segStart, end: segEnd });
        }
      }
    }
    
    console.log('[BooleanOps] Difference - result segments:', resultSegments.length);
    
    // Connect segments into a polygon
    if (resultSegments.length === 0) {
      // No intersections and poly2 not inside poly1 - return poly1
      return poly1;
    }
    
    const resultPoints = [];
    const used = new Array(resultSegments.length).fill(false);
    
    // Start with first segment
    let currentSegment = resultSegments[0];
    used[0] = true;
    resultPoints.push(currentSegment.start);
    resultPoints.push(currentSegment.end);
    
    // Connect segments
    while (true) {
      const currentEnd = resultPoints[resultPoints.length - 1];
      let found = false;
      
      for (let i = 0; i < resultSegments.length; i++) {
        if (used[i]) continue;
        
        if (pointsEqual(resultSegments[i].start, currentEnd)) {
          resultPoints.push(resultSegments[i].end);
          used[i] = true;
          found = true;
          break;
        }
      }
      
      if (!found) {
        // Check if we've closed the polygon
        if (resultPoints.length > 2 && pointsEqual(resultPoints[0], currentEnd)) {
          resultPoints.pop(); // Remove duplicate
          break;
        }
        
        // Find nearest unused segment
        let nearestIdx = -1;
        let nearestDist = Infinity;
        
        for (let i = 0; i < resultSegments.length; i++) {
          if (used[i]) continue;
          
          const dist = Math.sqrt(
            (resultSegments[i].start[0] - currentEnd[0]) ** 2 +
            (resultSegments[i].start[1] - currentEnd[1]) ** 2
          );
          
          if (dist < nearestDist) {
            nearestDist = dist;
            nearestIdx = i;
          }
        }
        
        if (nearestIdx >= 0 && nearestDist < 1) {
          resultPoints.push(resultSegments[nearestIdx].start);
          resultPoints.push(resultSegments[nearestIdx].end);
          used[nearestIdx] = true;
        } else {
          break;
        }
      }
    }
    
    console.log('[BooleanOps] Difference - final points:', resultPoints.length);
    return resultPoints;
  }

  // Polygon exclusion returning multiple polygons
  function polygonExclusionMultiple(poly1, poly2) {
    const intersections = findPolygonIntersections(poly1, poly2);
    
    console.log('[BooleanOps] Exclusion Multiple - found', intersections.length, 'intersections');
    
    // Check for complete containment
    const poly1Inside = poly1.every(p => pointInPolygon(p, poly2));
    const poly2Inside = poly2.every(p => pointInPolygon(p, poly1));
    
    if (poly1Inside) {
      // poly1 is inside poly2, return poly2 with a hole (as single polygon)
      return [polygonDifference(poly2, poly1)];
    }
    
    if (poly2Inside) {
      // poly2 is inside poly1, return poly1 with a hole (as single polygon)
      return [polygonDifference(poly1, poly2)];
    }
    
    if (intersections.length === 0) {
      // No intersection - return both polygons
      return [poly1, poly2];
    }
    
    // Compute both difference regions separately
    const simpleDifference = (p1, p2) => {
      const resultSegments = [];
      const inters = findPolygonIntersections(p1, p2);
      
      // Process each edge of p1
      for (let i = 0; i < p1.length; i++) {
        const start = p1[i];
        const end = p1[(i + 1) % p1.length];
        
        const edgeIntersections = inters
          .filter(inter => inter.edge1 === i)
          .map(inter => inter.point)
          .sort((a, b) => {
            const distA = (a[0] - start[0]) ** 2 + (a[1] - start[1]) ** 2;
            const distB = (b[0] - start[0]) ** 2 + (b[1] - start[1]) ** 2;
            return distA - distB;
          });
        
        const edgePoints = [start, ...edgeIntersections, end];
        
        for (let j = 0; j < edgePoints.length - 1; j++) {
          const segStart = edgePoints[j];
          const segEnd = edgePoints[j + 1];
          const midpoint = [
            (segStart[0] + segEnd[0]) / 2,
            (segStart[1] + segEnd[1]) / 2
          ];
          
          if (!pointInPolygon(midpoint, p2)) {
            resultSegments.push({ start: segStart, end: segEnd });
          }
        }
      }
      
      // Process edges from p2 that are inside p1
      for (let i = 0; i < p2.length; i++) {
        const start = p2[i];
        const end = p2[(i + 1) % p2.length];
        
        const edgeIntersections = inters
          .filter(inter => inter.edge2 === i)
          .map(inter => inter.point)
          .sort((a, b) => {
            const distA = (a[0] - start[0]) ** 2 + (a[1] - start[1]) ** 2;
            const distB = (b[0] - start[0]) ** 2 + (b[1] - start[1]) ** 2;
            return distA - distB;
          });
        
        const edgePoints = [start, ...edgeIntersections, end];
        
        for (let j = edgePoints.length - 2; j >= 0; j--) {
          const segStart = edgePoints[j + 1];
          const segEnd = edgePoints[j];
          const midpoint = [
            (segStart[0] + segEnd[0]) / 2,
            (segStart[1] + segEnd[1]) / 2
          ];
          
          if (pointInPolygon(midpoint, p1)) {
            resultSegments.push({ start: segStart, end: segEnd });
          }
        }
      }
      
      if (resultSegments.length === 0) return [];
      
      // Connect segments into a polygon
      const result = [];
      const used = new Array(resultSegments.length).fill(false);
      
      let currentSegment = resultSegments[0];
      used[0] = true;
      result.push(currentSegment.start);
      result.push(currentSegment.end);
      
      while (true) {
        const currentEnd = result[result.length - 1];
        let found = false;
        
        for (let i = 0; i < resultSegments.length; i++) {
          if (used[i]) continue;
          
          if (pointsEqual(resultSegments[i].start, currentEnd)) {
            result.push(resultSegments[i].end);
            used[i] = true;
            found = true;
            break;
          }
        }
        
        if (!found) {
          if (result.length > 2 && pointsEqual(result[0], currentEnd)) {
            result.pop();
            break;
          }
          
          let nearestIdx = -1;
          let nearestDist = Infinity;
          
          for (let i = 0; i < resultSegments.length; i++) {
            if (used[i]) continue;
            
            const dist = Math.sqrt(
              (resultSegments[i].start[0] - currentEnd[0]) ** 2 +
              (resultSegments[i].start[1] - currentEnd[1]) ** 2
            );
            
            if (dist < nearestDist) {
              nearestDist = dist;
              nearestIdx = i;
            }
          }
          
          if (nearestIdx >= 0 && nearestDist < 1) {
            result.push(resultSegments[nearestIdx].start);
            result.push(resultSegments[nearestIdx].end);
            used[nearestIdx] = true;
          } else {
            break;
          }
        }
      }
      
      return result;
    };
    
    // Compute the two difference regions
    const region1 = simpleDifference(poly1, poly2);
    const region2 = simpleDifference(poly2, poly1);
    
    const results = [];
    if (region1.length >= 3) results.push(region1);
    if (region2.length >= 3) results.push(region2);
    
    console.log('[BooleanOps] Exclusion Multiple - returning', results.length, 'polygons');
    return results;
  }

  // Original polygon exclusion (XOR - symmetric difference) - kept for compatibility
  function polygonExclusion(poly1, poly2) {
    const intersections = findPolygonIntersections(poly1, poly2);
    
    console.log('[BooleanOps] Exclusion - found', intersections.length, 'intersections');
    
    // Check for complete containment
    const poly1Inside = poly1.every(p => pointInPolygon(p, poly2));
    const poly2Inside = poly2.every(p => pointInPolygon(p, poly1));
    
    if (poly1Inside || poly2Inside) {
      // One shape is completely inside the other
      // Exclusion would create a hole, use difference approach
      if (poly1Inside) {
        return polygonDifference(poly2, poly1);
      } else {
        return polygonDifference(poly1, poly2);
      }
    }
    
    if (intersections.length === 0) {
      // No intersection - return union
      return polygonUnion(poly1, poly2);
    }
    
    // For overlapping shapes, compute both differences
    // Save the original difference function without hole creation
    const simpleDifference = (p1, p2) => {
      const resultSegments = [];
      const inters = findPolygonIntersections(p1, p2);
      
      // Process each edge of p1
      for (let i = 0; i < p1.length; i++) {
        const start = p1[i];
        const end = p1[(i + 1) % p1.length];
        
        const edgeIntersections = inters
          .filter(inter => inter.edge1 === i)
          .map(inter => inter.point)
          .sort((a, b) => {
            const distA = (a[0] - start[0]) ** 2 + (a[1] - start[1]) ** 2;
            const distB = (b[0] - start[0]) ** 2 + (b[1] - start[1]) ** 2;
            return distA - distB;
          });
        
        const edgePoints = [start, ...edgeIntersections, end];
        
        for (let j = 0; j < edgePoints.length - 1; j++) {
          const segStart = edgePoints[j];
          const segEnd = edgePoints[j + 1];
          const midpoint = [
            (segStart[0] + segEnd[0]) / 2,
            (segStart[1] + segEnd[1]) / 2
          ];
          
          if (!pointInPolygon(midpoint, p2)) {
            resultSegments.push({ start: segStart, end: segEnd });
          }
        }
      }
      
      // Process edges from p2 that are inside p1
      for (let i = 0; i < p2.length; i++) {
        const start = p2[i];
        const end = p2[(i + 1) % p2.length];
        
        const edgeIntersections = inters
          .filter(inter => inter.edge2 === i)
          .map(inter => inter.point)
          .sort((a, b) => {
            const distA = (a[0] - start[0]) ** 2 + (a[1] - start[1]) ** 2;
            const distB = (b[0] - start[0]) ** 2 + (b[1] - start[1]) ** 2;
            return distA - distB;
          });
        
        const edgePoints = [start, ...edgeIntersections, end];
        
        for (let j = edgePoints.length - 2; j >= 0; j--) {
          const segStart = edgePoints[j + 1];
          const segEnd = edgePoints[j];
          const midpoint = [
            (segStart[0] + segEnd[0]) / 2,
            (segStart[1] + segEnd[1]) / 2
          ];
          
          if (pointInPolygon(midpoint, p1)) {
            resultSegments.push({ start: segStart, end: segEnd });
          }
        }
      }
      
      if (resultSegments.length === 0) return [];
      
      // Connect segments into a polygon
      const result = [];
      const used = new Array(resultSegments.length).fill(false);
      
      let currentSegment = resultSegments[0];
      used[0] = true;
      result.push(currentSegment.start);
      result.push(currentSegment.end);
      
      while (true) {
        const currentEnd = result[result.length - 1];
        let found = false;
        
        for (let i = 0; i < resultSegments.length; i++) {
          if (used[i]) continue;
          
          if (pointsEqual(resultSegments[i].start, currentEnd)) {
            result.push(resultSegments[i].end);
            used[i] = true;
            found = true;
            break;
          }
        }
        
        if (!found) {
          if (result.length > 2 && pointsEqual(result[0], currentEnd)) {
            result.pop();
            break;
          }
          
          let nearestIdx = -1;
          let nearestDist = Infinity;
          
          for (let i = 0; i < resultSegments.length; i++) {
            if (used[i]) continue;
            
            const dist = Math.sqrt(
              (resultSegments[i].start[0] - currentEnd[0]) ** 2 +
              (resultSegments[i].start[1] - currentEnd[1]) ** 2
            );
            
            if (dist < nearestDist) {
              nearestDist = dist;
              nearestIdx = i;
            }
          }
          
          if (nearestIdx >= 0 && nearestDist < 1) {
            result.push(resultSegments[nearestIdx].start);
            result.push(resultSegments[nearestIdx].end);
            used[nearestIdx] = true;
          } else {
            break;
          }
        }
      }
      
      return result;
    };
    
    // Compute the two difference regions
    const region1 = simpleDifference(poly1, poly2);
    const region2 = simpleDifference(poly2, poly1);
    
    if (region1.length < 3 || region2.length < 3) {
      // One region is empty, return the other
      return region1.length >= 3 ? region1 : region2;
    }
    
    // Find closest points between the two regions
    let minDist = Infinity;
    let bridge1Idx = 0;
    let bridge2Idx = 0;
    
    for (let i = 0; i < region1.length; i++) {
      for (let j = 0; j < region2.length; j++) {
        const dist = Math.sqrt(
          (region1[i][0] - region2[j][0]) ** 2 +
          (region1[i][1] - region2[j][1]) ** 2
        );
        if (dist < minDist) {
          minDist = dist;
          bridge1Idx = i;
          bridge2Idx = j;
        }
      }
    }
    
    // Build the final polygon connecting both regions
    const resultPoints = [];
    
    // Add points from region 1 up to the bridge point
    for (let i = 0; i <= bridge1Idx; i++) {
      resultPoints.push([...region1[i]]);
    }
    
    // Bridge to region 2
    resultPoints.push([...region2[bridge2Idx]]);
    
    // Add all points from region 2
    for (let i = 1; i < region2.length; i++) {
      const idx = (bridge2Idx + i) % region2.length;
      resultPoints.push([...region2[idx]]);
    }
    
    // Bridge back to region 1
    resultPoints.push([...region1[bridge1Idx]]);
    
    // Add remaining points from region 1
    for (let i = bridge1Idx + 1; i < region1.length; i++) {
      resultPoints.push([...region1[i]]);
    }
    
    console.log('[BooleanOps] Exclusion - connected two regions with bridge');
    return resultPoints;
  }

  // Simple polygon intersection
  function polygonIntersection(poly1, poly2) {
    const resultPoints = [];
    
    
    // Add vertices from poly1 that are inside poly2
    for (const vertex of poly1) {
      if (pointInPolygon(vertex, poly2)) {
        resultPoints.push([...vertex]);
      }
    }
    
    // Add vertices from poly2 that are inside poly1
    for (const vertex of poly2) {
      if (pointInPolygon(vertex, poly1)) {
        // Check if this point is already added (avoid duplicates)
        const exists = resultPoints.some(p => 
          Math.abs(p[0] - vertex[0]) < 1e-10 && 
          Math.abs(p[1] - vertex[1]) < 1e-10
        );
        if (!exists) {
          resultPoints.push([...vertex]);
        }
      }
    }
    
    // Add all intersection points
    const intersections = findPolygonIntersections(poly1, poly2);
    for (const inter of intersections) {
      // Check if this point is already added (avoid duplicates)
      const exists = resultPoints.some(p => 
        Math.abs(p[0] - inter.point[0]) < 1e-10 && 
        Math.abs(p[1] - inter.point[1]) < 1e-10
      );
      if (!exists) {
        resultPoints.push([...inter.point]);
      }
    }
    
    if (resultPoints.length < 3) {
      return [];
    }
    
    // Sort points to form a proper polygon
    const sorted = sortPointsByAngle(resultPoints);
    return sorted;
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

  // Helper to create element from points
  function createElementFromPoints(points, sourceElement) {
    const bounds = getPointsBounds(points);
    const relativePoints = points.map(p => [
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
    
    return {
      id: generateId(),
      type: 'line',
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      angle: 0,
      strokeColor: sourceElement.strokeColor || '#000000',
      backgroundColor: sourceElement.backgroundColor || 'transparent',
      fillStyle: sourceElement.fillStyle || 'solid',
      strokeWidth: sourceElement.strokeWidth || 1,
      strokeStyle: sourceElement.strokeStyle || 'solid',
      roughness: sourceElement.roughness || 1,
      opacity: sourceElement.opacity || 100,
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
  }

  // Main entry point - now returns array of elements
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
      
      const firstElement = elements[0];
      const resultElements = [];
      
      switch (operation) {
        case 'union':
          const unionPoints = polygonUnion(points1, points2);
          if (unionPoints.length >= 3) {
            resultElements.push(createElementFromPoints(unionPoints, firstElement));
          }
          break;
          
        case 'intersection':
          const intersectionPoints = polygonIntersection(points1, points2);
          if (intersectionPoints.length >= 3) {
            resultElements.push(createElementFromPoints(intersectionPoints, firstElement));
          }
          break;
          
        case 'difference':
          const differencePoints = polygonDifference(points1, points2);
          if (differencePoints.length >= 3) {
            resultElements.push(createElementFromPoints(differencePoints, firstElement));
          }
          break;
          
        case 'exclusion':
          // For exclusion, we need to return multiple polygons
          const exclusionResults = polygonExclusionMultiple(points1, points2);
          for (const points of exclusionResults) {
            if (points.length >= 3) {
              resultElements.push(createElementFromPoints(points, firstElement));
            }
          }
          break;
          
        default:
          throw new Error(`Unsupported operation: ${operation}`);
      }
      
      console.log('[BooleanOps] Created', resultElements.length, 'result elements');
      
      if (resultElements.length === 0) {
        throw new Error('Operation resulted in empty result');
      }
      
      // Always return an array, even for single elements
      return resultElements;
      
    } catch (error) {
      console.error('[BooleanOps] Error:', error);
      throw error;
    }
  }

  // Expose to window
  window.performExcalidrawBooleanOp = performExcalidrawBooleanOp;
  console.log('[BooleanOps] Function defined:', typeof window.performExcalidrawBooleanOp);
})();