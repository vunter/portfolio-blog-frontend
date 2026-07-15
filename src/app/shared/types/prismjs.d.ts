// Prism is loaded lazily and used defensively (see content-processor.service.ts).
// It has no bundled type declarations and @types/prismjs isn't a dependency, so
// declare the module (and its grammar component sub-paths) as ambient `any`.
declare module 'prismjs';
declare module 'prismjs/components/*';
