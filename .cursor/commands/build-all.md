# Build All Packages

Build all packages in the monorepo.

## Steps

1. **Install dependencies**
   ```bash
   yarn install
   ```

2. **Run the build**
   ```bash
   yarn build
   ```

3. **Verify build succeeded**
   - Check that `packages/mcp-server/dist/` exists
   - Check that `packages/sdk-react-native/dist/` exists
   - Check that `packages/babel-plugin-mcp/dist/` exists

4. **If build fails**
   - Run `yarn typecheck` to identify TypeScript errors
   - Run `yarn lint` to check for linting issues
   - Fix any reported issues

## Clean Build

If you need a fresh build:
```bash
yarn clean && yarn install && yarn build
```
