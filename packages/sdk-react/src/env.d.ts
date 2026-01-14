/**
 * Environment type declarations
 * These are typically provided by bundlers like Vite, Webpack, etc.
 */

declare const process: {
  env: {
    NODE_ENV: 'development' | 'production' | 'test';
    [key: string]: string | undefined;
  };
};
