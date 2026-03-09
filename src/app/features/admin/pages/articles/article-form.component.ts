import { Component, inject, signal, OnInit, OnDestroy, ElementRef, AfterViewInit, ChangeDetectionStrategy, DestroyRef, viewChild, afterNextRender, Injector } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { MarkdownModule } from 'ngx-markdown';
import { VersionHistoryComponent } from '../../components/version-history/version-history.component';
import { ArticleMetadataComponent } from './components/article-metadata/article-metadata.component';
import { ArticleImageComponent } from './components/article-image/article-image.component';
import { ArticleTagsComponent } from './components/article-tags/article-tags.component';
import { EditorToolbarComponent } from './components/editor-toolbar/editor-toolbar.component';
import { Subject, debounceTime } from 'rxjs';
import { ApiService } from '../../../../core/services/api.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { MonacoLoaderService } from '../../../../core/services/monaco-loader.service';
import { ArticleResponse, ArticleRequest, ArticleReview, ArticleI18nResponse, TagResponse, ArticleStatus } from '../../../../models';

// Monaco type declarations provided by shared/types/monaco.d.ts

interface ArticleForm {
  title: FormControl<string>;
  slug: FormControl<string>;
  excerpt: FormControl<string>;
  content: FormControl<string>;
  featuredImageUrl: FormControl<string>;
  metaTitle: FormControl<string>;
  metaDescription: FormControl<string>;
}

