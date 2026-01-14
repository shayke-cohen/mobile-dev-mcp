# Add SDK Functionality

Guide for adding new functionality to the React Native SDK.

## Parameters
- `methodName` - Name of the method to add
- `purpose` - What this method enables

## SDK Structure

The SDK is in `packages/sdk-react-native/src/`:
- `index.ts` - Main entry point and MCP client
- `hooks/` - React hooks for easy integration
- `handlers/` - Command handlers for MCP tools

## Steps

### 1. Identify What to Expose

Common things to expose:
- App state (Redux, Zustand, Context)
- Navigation state
- Storage (AsyncStorage)
- Network requests
- UI component tree
- Custom app-specific data

### 2. Add Command Handler

In the SDK's command handler, add support for the new method:

```typescript
// In handlers or main client
case '{{methodName}}':
  return await this.{{methodName}}(params);
```

### 3. Implement the Method

```typescript
private async {{methodName}}(params: Record<string, unknown>): Promise<unknown> {
  // Implementation here
  // Access React Native APIs, app state, etc.
  
  return {
    // Return structured data
  };
}
```

### 4. Add Type Definitions

```typescript
interface {{MethodName}}Params {
  // Input parameters
}

interface {{MethodName}}Result {
  // Return type
}
```

### 5. Add Hook (Optional)

If this should be easily usable by app developers:

```typescript
// In hooks/
export function use{{MethodName}}() {
  const mcp = useMCPClient();
  
  const {{methodName}} = useCallback(async (params) => {
    return mcp.{{methodName}}(params);
  }, [mcp]);
  
  return { {{methodName}} };
}
```

### 6. Update Server Tool (if needed)

If this exposes new data for an MCP tool, update the corresponding tool in `packages/mcp-server/src/tools/`.

## Example: Exposing Custom Analytics

```typescript
// SDK method
async getAnalyticsEvents(params: { limit?: number }): Promise<AnalyticsEvent[]> {
  const events = await AnalyticsService.getRecentEvents(params.limit || 50);
  return events.map(e => ({
    name: e.name,
    timestamp: e.timestamp,
    properties: e.properties,
  }));
}
```

## Testing

1. Build SDK: `cd packages/sdk-react-native && yarn build`
2. Update demo app to use new SDK version
3. Rebuild demo app
4. Test via MCP tool

## Checklist

- [ ] Command handler added
- [ ] Method implemented
- [ ] Type definitions added
- [ ] Hook added (if applicable)
- [ ] Server tool updated (if applicable)
- [ ] Tested in demo app
- [ ] Types pass (`yarn typecheck`)
