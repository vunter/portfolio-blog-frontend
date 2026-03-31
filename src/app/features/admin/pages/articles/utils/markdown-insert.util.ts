/**
 * Q8.1: Extracted from ArticleFormComponent to reduce file size.
 * Pure utility for inserting markdown syntax into Monaco editor.
 */

interface InsertResult {
  text: string;
  cursorOffset: number;
}

export function getMarkdownInsert(type: string, selectedText: string): InsertResult {
  let text = '';
  let cursorOffset = 0;

  switch (type) {
    case 'bold':
      text = `**${selectedText || 'bold text'}**`;
      if (!selectedText) cursorOffset = -2;
      break;
    case 'italic':
      text = `*${selectedText || 'italic text'}*`;
      if (!selectedText) cursorOffset = -1;
      break;
    case 'strikethrough':
      text = `~~${selectedText || 'text'}~~`;
      if (!selectedText) cursorOffset = -2;
      break;
    case 'h1':
      text = `# ${selectedText || 'Heading 1'}`;
      break;
    case 'h2':
      text = `## ${selectedText || 'Heading 2'}`;
      break;
    case 'h3':
      text = `### ${selectedText || 'Heading 3'}`;
      break;
    case 'ul':
      text = selectedText
        ? selectedText.split('\n').map((l: string) => `- ${l}`).join('\n')
        : '- Item 1\n- Item 2\n- Item 3';
      break;
    case 'ol':
      text = selectedText
        ? selectedText.split('\n').map((l: string, i: number) => `${i + 1}. ${l}`).join('\n')
        : '1. Item 1\n2. Item 2\n3. Item 3';
      break;
    case 'checklist':
      text = selectedText
        ? selectedText.split('\n').map((l: string) => `- [ ] ${l}`).join('\n')
        : '- [ ] Task 1\n- [ ] Task 2\n- [x] Task 3';
      break;
    case 'link':
      text = selectedText ? `[${selectedText}](url)` : '[link text](url)';
      break;
    case 'image':
      text = selectedText ? `![${selectedText}](url)` : '![alt text](image-url)';
      break;
    case 'code':
      text = `\`${selectedText || 'code'}\``;
      if (!selectedText) cursorOffset = -1;
      break;
    case 'codeblock':
      text = `\n\`\`\`\n${selectedText || 'code here'}\n\`\`\`\n`;
      break;
    case 'quote':
      text = selectedText
        ? selectedText.split('\n').map((l: string) => `> ${l}`).join('\n')
        : '> quote';
      break;
    case 'hr':
      text = '\n---\n';
      break;
    case 'table':
      text = '\n| Header 1 | Header 2 | Header 3 |\n| --- | --- | --- |\n| Cell 1 | Cell 2 | Cell 3 |\n| Cell 4 | Cell 5 | Cell 6 |\n';
      break;
  }

  return { text, cursorOffset };
}
