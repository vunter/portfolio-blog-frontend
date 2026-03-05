import { Component, input, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-skeleton',
  templateUrl: './skeleton.component.html',
  styleUrl: './skeleton.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SkeletonComponent {
  variant = input<'card' | 'text' | 'circle' | 'article-detail' | 'table' | 'profile' | 'stats' | 'comments'>('card');
}
