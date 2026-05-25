import React, { useState } from 'react';
import type { SourceRecord } from '../types/workflow';

interface SourcesPanelProps {
  sources: SourceRecord[];
  onAddSource: (source: Omit<SourceRecord, 'id' | 'timestamp' | 'provider'>) => void;
  onClearSources: () => void;
}

export const SourcesPanel: React.FC<SourcesPanelProps> = ({ sources, onAddSource, onClearSources }) => {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [snippet, setSnippet] = useState('');

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() && !url.trim() && !snippet.trim()) return;
    onAddSource({
      title: title.trim() || url.trim() || 'Manual source',
      url: url.trim(),
      snippet: snippet.trim(),
      query: 'manual entry',
      usedBy: 'User'
    });
    setTitle('');
    setUrl('');
    setSnippet('');
  };

  return (
    <section className="sources-panel" aria-label="Workflow sources">
      <div className="sources-panel__header">
        <div>
          <div className="sources-panel__eyebrow">Evidence</div>
          <h2 className="sources-panel__title">Sources</h2>
        </div>
        <button className="btn btn--secondary btn--sm" type="button" onClick={onClearSources} disabled={sources.length === 0}>Clear sources</button>
      </div>

      <form className="sources-panel__form" onSubmit={handleSubmit}>
        <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Source title" aria-label="Source title" />
        <input className="input" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="URL" aria-label="Source URL" />
        <textarea className="sources-panel__textarea" value={snippet} onChange={(event) => setSnippet(event.target.value)} placeholder="Notes, excerpt, or why this matters" aria-label="Source notes" />
        <button className="btn btn--primary btn--sm" type="submit">Add source</button>
      </form>

      <div className="sources-panel__list">
        {sources.length === 0 ? (
          <div className="sources-panel__empty">Mira's web results and your manual sources will appear here.</div>
        ) : (
          sources.map(source => (
            <article key={source.id} className="source-card">
              <div className="source-card__meta">
                <span>{source.provider}</span>
                {source.category && <span>{source.category}</span>}
                {source.publishedDate && <span>{source.publishedDate}</span>}
                {source.usedBy && <span>{source.usedBy}</span>}
                {source.query && <span>{source.query}</span>}
              </div>
              <h3 className="source-card__title">
                {source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a> : source.title}
              </h3>
              {source.snippet && <p className="source-card__snippet">{source.snippet}</p>}
            </article>
          ))
        )}
      </div>
    </section>
  );
};
