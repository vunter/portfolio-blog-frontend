import { TestBed } from '@angular/core/testing';
import { MonacoLoaderService } from './monaco-loader.service';

describe('MonacoLoaderService', () => {
  let service: MonacoLoaderService;
  let appendChildSpy: jasmine.Spy;

  beforeEach(() => {
    // Clean up any previous monaco global
    delete (window as any).monaco;
    delete (window as any).require;

    appendChildSpy = spyOn(document.head, 'appendChild').and.callFake(<T extends Node>(el: T): T => el);

    TestBed.configureTestingModule({
      providers: [MonacoLoaderService],
    });

    service = TestBed.inject(MonacoLoaderService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should have isLoaded as false initially', () => {
    expect(service.isLoaded()).toBeFalse();
  });

  it('should resolve immediately if window.monaco is already defined', async () => {
    (window as any).monaco = {};

    // Need a fresh instance since loadPromise is cached
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [MonacoLoaderService],
    });
    const freshService = TestBed.inject(MonacoLoaderService);

    await freshService.load();

    expect(freshService.isLoaded()).toBeTrue();
  });

  it('should create a script element pointing to Monaco CDN', () => {
    service.load();

    expect(appendChildSpy).toHaveBeenCalled();
    const scriptEl = appendChildSpy.calls.mostRecent().args[0] as HTMLScriptElement;
    expect(scriptEl.tagName).toBe('SCRIPT');
    expect(scriptEl.src).toContain('monaco-editor');
    expect(scriptEl.src).toContain('loader.js');
  });

  it('should return the same promise on subsequent calls', () => {
    const promise1 = service.load();
    const promise2 = service.load();

    expect(promise1).toBe(promise2);
  });

  it('should set isLoaded to true after successful load', async () => {
    // Simulate the script onload flow
    appendChildSpy.and.callFake((el: Node) => {
      const script = el as HTMLScriptElement;
      // Mock the AMD require that Monaco loader creates
      (window as any).require = Object.assign(
        (deps: string[], callback: () => void) => callback(),
        { config: () => {} }
      );
      // Trigger onload
      setTimeout(() => script.onload!(new Event('load')), 0);
      return el;
    });

    await service.load();

    expect(service.isLoaded()).toBeTrue();
  });

  it('should reject the promise when script fails to load', async () => {
    appendChildSpy.and.callFake((el: Node) => {
      const script = el as HTMLScriptElement;
      setTimeout(() => script.onerror!(new Event('error')), 0);
      return el;
    });

    await expectAsync(service.load()).toBeRejectedWithError('Failed to load Monaco editor');
  });

  it('should configure require with correct Monaco CDN paths', async () => {
    let configCalledWith: any;
    appendChildSpy.and.callFake((el: Node) => {
      const script = el as HTMLScriptElement;
      (window as any).require = Object.assign(
        (deps: string[], callback: () => void) => callback(),
        {
          config: (cfg: any) => {
            configCalledWith = cfg;
          },
        }
      );
      setTimeout(() => script.onload!(new Event('load')), 0);
      return el;
    });

    await service.load();

    expect(configCalledWith).toBeDefined();
    expect(configCalledWith.paths.vs).toContain('monaco-editor');
  });

  it('should require vs/editor/editor.main module', async () => {
    let requiredDeps: string[] = [];
    appendChildSpy.and.callFake((el: Node) => {
      const script = el as HTMLScriptElement;
      (window as any).require = Object.assign(
        (deps: string[], callback: () => void) => {
          requiredDeps = deps;
          callback();
        },
        { config: () => {} }
      );
      setTimeout(() => script.onload!(new Event('load')), 0);
      return el;
    });

    await service.load();

    expect(requiredDeps).toContain('vs/editor/editor.main');
  });
});
