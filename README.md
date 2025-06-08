# Excalibur - Excalidraw Enhancement Extension

A Chrome extension that enhances Excalidraw with powerful shape manipulation tools.

## Features

### Boolean Operations
Combine and manipulate shapes with keyboard shortcuts:
- **Union** (Alt + +): Merge selected shapes into one
- **Intersection** (Alt + *): Keep only overlapping areas
- **Difference** (Alt + -): Subtract one shape from another
- **Exclusion** (Alt + ^): Keep everything except overlapping areas

### Shape Scaling
Precise control over shape dimensions:
- **Scale Up** (Alt + ↑): Increase size by 10%
- **Scale Down** (Alt + ↓): Decrease size by 10%
- **Double Size** (Alt + D): Scale to 200%
- **Halve Size** (Alt + H): Scale to 50%

## Usage

1. Select one or more shapes in Excalidraw
2. Use keyboard shortcuts or click the toolbar buttons
3. For boolean operations: Select 2 shapes, then apply the operation
4. For scaling: Select any number of shapes and apply the transformation (works best with 1 element at a time)

## Installation

1. Clone this repository
2. Open Chrome Extensions (chrome://extensions/)
3. Enable Developer mode
4. Click "Load unpacked"
5. Select the extension directory

## Architecture

The extension leverages Excalidraw's internal React state, via reverse engineering / introspection of the app's state:
- Monitors selection changes via React Context API
- Directly manipulates element properties in Excalidraw's store
- Provides visual feedback through custom UI overlays
- Implements operations using SVG path calculations
