import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LoadingSpinnerComponent } from '../loading-spinner/loading-spinner.component';
import { TagTextColorPipe } from '../../utils/tag-text-color.pipe';

export interface TagCloudItem {
  name: string;
  slug: string;
  color?: string;
  articleCount?: number;
}

@Component({
  selector: 'app-tag-cloud',
  imports: [RouterLink, LoadingSpinnerComponent, TagTextColorPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tag-cloud.component.html',
  styleUrl: './tag-cloud.component.scss',
})
export class TagCloudComponent {
  tags = input.required<TagCloudItem[]>();
  loading = input(false);
  showCount = input(true);
}
