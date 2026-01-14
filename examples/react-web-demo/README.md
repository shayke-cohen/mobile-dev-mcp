# MCP Demo Store - React Web

A demo React web application showcasing the `@mobile-dev-mcp/react` SDK integration.

## Features

- 🛒 **E-commerce Demo** - Products, cart, and checkout flow
- 🔍 **State Exposure** - Cart, user, and product state visible to AI
- 🎮 **Action Registration** - Cart operations, login/logout accessible to AI
- 🌳 **Component Registration** - UI elements discoverable via data-testid
- 🧭 **Navigation Tracking** - Route changes tracked automatically
- 🔬 **Function Tracing** - Cart calculations traced for debugging

## Getting Started

### Prerequisites

- Node.js 18+
- MCP server running (`yarn dev` from monorepo root)

### Installation

```bash
# From monorepo root
yarn install

# Or from this directory
yarn install
```

### Running

```bash
# Start development server
yarn dev

# Build for production
yarn build

# Preview production build
yarn preview
```

The app runs on http://localhost:3000

## SDK Integration

### Provider Setup

```tsx
// main.tsx
import { MCPProvider, MCPStatusBadge } from '@mobile-dev-mcp/react';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <MCPProvider debug={true}>
    <App />
    <MCPStatusBadge />  {/* Shows connection status */}
  </MCPProvider>
);
```

### State Exposure

```tsx
// Expose multiple states at once
useMCPStates({
  user: () => user,
  isLoggedIn: () => !!user,
  cart: () => cart,
  cartTotal: () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
  products: () => products,
});
```

### Action Registration

```tsx
useMCPActions({
  addToCart: (params) => addToCart(params.productId as string),
  removeFromCart: (params) => removeFromCart(params.productId as string),
  clearCart: () => clearCart(),
  login: () => login(),
  logout: () => logout(),
});
```

### Navigation Tracking

```tsx
import { useLocation } from 'react-router-dom';
import { useMCPNavigation } from '@mobile-dev-mcp/react';

function App() {
  const location = useLocation();
  useMCPNavigation(location.pathname);
  // ...
}
```

### UI Component Registration

Elements with `data-testid` are automatically discoverable:

```tsx
<button data-testid="add-to-cart-1">Add to Cart</button>
<span data-testid="cart-total">${total}</span>
```

For more control, use the `useMCPComponent` hook:

```tsx
import { useMCPComponent } from '@mobile-dev-mcp/react';

function SubmitButton() {
  const ref = useMCPComponent('submit-btn', {
    type: 'Button',
    getText: () => 'Submit Order',
    onTap: () => handleSubmit(),
  });
  
  return <button ref={ref}>Submit Order</button>;
}
```

## MCP Tools for Web

When the app is connected, AI can use these tools:

| Tool | Description |
|------|-------------|
| `get_app_state` | Get cart, user, product state |
| `list_actions` | List available actions |
| `execute_action` | Trigger addToCart, login, etc. |
| `get_component_tree` | Get UI hierarchy |
| `find_element` | Find elements by testId |
| `simulate_interaction` | Click buttons, fill inputs |
| `get_traces` | View function trace history |
| `get_logs` | View console logs |

## Project Structure

```
react-web-demo/
├── src/
│   ├── main.tsx         # Entry point with MCPProvider
│   ├── App.tsx          # Main app with SDK integration
│   ├── index.css        # Styles
│   └── vite-env.d.ts    # Vite types
├── index.html           # HTML template
├── package.json
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```

## Testing

The app is tested as part of the monorepo E2E tests:

```bash
# From monorepo root
yarn test:e2e:web
```

## License

MIT
