import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LoadingSpinnerComponent } from '../loading-spinner/loading-spinner.component';

export interface TagCloudItem {
  name: string;
  slug: string;
  color?: string;
  articleCount?: number;
}

@Component({
  selector: 'app-tag-cloud',
  imports: [RouterLink, LoadingSpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tag-cloud.component.html',
  styleUrl: './tag-cloud.component.scss',
})
export class TagCloudComponent {
  tags = input.required<TagCloudItem[]>();
  loading = input(false);
  showCount = input(true);
}
