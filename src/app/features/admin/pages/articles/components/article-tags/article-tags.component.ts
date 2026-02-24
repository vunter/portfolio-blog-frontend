import { Component, inject, input, output, ChangeDetectionStrategy } from '@angular/core';
import { I18nService } from '../../../../../../core/services/i18n.service';
import { TagResponse } from '../../../../../../models';

@Component({
  selector: 'app-article-tags',
  imports: [],
  templateUrl: './article-tags.component.html',
  styleUrl: './article-tags.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArticleTagsComponent {
  i18n = inject(I18nService);

  tags = input.required<TagResponse[]>();
  selectedTagIds = input.required<string[]>();

  tagToggled = output<string>();

  isTagSelected(tagId: string): boolean {
    return this.selectedTagIds().includes(tagId);
  }

  onToggleTag(tagId: string): void {
    this.tagToggled.emit(tagId);
  }
}
