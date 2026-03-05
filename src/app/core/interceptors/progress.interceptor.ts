import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { ProgressBarService } from '../services/progress-bar.service';

export const progressInterceptor: HttpInterceptorFn = (req, next) => {
  const progressBar = inject(ProgressBarService);

  const skipUrls = ['/sse', '/actuator', '/health'];
  if (skipUrls.some(url => req.url.includes(url))) {
    return next(req);
  }

  progressBar.start();
  return next(req).pipe(finalize(() => progressBar.complete()));
};
