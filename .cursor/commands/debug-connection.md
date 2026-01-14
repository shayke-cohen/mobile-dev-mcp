# Debug MCP Connection Issues

Troubleshoot when the mobile app isn't connecting to the MCP server.

## Quick Checks

1. **Is the MCP server running?**
   ```bash
   lsof -i :8765
   ```
   If not, start it:
   ```bash
   yarn dev:server
   ```

2. **Can you reach the server?**
   ```bash
   curl -i http://localhost:8765
   ```
   (WebSocket server won't respond to HTTP, but should show connection refused if not running)

3. **Is the app configured correctly?**
   - Check the MCP SDK initialization in the app
   - Verify WebSocket URL is `ws://localhost:8765`
   - For Android emulator, use `ws://10.0.2.2:8765` (emulator's localhost alias)

## Common Issues

### Issue: "Connection refused"
**Cause**: MCP server not running
**Fix**: Run `yarn dev:server` from the project root

### Issue: Android emulator can't connect
**Cause**: `localhost` in emulator doesn't point to host machine
**Fix**: Use `10.0.2.2` instead of `localhost` in the app's MCP configuration

### Issue: iOS simulator can't connect
**Cause**: Usually network or firewall issue
**Fix**: 
- Check macOS firewall settings
- Try `ws://127.0.0.1:8765` instead of `localhost`

### Issue: Server shows no connections
**Cause**: SDK not initialized or app crashed
**Fix**:
1. Check app logs for MCP SDK errors
2. Verify SDK is initialized early in app lifecycle
3. Check for any crash logs

### Issue: Connection drops intermittently
**Cause**: App backgrounding or network issues
**Fix**:
- Keep app in foreground during development
- Check for WebSocket timeout settings

## Debug Steps

1. **Check server logs**
   - Look for "WebSocket server started" message
   - Look for connection/disconnection events

2. **Check app-side logs**
   - Enable verbose logging in MCP SDK
   - Look for connection attempt logs

3. **Test with simple client**
   ```bash
   npx wscat -c ws://localhost:8765
   ```

4. **Verify SDK integration**
   - Check that MCP SDK package is installed
   - Verify initialization code is correct
   - Ensure no duplicate SDK instances

## Still Not Working?

Collect this info for debugging:
- MCP server logs
- App logs related to MCP/WebSocket
- Device/simulator type and OS version
- Network configuration
