declare module '@babel/helper-plugin-utils' {
  import type { PluginObj, types as BabelTypes } from '@babel/core';
  
  export function declare<T>(
    builder: (api: { assertVersion: (v: number) => void; types: typeof BabelTypes }, options: T) => PluginObj
  ): (api: unknown, options: T) => PluginObj;
}
