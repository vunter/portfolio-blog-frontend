// Loads Prism core and publishes it as the global `Prism` the grammar component
// files reference (they end in `}(Prism))`, reading a global, not an ESM binding).
// esbuild/Vite wrap prismjs as an ESM module, and in that form core does NOT
// self-register on window — so without this the first grammar throws
// "Prism is not defined". This module must be imported BEFORE any grammar so the
// global exists when the grammar IIFE runs (ESM evaluates a module's imports in
// source order).
import Prism from 'prismjs';

(globalThis as unknown as { Prism?: unknown }).Prism = Prism;

export default Prism;
