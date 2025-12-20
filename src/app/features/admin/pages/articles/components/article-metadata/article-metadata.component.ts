import { Component, inject, input, ChangeDetectionStrategy } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { I18nService } from '../../../../../../core/services/i18n.service';

@Component({
  selector: 'app-article-metadata',
  imports: [ReactiveFormsModule],
  templateUrl: './article-metadata.component.html',
  styleUrl: './article-metadata.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArticleMetadataComponent {
  i18n = inject(I18nService);

  titleControl = input.required<FormControl<string>>();
  slugControl = input.required<FormControl<string>>();
  excerptControl = input.required<FormControl<string>>();
}
