# Comprehensive MCP Tools Test

Run a complete test of all MCP tools against a running demo app.

## Prerequisites
- MCP server running (`yarn dev:server`)
- A demo app running and connected
- Run `list_connected_devices` first to verify connection

## Test Checklist

### Device & App Info Tools
- [ ] `get_device_info` - Returns device specs
- [ ] `get_app_info` - Returns app version/build info
- [ ] `list_connected_devices` - Shows connected device
- [ ] `list_feature_flags` - Lists available flags
- [ ] `toggle_feature_flag` - Can toggle a flag
- [ ] `check_permissions` - Shows permission status

### State & Data Tools
- [ ] `get_app_state` - Returns full state
- [ ] `get_app_state` with path - Returns specific slice
- [ ] `query_storage` - Lists storage keys
- [ ] `query_storage` with key - Returns specific value
- [ ] `get_navigation_state` - Returns current route

### Network Tools
- [ ] `list_network_requests` - Shows recent requests
- [ ] `mock_network_request` - Can mock an endpoint
- [ ] `replay_network_request` - Can replay a request
- [ ] `clear_network_mocks` - Removes mocks

### UI Tools
- [ ] `get_component_tree` - Returns component hierarchy
- [ ] `get_layout_tree` - Returns view bounds
- [ ] `capture_screenshot` - Returns base64 image
- [ ] `inspect_element` - Returns element at coords
- [ ] `simulate_interaction` (tap) - Triggers tap
- [ ] `simulate_interaction` (input) - Enters text
- [ ] `navigate_to` - Changes screen

### Logging Tools
- [ ] `get_logs` - Returns app logs
- [ ] `get_recent_errors` - Returns errors (if any)
- [ ] `get_crash_reports` - Returns crashes (if any)
- [ ] `get_function_trace` - Returns traces (if enabled)

### Simulator Tools (no app needed)
- [ ] `list_simulators` - Lists iOS/Android simulators
- [ ] `boot_simulator` - Can boot a simulator
- [ ] `simulator_screenshot` - Takes screenshot
- [ ] `open_url` - Opens URL/deep link
- [ ] `set_location` - Sets GPS location

### Build Tools (no app needed)
- [ ] `get_build_status` - Shows build history
- [ ] `clean_build` - Cleans build artifacts

## Results Summary

After testing, document:
1. Tools that passed ✅
2. Tools that failed ❌
3. Error messages for failures
4. Any unexpected behavior

## Reporting Issues

For any failures, create an issue with:
- Tool name
- Input parameters used
- Expected result
- Actual result/error
- Device/simulator info
