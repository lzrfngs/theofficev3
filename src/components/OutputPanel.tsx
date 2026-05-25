import React from 'react';
import type { Agent, ChatMessage } from '../services/coordinator';
import { MarkdownRenderer } from './MarkdownRenderer';

interface OutputPanelProps {
  coordinator: Agent;
  messages: ChatMessage[];
}

export const OutputPanel: React.FC<OutputPanelProps> = ({ coordinator, messages }) => {
  const outputMessages = messages.filter(message => message.role === 'agent');
  const latestOutput = outputMessages.at(-1);
  const sections = latestOutput ? parseOutputSections(latestOutput.text) : [];

  return (
    <section className="output-panel" aria-label="Penny output">
      <div className="output-panel__header">
        <div>
          <div className="output-panel__eyebrow">Manager output</div>
          <h2 className="output-panel__title">{coordinator.name}'s synthesis</h2>
        </div>
        <span className={`badge agent-badge ${coordinator.badgeClass}`}>{outputMessages.length} updates</span>
      </div>

      {latestOutput ? (
        <div className="output-reader">
          <aside className="output-reader__outline" aria-label="Output sections">
            <div className="output-panel__meta">
              <span>{latestOutput.sender}</span>
              <span>{latestOutput.timestamp}</span>
            </div>
            <div className="output-reader__actions">
              <button className="btn btn--secondary btn--sm" type="button" onClick={() => downloadText(latestOutput.text, 'the-office-output.md', 'text/markdown')}>Markdown</button>
              <button className="btn btn--secondary btn--sm" type="button" onClick={() => downloadText(toHtmlDocument(latestOutput.text), 'the-office-output.html', 'text/html')}>HTML</button>
            </div>
            <nav className="output-reader__nav">
              {sections.map(section => (
                <a key={section.id} href={`#${section.id}`}>{section.title}</a>
              ))}
            </nav>
          </aside>

          <div className="output-reader__document">
            <header className="output-reader__hero">
              <div className="output-panel__eyebrow">Strategy artifact</div>
              <h2>{sections[0]?.title || `${coordinator.name}'s synthesis`}</h2>
              <p>Structured synthesis with evidence, assumptions, strategy, creative platform, risks, and next actions.</p>
            </header>

            {sections.map((section, index) => (
              <article key={section.id} id={section.id} className={`output-section ${getSectionClass(section.title)} ${index === 0 ? 'output-section--lead' : ''}`}>
                <div className="output-section__kicker">{getSectionKicker(section.title)}</div>
                <h3>{section.title}</h3>
                <MarkdownRenderer text={section.body || '_No content captured for this section._'} className="output-section__content" />
              </article>
            ))}
          </div>
        </div>
      ) : (
        <div className="output-panel__empty">
          <div className="output-panel__empty-title">No output yet</div>
          <p>Penny's final synthesis will appear here after a workflow runs.</p>
        </div>
      )}
    </section>
  );
};

interface OutputSection {
  id: string;
  title: string;
  body: string;
}

function parseOutputSections(markdown: string): OutputSection[] {
  const matches = [...markdown.matchAll(/^##\s+(.+)$/gm)];
  if (matches.length === 0) {
    return [{ id: 'output-summary', title: 'Output', body: markdown.trim() }];
  }

  return matches.map((match, index) => {
    const title = match[1].trim();
    const start = (match.index ?? 0) + match[0].length;
    const next = matches[index + 1];
    const end = next?.index ?? markdown.length;
    return {
      id: `output-${sanitizeId(title)}`,
      title,
      body: markdown.slice(start, end).trim()
    };
  });
}

function getSectionClass(title: string) {
  const normalized = title.toLowerCase();
  if (/evidence|source|claim/.test(normalized)) return 'output-section--evidence';
  if (/creative|messaging|platform/.test(normalized)) return 'output-section--creative';
  if (/risk|assumption|question|watchout/.test(normalized)) return 'output-section--caution';
  if (/experiment|channel|launch|phase/.test(normalized)) return 'output-section--action';
  return '';
}

function getSectionKicker(title: string) {
  const normalized = title.toLowerCase();
  if (/evidence|source|claim/.test(normalized)) return 'Grounding';
  if (/creative|messaging|platform/.test(normalized)) return 'Creative System';
  if (/risk|assumption|question|watchout/.test(normalized)) return 'Validation';
  if (/experiment|channel|launch|phase/.test(normalized)) return 'Activation';
  return 'Strategy';
}

function sanitizeId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'section';
}

function downloadText(text: string, filename: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function toHtmlDocument(markdown: string) {
  const sections = parseOutputSections(markdown);
  const body = sections.map(section => `<section><h2>${escapeHtml(section.title)}</h2><pre>${escapeHtml(section.body)}</pre></section>`).join('\n');
  return `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8" />\n<meta name="viewport" content="width=device-width, initial-scale=1" />\n<title>The Office Output</title>\n<style>body{font-family:Inter,Arial,sans-serif;line-height:1.5;margin:40px;max-width:920px}section{border-top:1px solid #ddd;padding:24px 0}pre{white-space:pre-wrap;font-family:inherit}</style>\n</head>\n<body>\n${body}\n</body>\n</html>`;
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
