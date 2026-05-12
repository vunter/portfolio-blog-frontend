import { I18nService } from '../../../../../core/services/i18n.service';

export function getDefaultHtmlTemplate(i18n: I18nService): string {
  const lang = i18n.language() === 'en' ? 'en' : i18n.language();
  const htmlLang = lang === 'pt' ? 'pt-BR' : lang;

  return `<!DOCTYPE html>
<html lang="${htmlLang}">
<head>
  <meta charset="UTF-8">
  <title>${i18n.t('resume.editor.defaultTitle')} - {{name}}</title>
</head>
<body>
  <header class="header">
    <h1>{{name}}</h1>
    <p class="subtitle">{{title}}</p>
    <div class="contact-info">
      <span>{{email}}</span>
      <span>{{phone}}</span>
      <span>{{location}}</span>
    </div>
  </header>

  <section class="summary">
    <h2>${i18n.t('resume.editor.defaultSummary')}</h2>
    <p>{{summary}}</p>
  </section>

  <section class="experience">
    <h2>${i18n.t('resume.editor.defaultExperience')}</h2>
  </section>

  <section class="education">
    <h2>${i18n.t('resume.editor.defaultEducation')}</h2>
  </section>

  <section class="skills">
    <h2>${i18n.t('resume.editor.defaultSkills')}</h2>
  </section>
</body>
</html>`;
}

export function getDefaultCssTemplate(i18n: I18nService): string {
  return `/* ${i18n.t('resume.editor.defaultCssComment')} */
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  line-height: 1.6;
  color: #333;
  padding: 2rem;
  max-width: 800px;
  margin: 0 auto;
}

.header {
  text-align: center;
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 2px solid #3b82f6;
}

.header h1 {
  font-size: 2.5rem;
  color: #1e40af;
  margin-bottom: 0.25rem;
}

.subtitle {
  font-size: 1.25rem;
  color: #6b7280;
  margin-bottom: 1rem;
}

.contact-info {
  display: flex;
  justify-content: center;
  gap: 1.5rem;
  flex-wrap: wrap;
  color: #6b7280;
  font-size: 0.9rem;
}

section { margin-bottom: 1.5rem; }

h2 {
  color: #1e40af;
  font-size: 1.25rem;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 0.5rem;
  margin-bottom: 1rem;
}

.summary p { text-align: justify; }`;
}
