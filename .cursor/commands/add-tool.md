# Add a New MCP Tool

Guide for adding a new tool to the MCP server.

## Parameters
- `toolName` - Name of the new tool (snake_case, e.g., "get_battery_level")
- `category` - Category: state, network, ui, logs, device, simulator, or build
- `description` - What the tool does

## Steps

### 1. Choose the Right Category

Tools are organized by category in `packages/mcp-server/src/tools/`:
- `state.ts` - App state inspection
- `network.ts` - Network requests/mocking
- `ui.ts` - UI inspection/interaction
- `logs.ts` - Logging and errors
- `device.ts` - Device/app info
- `simulator.ts` - Simulator control (local, no app needed)
- `build.ts` - Build operations (local, no app needed)

### 2. Define the Tool Schema

Add to the appropriate tools array (e.g., `deviceTools`):

```typescript
{
  name: '{{toolName}}',
  description: '{{description}}',
  inputSchema: {
    type: 'object' as const,
    properties: {
      // Define parameters here
      paramName: {
        type: 'string',
        description: 'What this param does',
      },
    },
    required: ['paramName'], // List required params
  },
},
```

### 3. Implement the Handler

For **device-required tools** (needs app connection):
- The handler sends a command to the connected app
- The app's SDK must handle this command

```typescript
// In the handle function, add a case or it routes automatically
// The SDK on the device will receive { method: 'toolName', params: args }
```

For **local tools** (simulator/build):
- Implement the actual logic in the handler
- See `simulator.ts` for examples

### 4. Update SDK (if device-required)

In `packages/sdk-react-native/src/`:
- Add handler for the new command
- Implement the logic to gather requested data
- Return the result

### 5. Test the Tool

1. Rebuild: `pnpm build`
2. Restart MCP server: `pnpm dev:server`
3. If device-required, reinstall app with updated SDK
4. Test the tool via Cursor

## Example: Adding a Battery Level Tool

```typescript
// In device.ts
export const deviceTools = [
  // ... existing tools
  {
    name: 'get_battery_level',
    description: 'Get current device battery level and charging status',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
];
```

## Checklist

- [ ] Tool added to correct category file
- [ ] Input schema defined with descriptions
- [ ] Handler implemented (or routed to SDK)
- [ ] SDK updated (if device-required)
- [ ] Tool tested and working
- [ ] Types pass (`pnpm typecheck`)
