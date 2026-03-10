import { HttpInterceptorFn } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { finalize } from 'rxjs';
import { ProgressBarService } from '../services/progress-bar.service';

export const progressInterceptor: HttpInterceptorFn = (req, next) => {
  if (isPlatformServer(inject(PLATFORM_ID))) {
    return next(req);
  }

  const progressBar = inject(ProgressBarService);

  const skipUrls = ['/sse', '/actuator', '/health'];
  if (skipUrls.some(url => req.url.includes(url))) {
    return next(req);
  }

  progressBar.start();
  return next(req).pipe(finalize(() => progressBar.complete()));
};
