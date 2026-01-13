# Build All Packages

Build all packages in the monorepo.

## Steps

1. **Install dependencies**
   ```bash
   pnpm install
   ```

2. **Run the build**
   ```bash
   pnpm build
   ```

3. **Verify build succeeded**
   - Check that `packages/mcp-server/dist/` exists
   - Check that `packages/sdk-react-native/dist/` exists
   - Check that `packages/babel-plugin-mcp/dist/` exists

4. **If build fails**
   - Run `pnpm typecheck` to identify TypeScript errors
   - Run `pnpm lint` to check for linting issues
   - Fix any reported issues

## Clean Build

If you need a fresh build:
```bash
pnpm clean && pnpm install && pnpm build
```
