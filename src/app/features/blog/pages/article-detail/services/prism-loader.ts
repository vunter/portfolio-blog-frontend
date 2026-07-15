// Single lazy-loaded chunk that bundles Prism core + the grammars we highlight.
// prism-global MUST be first: it publishes the global `Prism` the grammar IIFEs
// read, and ESM evaluates these imports in source order, so the global exists
// before any grammar runs. Order also matters within the grammars: typescript
// extends javascript, so javascript stays ahead of it. A single dynamic
// `import('./prism-loader')` from the highlighter keeps all of this off the
// initial bundle.
import Prism from './prism-global';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-css';

export default Prism;
