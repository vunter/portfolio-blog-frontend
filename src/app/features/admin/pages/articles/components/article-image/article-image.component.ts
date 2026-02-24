import { Component, inject, input, output, ChangeDetectionStrategy } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { I18nService } from '../../../../../../core/services/i18n.service';

@Component({
  selector: 'app-article-image',
  imports: [ReactiveFormsModule],
  templateUrl: './article-image.component.html',
  styleUrl: './article-image.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArticleImageComponent {
  i18n = inject(I18nService);

  imageUrlControl = input.required<FormControl<string>>();
  uploading = input<boolean>(false);

  imageSelected = output<Event>();

  onFileSelected(event: Event): void {
    this.imageSelected.emit(event);
  }
}
