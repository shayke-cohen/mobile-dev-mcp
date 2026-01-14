# Test State Inspection Tools

Test the MCP state inspection tools against a running demo app.

## Prerequisites
- MCP server running (`yarn dev:server`)
- A demo app running and connected

## Test Scenarios

### 1. Get Full App State
Use `get_app_state` to retrieve the entire application state:
- Verify Redux/Zustand/ViewModel state is returned
- Check that all state slices are present (user, products, cart)

### 2. Get Specific State Path
Use `get_app_state` with a path parameter:
- Test `path: "cart"` to get just cart state
- Test `path: "user.profile"` for nested state
- Verify only requested slice is returned

### 3. Query Storage
Use `query_storage` to inspect persisted data:
- Test without key to list all storage keys
- Test with specific key to get a value
- Test with pattern to filter keys

### 4. Navigation State
Use `get_navigation_state` to check navigation:
- Verify current route is correct
- Navigate in app and check state updates
- Verify navigation stack history

### 5. Database Query (if applicable)
Use `query_database` to query local database:
- Test a simple SELECT query
- Verify results match app data

## Expected Results
- All tools should return valid JSON responses
- State should match what's visible in the app UI
- No connection errors or timeouts

## Report Issues
If any test fails, note:
- Which tool failed
- Error message received
- Steps to reproduce
