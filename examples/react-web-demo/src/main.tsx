import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MCPProvider, MCPStatusBadge } from '@mobile-dev-mcp/react';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <MCPProvider debug={true}>
        <App />
        <MCPStatusBadge />
      </MCPProvider>
    </BrowserRouter>
  </React.StrictMode>
);
