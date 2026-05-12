const LOCALE_TEXTS: Record<string, Record<string, string>> = {
  en: { sectionTitle: 'Section Title', content: 'Content here...', jobTitle: 'Job Title', company: 'Company', period: 'Jan 2020 - Present', achievement: 'Achievement or responsibility', courseName: 'Course Name', institution: 'Educational Institution', category: 'Category', skill1: 'Skill 1', skill2: 'Skill 2' },
  pt: { sectionTitle: 'Título da Seção', content: 'Conteúdo aqui...', jobTitle: 'Cargo', company: 'Empresa', period: 'Jan 2020 - Presente', achievement: 'Responsabilidade ou conquista', courseName: 'Nome do Curso', institution: 'Instituição de Ensino', category: 'Categoria', skill1: 'Habilidade 1', skill2: 'Habilidade 2' },
  es: { sectionTitle: 'Título de Sección', content: 'Contenido aquí...', jobTitle: 'Puesto', company: 'Empresa', period: 'Ene 2020 - Presente', achievement: 'Logro o responsabilidad', courseName: 'Nombre del Curso', institution: 'Institución Educativa', category: 'Categoría', skill1: 'Habilidad 1', skill2: 'Habilidad 2' },
  it: { sectionTitle: 'Titolo della Sezione', content: 'Contenuto qui...', jobTitle: 'Posizione', company: 'Azienda', period: 'Gen 2020 - Presente', achievement: 'Responsabilità o risultato', courseName: 'Nome del Corso', institution: 'Istituto di Formazione', category: 'Categoria', skill1: 'Competenza 1', skill2: 'Competenza 2' },
};

export function getSnippet(type: string, lang: string): string | null {
  const txt = LOCALE_TEXTS[lang] || LOCALE_TEXTS['en'];

  const snippets: Record<string, string> = {
    header: `<header class="header">
  <h1>{{name}}</h1>
  <p class="subtitle">{{title}}</p>
  <div class="contact-info">
    <span>{{email}}</span>
    <span>{{phone}}</span>
    <span>{{location}}</span>
  </div>
</header>`,
    section: `<section class="section">
  <h2>${txt['sectionTitle']}</h2>
  <p>${txt['content']}</p>
</section>`,
    experience: `<div class="experience-item">
  <div class="job-header">
    <h3>${txt['jobTitle']}</h3>
    <span class="company">${txt['company']}</span>
    <span class="period">${txt['period']}</span>
  </div>
  <ul>
    <li>${txt['achievement']}</li>
  </ul>
</div>`,
    education: `<div class="education-item">
  <h3>${txt['courseName']}</h3>
  <span class="institution">${txt['institution']}</span>
  <span class="year">2020</span>
</div>`,
    skills: `<div class="skills-grid">
  <div class="skill-category">
    <h4>${txt['category']}</h4>
    <ul>
      <li>${txt['skill1']}</li>
      <li>${txt['skill2']}</li>
    </ul>
  </div>
</div>`,
  };

  return snippets[type] ?? null;
}
