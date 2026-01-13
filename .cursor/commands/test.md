# Run Tests

Run the test suite and fix any failures.

## Steps

### 1. Run All Tests
```bash
pnpm test
```

### 2. If Tests Fail

Analyze the failures:
- Check which test file(s) failed
- Read the error messages and stack traces
- Identify if it's a code bug or test issue

### 3. Run Specific Test File

To focus on a failing test:
```bash
cd packages/mcp-server
pnpm test src/__tests__/specific-file.test.ts
```

### 4. Run Tests in Watch Mode

For iterative fixing:
```bash
cd packages/mcp-server
pnpm test --watch
```

### 5. Fix Failures

For each failure:
1. Understand what the test expects
2. Check if the implementation is wrong or the test is outdated
3. Fix the code or update the test
4. Re-run to verify

### 6. Check Coverage (Optional)

```bash
pnpm test --coverage
```

## Test Locations

- `packages/mcp-server/src/__tests__/` - Server tests
  - `device-manager.test.ts` - Device connection tests
  - `helpers.test.ts` - Utility function tests
  - `simulator.test.ts` - Simulator tool tests

## Writing New Tests

When adding features, add tests:

```typescript
import { describe, it, expect } from 'vitest';

describe('featureName', () => {
  it('should do something', () => {
    const result = myFunction();
    expect(result).toBe(expected);
  });
});
```

## Common Issues

- **Timeout errors**: Increase timeout or mock slow operations
- **Import errors**: Check that all dependencies are built
- **Flaky tests**: Look for race conditions or timing issues
