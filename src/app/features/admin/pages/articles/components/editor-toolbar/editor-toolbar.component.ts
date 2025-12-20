import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-editor-toolbar',
  imports: [],
  templateUrl: './editor-toolbar.component.html',
  styleUrl: './editor-toolbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorToolbarComponent {
  uploadingContentImage = input<boolean>(false);

  markdownInsert = output<string>();
  contentImageSelected = output<Event>();

  onInsert(type: string): void {
    this.markdownInsert.emit(type);
  }

  onFileSelected(event: Event): void {
    this.contentImageSelected.emit(event);
  }
}
