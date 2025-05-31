# Excalidraw Boolean Operations Extension

A Chrome extension that adds boolean shape operations (Union, Intersection, Difference, Exclusion) to Excalidraw.

## Features

- **Union** (Alt + +): Combine shapes into one
- **Intersection** (Alt + *): Keep only overlapping areas
- **Difference** (Alt + -): Subtract one shape from another
- **Exclusion** (Alt + ^): Keep everything except overlapping areas

## Usage

1. Select 2 or more shapes in Excalidraw
2. A validation message appears at the top showing which shapes are selected
3. The boolean operations toolbar appears at the bottom when valid shapes are selected
4. Click an operation or use keyboard shortcuts
5. The selected shapes will be combined into a new shape

## Supported Shapes

- Rectangles
- Ellipses
- Diamonds
- Closed lines (polygons)

## Installation

1. Clone this repository
2. Open Chrome Extensions (chrome://extensions/)
3. Enable Developer mode
4. Click "Load unpacked"
5. Select the extension directory

## Development

The extension uses:
- React Context API monitoring to detect selection changes
- SVG path operations for boolean calculations
- Chrome Extension Manifest V3

## Status

- ✅ Selection detection
- ✅ Shape validation with visual feedback
- ✅ UI implementation with disabled state for invalid selections
- ⚠️ Boolean operations (placeholder implementation)

## Next Steps

To complete the boolean operations:
1. Integrate a geometry library (paper.js, martinez-polygon-clipping, or similar)
2. Implement path conversion for all shape types
3. Add the actual boolean operation calculations
4. Convert results back to Excalidraw elements
5. Update the scene through Excalidraw's API