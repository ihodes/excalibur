# Spec for the "scale reference" feature.

**Goal**: My goal is to be able to draw things to scale, for example select a
shape and say "it should be 50mm lengthwise" I want to be able to define that
scale, too, by drawing a line and saying "this line is 100mm, use it as the
legend / source of truth for everything else".

## Specifics:


Interface:
- show nothing by default!
- i can right click a line element (2 point lines only) to "Use as scale reference…" and then let me choose inches or feet or mm or meters. It uses the true length of the line between the two points, not the vertical or horizontal length on the canvas.
- if i've set a scale, now show a new toolbar that shows the scale, and lets me click it to return to that scale element (and then I can right click it to change the scale)
- once that scale reference has been set, if i click an element or more, the toolbar expands to let me set the vertical, horizontal, or longest axis size of the element (defaulting to units of the scale reference, but allowing me to change to other units if needed and doing the appropriate conversations)
    - show current dimensions (for all of vert, hori, longest axis) when clicking an element / elements in the toolbar
- if i delete the scale reference element, notify me (such that I can undo it if i want) in a toast
- Keyboard shortcut:
    - alt-d → "Set dimension" and focus the text field to enter a dimension, with the default unit already selected

Other considerations
- Store the value in LocalStorage attached to the specific drawing I'm on
- Ensure that when I zoom in and out, the scale is preserved (i.e. items get bigger or smaller, but relative size remains controlled against the scale reference
- only allow a single scale reference element to be set per drawing
- precision to 0.01mm (unless this breaks things / causes issues: please notify me if so).


More info:
  Core Behavior

  - Scale Reference: Right-click 2-point line → "Use as scale reference..." → Choose unit
  (inches/feet/mm/meters)
  - Scaling: Maintains top-left position (good for technical drawings and alignment)
  - Multi-select: Scales as a group, maintaining relative positions
  - Groups: Treated as single entities with bounding box dimensions
  - Precision: 0.1mm (more practical than 0.01mm)

  UI Flow

  1. No scale set: Interface is clean, no extra UI
  2. Scale set: Toolbar shows current scale, clicking it pans/zooms to the reference line
  3. Element selected: Toolbar expands to show:
    - Current dimensions (vert/horiz/longest axis)
    - Input field to set dimension (defaults to vertical)
    - Unit selector (defaults to scale reference unit, remembers changes)

  Keyboard Shortcut

  - Alt+D: Focus dimension input (only when elements selected)
  - Default to vertical dimension
  - Can tab to change dimension type before pressing Enter

  Data Management

  - Store scale reference ID + unit in localStorage keyed by URL slug
  - Only one scale reference per drawing
  - Copying scale reference doesn't create new reference
  - Deleting reference shows toast with Undo button

  Technical Details

  - Line length: √[(x2-x1)² + (y2-y1)²]
  - Longest axis for groups: Diagonal of entire selection bounding box
  - Scale preserved through zoom (relative sizes maintained)
