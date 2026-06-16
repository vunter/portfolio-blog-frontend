import { Injectable } from '@angular/core';
import { PreloadingStrategy, Route } from '@angular/router';
import { Observable, of } from 'rxjs';

/**
 * PERF-2: Opt-in preloading strategy.
 *
 * Unlike PreloadAllModules — which eagerly downloads every lazy chunk
 * (admin / resume / auth) for anonymous visitors — this strategy only
 * preloads a route when it explicitly opts in via `data: { preload: true }`.
 * Everything else (in particular guarded admin/resume/auth chunks) is left
 * to load on demand at navigation time.
 */
@Injectable({
  providedIn: 'root',
})
export class SelectivePreloadStrategy implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    return route.data?.['preload'] === true ? load() : of(null);
  }
}