@Component({
  selector: 'app-article-form',
  imports: [ReactiveFormsModule, RouterLink, DatePipe, MarkdownModule, VersionHistoryComponent, ArticleMetadataComponent, ArticleImageComponent, ArticleTagsComponent, EditorToolbarComponent],
  host: {
    '(window:keydown)': 'onKeyDown($event)',
  },
  templateUrl: './article-form.component.html',
  styleUrl: './article-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArticleFormComponent implements OnInit, AfterViewInit, OnDestroy {
  // ANG20-05: viewChild() signal queries instead of @ViewChild decorators
  readonly monacoEditorContainer = viewChild<ElementRef>('monacoEditorContainer');
  readonly versionHistory = viewChild<VersionHistoryComponent>('versionHistory');

  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly apiService = inject(ApiService);
  private readonly notification = inject(NotificationService);
  private readonly themeService = inject(ThemeService);
  private readonly monacoLoader = inject(MonacoLoaderService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  readonly i18n = inject(I18nService);

  isEditMode = signal(false);
  saving = signal(false);
  editorMode = signal<'write' | 'preview' | 'split'>('write');
  isFullscreen = signal(false);
  autoSaveStatus = signal<'saved' | 'saving' | 'unsaved' | null>(null);
  availableTags = signal<TagResponse[]>([]);
  selectedTagIds = signal<string[]>([]);
  uploadingCoverImage = signal(false);
  uploadingContentImage = signal(false);
  showScheduleInput = signal(false);
  scheduledAtControl = new FormControl('');
  reviewHistory = signal<ArticleReview[]>([]);
  showReviewPanel = signal(false);
  reviewFeedbackText = signal('');

  // Translation management
  translations = signal<ArticleI18nResponse[]>([]);
  availableLocales = signal<string[]>([]);
  showTranslationPanel = signal(false);
  selectedTranslationLocale = signal('');
  translating = signal(false);

  // Split pane ratio (flex values)
  splitLeft = signal('1');
  splitRight = signal('1');
  private resizing = false;
  private resizeContainer: HTMLElement | null = null;
  private resizeCleanup: (() => void) | null = null;
  private rafPending = false;

  private monacoEditor: any = null;
  private monacoLoaded = false;
  private pendingContent: string | null = null;

  // Auto-save
  private autoSave$ = new Subject<void>();
  hasUnsavedChanges = false;
  private lastSavedContent = '';
  originalStatus = 'DRAFT';

  form = this.fb.group<ArticleForm>({
    title: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    slug: new FormControl('', { nonNullable: true }),
    excerpt: new FormControl('', { nonNullable: true }),
    content: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    featuredImageUrl: new FormControl('', { nonNullable: true }),
    metaTitle: new FormControl('', { nonNullable: true }),
    metaDescription: new FormControl('', { nonNullable: true }),
  });

  articleId: string | null = null;

  readonly keyboardShortcutsTitle = 'Ctrl+S: Save · Ctrl+P: Preview · Esc: Exit fullscreen';

  // ANG20-06: Moved from @HostListener to host property
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.isFullscreen()) {
      this.toggleFullscreen();
      return;
    }

    // Ctrl+S / Cmd+S — Save article
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
      event.preventDefault();
      this.saveDraft();
      return;
    }

    // Ctrl+P / Cmd+P — Toggle preview
    if ((event.ctrlKey || event.metaKey) && event.key === 'p') {
      event.preventDefault();
      this.setEditorMode(this.editorMode() === 'preview' ? 'write' : 'preview');
      return;
    }
  }

  ngOnInit(): void {
    this.loadTags();

    const id = this.route.snapshot.params['id'];
    if (id) {
      this.articleId = id;
      this.isEditMode.set(true);
      this.loadArticle(id);
    }

    // Auto-generate slug from title
    this.form.controls.title.valueChanges.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((title: string) => {
      if (!this.isEditMode() && title) {
        const slug = this.generateSlug(title);
        this.form.controls.slug.setValue(slug, { emitEvent: false });
      }
    });

    // Auto-save: debounce 3 seconds after last change
    this.autoSave$.pipe(
      debounceTime(3000),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      this.performAutoSave();
    });

    // Track form changes for auto-save
    this.form.valueChanges.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      if (this.isEditMode() && this.articleId) {
        this.hasUnsavedChanges = true;
        this.autoSaveStatus.set('unsaved');
        this.autoSave$.next();
      }
    });
  }

  ngAfterViewInit(): void {
    if (this.editorMode() !== 'preview') {
      this.loadMonaco();
    }
  }

  ngOnDestroy(): void {
    if (this.monacoEditor) {
      this.monacoEditor.dispose();
      this.monacoEditor = null;
    }
    // HIGH-06: Clean up any active resize listeners if destroyed mid-resize
    this.resizeCleanup?.();
  }

  // ===== Fullscreen =====

  toggleFullscreen(): void {
    this.isFullscreen.update(v => !v);
    afterNextRender(() => {
      this.monacoEditor?.layout();
    }, { injector: this.injector });
  }

  // ===== Resize Split Panes =====

  onResizeStart(event: MouseEvent): void {
    event.preventDefault();
    this.resizing = true;
    this.resizeContainer = (event.target as HTMLElement).closest('.editor-container');
    const onMove = (e: MouseEvent) => this.onResizeMove(e.clientX);
    const onUp = () => {
      this.resizing = false;
      this.resizeContainer = null;
      this.resizeCleanup = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    // HIGH-06: Store cleanup for ngOnDestroy safety
    this.resizeCleanup = onUp;
  }

  onResizeTouchStart(event: TouchEvent): void {
    event.preventDefault();
    this.resizing = true;
    this.resizeContainer = (event.target as HTMLElement).closest('.editor-container');
    const onMove = (e: TouchEvent) => this.onResizeMove(e.touches[0].clientX);
    const onUp = () => {
      this.resizing = false;
      this.resizeContainer = null;
      this.resizeCleanup = null;
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
    };
    document.addEventListener('touchmove', onMove);
    document.addEventListener('touchend', onUp);
    // HIGH-06: Store cleanup for ngOnDestroy safety
    this.resizeCleanup = onUp;
  }

  private onResizeMove(clientX: number): void {
    if (!this.resizing || !this.resizeContainer) return;
    if (this.rafPending) return;
    this.rafPending = true;
    requestAnimationFrame(() => {
      this.rafPending = false;
      if (!this.resizing || !this.resizeContainer) return;
      const rect = this.resizeContainer.getBoundingClientRect();
      const total = rect.width;
      const offsetX = clientX - rect.left;
      const pct = Math.max(20, Math.min(80, (offsetX / total) * 100));
      this.splitLeft.set(`${pct}`);
      this.splitRight.set(`${100 - pct}`);
      this.monacoEditor?.layout();
    });
  }

  // ===== Auto-save =====

  private performAutoSave(): void {
    if (!this.isEditMode() || !this.articleId || !this.hasUnsavedChanges || this.saving()) return;

    const currentContent = JSON.stringify(this.form.getRawValue());
    if (currentContent === this.lastSavedContent) {
      this.hasUnsavedChanges = false;
      this.autoSaveStatus.set('saved');
      return;
    }

    this.autoSaveStatus.set('saving');
    const formValue = this.form.getRawValue();
    const selectedSlugs = this.selectedTagIds()
      .map(id => this.availableTags().find(t => t.id === id)?.slug)
      .filter((s): s is string => !!s);

    const data: ArticleRequest = {
      slug: formValue.slug,
      title: formValue.title || 'Untitled',
      content: formValue.content,
      excerpt: formValue.excerpt || undefined,
      coverImageUrl: formValue.featuredImageUrl || undefined,
      status: (this.originalStatus || 'DRAFT') as ArticleStatus,
      tagSlugs: selectedSlugs,
      seoTitle: formValue.metaTitle || undefined,
      seoDescription: formValue.metaDescription || undefined,
    };

    this.apiService.put(`/admin/articles/${this.articleId}`, data).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.hasUnsavedChanges = false;
        this.lastSavedContent = currentContent;
        this.autoSaveStatus.set('saved');
        // Clear "saved" indicator after 5 seconds
        setTimeout(() => {
          if (this.autoSaveStatus() === 'saved') {
            this.autoSaveStatus.set(null);
          }
        }, 5000);
      },
      error: () => {
        this.autoSaveStatus.set('unsaved');
      },
    });
  }

  // ===== Monaco Editor =====

  private async loadMonaco(): Promise<void> {
    if (this.monacoLoaded) {
      this.initMonacoEditor();
      return;
    }
    await this.monacoLoader.load();
    this.monacoLoaded = true;
    this.initMonacoEditor();
  }

  private initMonacoEditor(): void {
    const container = this.monacoEditorContainer()?.nativeElement;
    if (!container || this.monacoEditor) return;

    const isDark = this.themeService.isDark();
    this.monacoEditor = monaco.editor.create(container, {
      value: this.pendingContent ?? this.form.controls.content.value,
      language: 'markdown',
      theme: isDark ? 'vs-dark' : 'vs',
      minimap: { enabled: false },
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
      lineNumbers: 'on',
      wordWrap: 'on',
      automaticLayout: true,
      tabSize: 2,
      scrollBeyondLastLine: false,
      padding: { top: 12, bottom: 12 },
      bracketPairColorization: { enabled: true },
      renderLineHighlight: 'line',
      overviewRulerLanes: 0,
      hideCursorInOverviewRuler: true,
      scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
    });

    this.pendingContent = null;

    // Sync Monaco -> form control
    this.monacoEditor.onDidChangeModelContent(() => {
      const value = this.monacoEditor.getValue();
      this.form.controls.content.setValue(value, { emitEvent: true });
    });
  }

  setEditorMode(mode: 'write' | 'preview' | 'split'): void {
    const prevMode = this.editorMode();
    this.editorMode.set(mode);

    // Reset split ratio when entering split mode
    if (mode === 'split') {
      this.splitLeft.set('1');
      this.splitRight.set('1');
    }

    if (mode === 'preview') {
      // Destroy Monaco when switching to preview
      if (this.monacoEditor) {
        this.monacoEditor.dispose();
        this.monacoEditor = null;
      }
    } else if (prevMode === 'preview') {
      // Recreate Monaco when switching back from preview
      afterNextRender(() => this.loadMonaco(), { injector: this.injector });
    } else if (this.monacoEditor) {
      // Layout update for split mode toggle
      afterNextRender(() => this.monacoEditor?.layout(), { injector: this.injector });
    }
  }

  insertMarkdown(type: string): void {
    if (!this.monacoEditor) return;

    const selection = this.monacoEditor.getSelection();
    const selectedText = this.monacoEditor.getModel().getValueInRange(selection) || '';
    let insert = '';
    let cursorOffset = 0;

    switch (type) {
      case 'bold':
        insert = `**${selectedText || 'bold text'}**`;
        if (!selectedText) cursorOffset = -2;
        break;
      case 'italic':
        insert = `*${selectedText || 'italic text'}*`;
        if (!selectedText) cursorOffset = -1;
        break;
      case 'strikethrough':
        insert = `~~${selectedText || 'text'}~~`;
        if (!selectedText) cursorOffset = -2;
        break;
      case 'h1':
        insert = `# ${selectedText || 'Heading 1'}`;
        break;
      case 'h2':
        insert = `## ${selectedText || 'Heading 2'}`;
        break;
      case 'h3':
        insert = `### ${selectedText || 'Heading 3'}`;
        break;
      case 'ul':
        insert = selectedText
          ? selectedText.split('\n').map((l: string) => `- ${l}`).join('\n')
          : '- Item 1\n- Item 2\n- Item 3';
        break;
      case 'ol':
        insert = selectedText
          ? selectedText.split('\n').map((l: string, i: number) => `${i + 1}. ${l}`).join('\n')
          : '1. Item 1\n2. Item 2\n3. Item 3';
        break;
      case 'checklist':
        insert = selectedText
          ? selectedText.split('\n').map((l: string) => `- [ ] ${l}`).join('\n')
          : '- [ ] Task 1\n- [ ] Task 2\n- [x] Task 3';
        break;
      case 'link':
        insert = selectedText ? `[${selectedText}](url)` : '[link text](url)';
        break;
      case 'image':
        insert = selectedText ? `![${selectedText}](url)` : '![alt text](image-url)';
        break;
      case 'code':
        insert = `\`${selectedText || 'code'}\``;
        if (!selectedText) cursorOffset = -1;
        break;
      case 'codeblock':
        insert = `\n\`\`\`\n${selectedText || 'code here'}\n\`\`\`\n`;
        break;
      case 'quote':
        insert = selectedText
          ? selectedText.split('\n').map((l: string) => `> ${l}`).join('\n')
          : '> quote';
        break;
      case 'hr':
        insert = '\n---\n';
        break;
      case 'table':
        insert = '\n| Header 1 | Header 2 | Header 3 |\n| --- | --- | --- |\n| Cell 1 | Cell 2 | Cell 3 |\n| Cell 4 | Cell 5 | Cell 6 |\n';
        break;
    }

    const op = {
      identifier: { major: 1, minor: 1 },
      range: selection,
      text: insert,
      forceMoveMarkers: true,
    };
    this.monacoEditor.executeEdits('markdown-toolbar', [op]);

    if (cursorOffset) {
      const pos = this.monacoEditor.getPosition();
      this.monacoEditor.setPosition({
        lineNumber: pos.lineNumber,
        column: pos.column + cursorOffset,
      });
    }

    this.monacoEditor.focus();
  }

  loadTags(): void {
    this.apiService.get<TagResponse[]>('/tags').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (tags) => this.availableTags.set(tags),
      error: () => {
        this.notification.error(this.i18n.t('dev.error.loadTags'));
      },
    });
  }

  loadArticle(id: string): void {
    this.apiService.get<ArticleResponse>(`/admin/articles/${id}`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (article) => {
        this.form.patchValue({
          title: article.title,
          slug: article.slug,
          excerpt: article.excerpt || '',
          content: article.content,
          featuredImageUrl: article.coverImageUrl || '',
          metaTitle: article.title || '',
          metaDescription: article.excerpt || '',
        });
        this.selectedTagIds.set(article.tags?.map((t) => t.id) || []);
        this.originalStatus = article.status || 'DRAFT';
        this.lastSavedContent = JSON.stringify(this.form.getRawValue());
        // Load review history for articles in REVIEW status
        if (article.status === 'REVIEW') {
          this.showReviewPanel.set(true);
          this.loadReviewHistory();
        }
        // Load translations if editing existing article
        this.loadTranslations();
        this.loadAvailableLocales();
        // Sync content to Monaco editor
        if (this.monacoEditor) {
          this.monacoEditor.setValue(article.content || '');
        } else {
          this.pendingContent = article.content || '';
        }
        // Load version history
        setTimeout(() => this.versionHistory()?.loadVersions(), 0);
      },
      error: () => {
        this.notification.error(this.i18n.t('dev.error.loadArticle'));
      },
    });
  }

  onVersionRestored(): void {
    // Reload the article from backend to get restored content
    if (this.articleId) {
      this.apiService.get<ArticleResponse>(`/admin/articles/${this.articleId}`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (article) => {
          this.form.patchValue({
            title: article.title || '',
            slug: article.slug || '',
            excerpt: article.excerpt || '',
            content: article.content || '',
            featuredImageUrl: article.featuredImageUrl || article.coverImageUrl || '',
            metaTitle: article.metaTitle || '',
            metaDescription: article.metaDescription || '',
          });
          // Update Monaco editor if available
          if (this.monacoEditor) {
            this.monacoEditor.setValue(article.content || '');
          }
          this.notification.success(this.i18n.t('dev.versions.articleReloaded'));
        },
        error: () => {
          this.notification.error(this.i18n.t('dev.error.loadArticle'));
        },
      });
    }
  }

  toggleTag(tagId: string): void {
    this.selectedTagIds.update((ids) =>
      ids.includes(tagId) ? ids.filter((id) => id !== tagId) : [...ids, tagId]
    );
  }

  isTagSelected(tagId: string): boolean {
    return this.selectedTagIds().includes(tagId);
  }

  // ===== Image Upload =====

  onCoverImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';

    this.uploadingCoverImage.set(true);
    this.apiService.upload<{ url: string; filename: string }>('/admin/images/upload', file).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.form.controls.featuredImageUrl.setValue(res.url);
        this.uploadingCoverImage.set(false);
        this.notification.success(this.i18n.t('dev.articleForm.imageUploaded'));
      },
      error: () => {
        this.uploadingCoverImage.set(false);
        this.notification.error(this.i18n.t('dev.articleForm.imageUploadError'));
      },
    });
  }

  onContentImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';

    this.uploadingContentImage.set(true);
    this.apiService.upload<{ url: string; filename: string }>('/admin/images/upload', file).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.uploadingContentImage.set(false);
        const altText = file.name.replace(/\.[^.]+$/, '');
        const markdown = `![${altText}](${res.url})`;
        if (this.monacoEditor) {
          const selection = this.monacoEditor.getSelection();
          const op = {
            identifier: { major: 1, minor: 1 },
            range: selection,
            text: markdown,
            forceMoveMarkers: true,
          };
          this.monacoEditor.executeEdits('image-upload', [op]);
          this.monacoEditor.focus();
        } else {
          const current = this.form.controls.content.value;
          this.form.controls.content.setValue(current + '\n' + markdown);
        }
        this.notification.success(this.i18n.t('dev.articleForm.imageUploaded'));
      },
      error: () => {
        this.uploadingContentImage.set(false);
        this.notification.error(this.i18n.t('dev.articleForm.imageUploadError'));
      },
    });
  }

  saveDraft(): void {
    this.save('DRAFT');
  }

  publish(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.save('PUBLISHED');
  }

  schedulePublish(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.save('SCHEDULED');
  }

  minScheduleDate(): string {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5);
    return now.toISOString().slice(0, 16);
  }

  submitForReview(): void {
    if (!this.articleId) return;
    this.saving.set(true);
    this.apiService.post(`/admin/articles/${this.articleId}/submit-review`, {}).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.notification.success(this.i18n.t('dev.articles.submitReviewSuccess'));
        this.router.navigate(['/admin/articles']);
      },
      error: () => {
        this.notification.error(this.i18n.t('dev.articles.submitReviewError'));
        this.saving.set(false);
      },
    });
  }

  approveReview(): void {
    if (!this.articleId) return;
    this.saving.set(true);
    this.apiService.post(`/admin/articles/${this.articleId}/approve-review`, {}).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.notification.success(this.i18n.t('dev.articles.approveReviewSuccess'));
        this.router.navigate(['/admin/articles']);
      },
      error: () => {
        this.notification.error(this.i18n.t('dev.articles.approveReviewError'));
        this.saving.set(false);
      },
    });
  }

  requestChanges(): void {
    if (!this.articleId) return;
    this.saving.set(true);
    this.apiService.post(`/admin/articles/${this.articleId}/request-changes`, { feedback: this.reviewFeedbackText() }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.notification.success(this.i18n.t('dev.articles.requestChangesSuccess'));
        this.router.navigate(['/admin/articles']);
      },
      error: () => {
        this.notification.error(this.i18n.t('dev.articles.requestChangesError'));
        this.saving.set(false);
      },
    });
  }

  loadReviewHistory(): void {
    if (!this.articleId) return;
    this.apiService.get<ArticleReview[]>(`/admin/articles/${this.articleId}/reviews`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (reviews) => this.reviewHistory.set(reviews),
    });
  }

  // ===== Translation Management =====

  loadTranslations(): void {
    if (!this.articleId) return;
    this.apiService.get<ArticleI18nResponse[]>(`/admin/articles/${this.articleId}/translations`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (translations) => this.translations.set(translations),
    });
  }

  loadAvailableLocales(): void {
    if (!this.articleId) return;
    this.apiService.get<string[]>(`/admin/articles/${this.articleId}/translations/locales`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (locales) => this.availableLocales.set(locales),
    });
  }

  translateArticle(targetLang: string): void {
    if (!this.articleId || !targetLang) return;
    this.translating.set(true);
    this.apiService.post<ArticleI18nResponse>(`/admin/articles/${this.articleId}/translate`, {}, { targetLang }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.translating.set(false);
        this.notification.success(this.i18n.t('dev.articles.translationAdded'));
        this.loadTranslations();
        this.loadAvailableLocales();
        this.selectedTranslationLocale.set('');
      },
      error: () => {
        this.translating.set(false);
        this.notification.error(this.i18n.t('dev.articles.translationError'));
      },
    });
  }

  deleteTranslation(locale: string): void {
    if (!this.articleId) return;
    if (!confirm(this.i18n.t('dev.articles.deleteTranslationConfirm', { locale }))) return;
    this.apiService.delete(`/admin/articles/${this.articleId}/translations/${locale}`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.notification.success(this.i18n.t('dev.articles.translationDeleted'));
        this.loadTranslations();
        this.loadAvailableLocales();
      },
      error: () => {
        this.notification.error(this.i18n.t('dev.articles.translationDeleteError'));
      },
    });
  }

  private save(status: 'DRAFT' | 'PUBLISHED' | 'SCHEDULED'): void {
    this.saving.set(true);
    const formValue = this.form.getRawValue();
    const selectedSlugs = this.selectedTagIds()
      .map(id => this.availableTags().find(t => t.id === id)?.slug)
      .filter((s): s is string => !!s);
    const data: ArticleRequest = {
      slug: formValue.slug,
      title: formValue.title,
      content: formValue.content,
      excerpt: formValue.excerpt || undefined,
      coverImageUrl: formValue.featuredImageUrl || undefined,
      status: status as ArticleStatus,
      scheduledAt: status === 'SCHEDULED' && this.scheduledAtControl.value
        ? new Date(this.scheduledAtControl.value).toISOString() : undefined,
      tagSlugs: selectedSlugs,
      seoTitle: formValue.metaTitle || undefined,
      seoDescription: formValue.metaDescription || undefined,
    };

    const request = this.isEditMode()
      ? this.apiService.put(`/admin/articles/${this.articleId}`, data)
      : this.apiService.post('/admin/articles', data);

    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.hasUnsavedChanges = false;
        this.lastSavedContent = JSON.stringify(formValue);
        // I-03: Complete autoSave$ before navigating to prevent race condition
        this.autoSave$.complete();
        this.autoSaveStatus.set(null);
        this.notification.success(
          this.isEditMode() ? this.i18n.t('dev.articleForm.updateSuccess') : this.i18n.t('dev.articleForm.createSuccess')
        );
        this.router.navigate(['/admin/articles']);
      },
      error: () => {
        this.notification.error(this.i18n.t('dev.articleForm.saveError'));
        this.saving.set(false);
      },
    });
  }

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
