# Test UI Inspection Tools

Test the MCP UI inspection and interaction tools against a running demo app.

## Prerequisites
- MCP server running (`yarn dev:server`)
- A demo app running and connected

## Test Scenarios

### 1. Get Component Tree
Use `get_component_tree` to inspect the UI hierarchy:
- Get full component tree
- Verify React/SwiftUI/Compose components are listed
- Check that props and state are included
- Test with depth limit

### 2. Get Layout Tree
Use `get_layout_tree` to get view bounds:
- Verify all visible views are included
- Check that bounds (x, y, width, height) are accurate
- Test `includeHidden: true` option

### 3. Capture Screenshot
Use `capture_screenshot`:
- Verify base64 image is returned
- Decode and verify image matches current screen
- Test with label for tracking

### 4. Inspect Element at Coordinates
Use `inspect_element` with x, y coordinates:
- Tap a location in the app to get coordinates
- Use those coordinates with inspect_element
- Verify returned component matches what's at that location

### 5. Simulate Interactions
Use `simulate_interaction` for each type:

**Tap:**
```json
{ "type": "tap", "target": { "testId": "add-to-cart-button" } }
```

**Long Press:**
```json
{ "type": "longPress", "target": { "x": 200, "y": 400 } }
```

**Swipe:**
```json
{ "type": "swipe", "target": { "x": 200, "y": 400 }, "direction": "up" }
```

**Text Input:**
```json
{ "type": "input", "target": { "testId": "search-input" }, "value": "test" }
```

### 6. Navigate to Route
Use `navigate_to`:
- Navigate to a specific screen by route name
- Verify app navigates correctly
- Test with route parameters

## Expected Results
- Component tree should reflect actual UI
- Screenshots should be current
- Interactions should trigger real UI updates
