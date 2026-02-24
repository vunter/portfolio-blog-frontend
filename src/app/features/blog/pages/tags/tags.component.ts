import { Component, inject, signal, OnInit, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TagService } from '../../services/tag.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { TagResponse } from '../../../../models';

@Component({
  selector: 'app-tags',
  imports: [RouterLink, LoadingSpinnerComponent],
  templateUrl: './tags.component.html',
  styleUrl: './tags.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TagsComponent implements OnInit {
  private tagService = inject(TagService);
  private readonly destroyRef = inject(DestroyRef);
  readonly i18n = inject(I18nService);

  tags = signal<TagResponse[]>([]);
  loading = signal(true);

  ngOnInit(): void {
    this.loadTags();
  }

  loadTags(): void {
    this.loading.set(true);
    this.tagService.getTags().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (tags) => {
        this.tags.set(tags);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }
}
