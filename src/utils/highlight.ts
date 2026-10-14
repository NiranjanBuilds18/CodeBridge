import Prism from 'prismjs';
import 'prismjs/components/prism-javascript.js';
import 'prismjs/components/prism-typescript.js';
import 'prismjs/components/prism-python.js';
import 'prismjs/components/prism-json.js';
import 'prismjs/components/prism-sql.js';
import 'prismjs/components/prism-bash.js';
import 'prismjs/components/prism-markdown.js';
import 'prismjs/components/prism-css.js';

export function highlightCode(code: string, language?: string): string {
  const lang = (language || '').toLowerCase();
  let grammar = Prism.languages.javascript;

  if (['ts', 'typescript'].includes(lang)) {
    grammar = Prism.languages.typescript || Prism.languages.javascript;
  } else if (['python', 'py'].includes(lang)) {
    grammar = Prism.languages.python || Prism.languages.javascript;
  } else if (['json'].includes(lang)) {
    grammar = Prism.languages.json || Prism.languages.javascript;
  } else if (['sql'].includes(lang)) {
    grammar = Prism.languages.sql || Prism.languages.javascript;
  } else if (['bash', 'sh', 'shell'].includes(lang)) {
    grammar = Prism.languages.bash || Prism.languages.javascript;
  } else if (['markdown', 'md'].includes(lang)) {
    grammar = Prism.languages.markdown || Prism.languages.javascript;
  } else if (['css'].includes(lang)) {
    grammar = Prism.languages.css || Prism.languages.javascript;
  } else if (['html', 'xml'].includes(lang)) {
    grammar = Prism.languages.html || Prism.languages.javascript;
  }

  try {
    return Prism.highlight(code, grammar, lang);
  } catch {
    // Fallback escape
    return code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
