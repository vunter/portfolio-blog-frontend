/**
 * Shared Monaco Editor type declarations.
 *
 * Monaco is loaded from a local asset bundle by MonacoLoaderService at
 * runtime, so the full 'monaco-editor' npm types are intentionally not in
 * the build graph. These minimal types name only the surface this app uses;
 * extend them if a new Monaco API gets called.
 */

export interface MonacoRequireShim {
  config(opts: { paths?: Record<string, string> }): void;
  (deps: string[], cb: () => void): void;
}

export interface MonacoNamespace {
  editor: MonacoEditorNamespace;
}

export interface MonacoEditorNamespace {
  create(el: HTMLElement, opts: Record<string, unknown>): MonacoStandaloneEditor;
  createModel(value: string, language?: string): MonacoTextModel;
  setTheme(theme: string): void;
}

/** Opaque selection range — only passed back into executeEdits / getValueInRange. */
export interface MonacoSelection {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

export interface MonacoEditOperation {
  /** Optional caller-supplied identifier (Monaco threads it through to undo). */
  identifier?: { major: number; minor: number };
  range: MonacoSelection | null;
  text: string;
  forceMoveMarkers?: boolean;
}

export interface MonacoPosition {
  lineNumber: number;
  column: number;
}

export interface MonacoStandaloneEditor {
  setModel(model: MonacoTextModel | null): void;
  getModel(): MonacoTextModel | null;
  getValue(): string;
  setValue(value: string): void;
  getSelection(): MonacoSelection | null;
  getPosition(): MonacoPosition | null;
  setPosition(position: MonacoPosition): void;
  executeEdits(source: string, edits: MonacoEditOperation[]): boolean;
  focus(): void;
  layout(): void;
  dispose(): void;
  onDidChangeModelContent(listener: () => void): { dispose(): void };
  updateOptions(opts: Record<string, unknown>): void;
}

export interface MonacoTextModel {
  getValue(): string;
  setValue(value: string): void;
  getValueInRange(range: MonacoSelection): string;
  dispose(): void;
  onDidChangeContent(listener: () => void): { dispose(): void };
}

declare global {
  interface Window {
    /** RequireJS shim Monaco's AMD loader expects to be on `window`. */
    require?: MonacoRequireShim;
    /** The Monaco namespace once the loader has resolved. */
    monaco?: MonacoNamespace;
  }

  /** Monaco is also available as a free-standing global once the loader resolves. */
  const monaco: MonacoNamespace;
}
