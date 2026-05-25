import React, { useMemo, useState } from 'react';
import { Check, MessageSquarePlus, RefreshCcw, X } from 'lucide-react';
import type { Agent } from '../services/coordinator';
import type { DeliverableSection, ReviewNote, RevisionCandidate } from '../types/workflow';
import { MarkdownRenderer } from './MarkdownRenderer';

interface ReviewPanelProps {
  sections: DeliverableSection[];
  notes: ReviewNote[];
  candidates: RevisionCandidate[];
  agents: Agent[];
  isRunning: boolean;
  onAddNote: (sectionId: string, text: string, agentIds: string[]) => void;
  onRequestRevision: (sectionId: string, noteIds: string[], agentIds: string[]) => void;
  onAcceptCandidate: (candidateId: string) => void;
  onRejectCandidate: (candidateId: string) => void;
  onResolveNote: (noteId: string) => void;
}

export const ReviewPanel: React.FC<ReviewPanelProps> = ({ sections, notes, candidates, agents, isRunning, onAddNote, onRequestRevision, onAcceptCandidate, onRejectCandidate, onResolveNote }) => {
  const [selectedSectionId, setSelectedSectionId] = useState(() => sections[0]?.id ?? '');
  const [noteText, setNoteText] = useState('');
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const selectedSection = sections.find(section => section.id === selectedSectionId) ?? sections[0];
  const sectionNotes = useMemo(() => notes.filter(note => note.sectionId === selectedSection?.id), [notes, selectedSection?.id]);
  const openNotes = sectionNotes.filter(note => note.status === 'open');
  const sectionCandidates = candidates.filter(candidate => candidate.sectionId === selectedSection?.id);
  const specialists = agents.filter(agent => !agent.isCoordinator);

  const toggleAgent = (agentId: string) => {
    setSelectedAgentIds(prev => prev.includes(agentId) ? prev.filter(id => id !== agentId) : [...prev, agentId]);
  };

  const addNote = () => {
    if (!selectedSection || !noteText.trim()) return;
    onAddNote(selectedSection.id, noteText.trim(), selectedAgentIds);
    setNoteText('');
  };

  return (
    <section className="review-panel" aria-label="Review and revisions">
      <div className="review-panel__header">
        <div>
          <div className="review-panel__eyebrow">Revision workshop</div>
          <h2 className="review-panel__title">Review</h2>
          <p className="review-panel__subtitle">Add section notes, assign specialists, request a targeted revision, then accept it back into the artifact.</p>
        </div>
      </div>

      {sections.length === 0 ? (
        <div className="review-panel__empty">Run a workflow first. Review works once the Output has deliverable sections.</div>
      ) : (
        <div className="review-panel__workspace">
          <aside className="review-panel__sections">
            {sections.map(section => (
              <button key={section.id} className={`review-section-tab ${section.id === selectedSection?.id ? 'is-active' : ''}`} type="button" onClick={() => setSelectedSectionId(section.id)}>
                <strong>{section.title}</strong>
                <span>{notes.filter(note => note.sectionId === section.id && note.status === 'open').length} open notes</span>
              </button>
            ))}
          </aside>

          <main className="review-panel__main">
            {selectedSection && (
              <article className="review-document">
                <div className="review-document__header">
                  <div>
                    <div className="review-panel__eyebrow">Selected section</div>
                    <h3>{selectedSection.title}</h3>
                  </div>
                  <button className="btn btn--primary btn--sm" type="button" disabled={isRunning || openNotes.length === 0} onClick={() => onRequestRevision(selectedSection.id, openNotes.map(note => note.id), selectedAgentIds)}>
                    <RefreshCcw size={13} /> Request revision
                  </button>
                </div>
                <MarkdownRenderer text={selectedSection.body || '_No content captured._'} className="review-document__body" />
              </article>
            )}
          </main>

          <aside className="review-panel__notes">
            <section className="review-card">
              <h3>Add note</h3>
              <textarea className="review-textarea" value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="What should change in this section?" />
              <div className="review-agent-grid" aria-label="Assign specialists">
                {specialists.map(agent => (
                  <button key={agent.id} type="button" className={`review-agent-chip ${selectedAgentIds.includes(agent.id) ? 'is-selected' : ''}`} onClick={() => toggleAgent(agent.id)}>
                    {agent.name}
                  </button>
                ))}
              </div>
              <button className="btn btn--secondary btn--sm" type="button" onClick={addNote} disabled={!noteText.trim()}>
                <MessageSquarePlus size={13} /> Add note
              </button>
            </section>

            <section className="review-card">
              <h3>Notes</h3>
              {sectionNotes.length === 0 ? <p>No notes for this section yet.</p> : sectionNotes.map(note => (
                <article key={note.id} className={`review-note review-note--${note.status}`}>
                  <p>{note.text}</p>
                  <span>{note.assignedAgentIds.length > 0 ? note.assignedAgentIds.map(id => agents.find(agent => agent.id === id)?.name || id).join(', ') : 'Unassigned'}</span>
                  {note.status === 'open' && <button className="btn btn--secondary btn--sm" type="button" onClick={() => onResolveNote(note.id)}>Resolve</button>}
                </article>
              ))}
            </section>

            <section className="review-card">
              <h3>Revision candidates</h3>
              {sectionCandidates.length === 0 ? <p>No revisions proposed yet.</p> : sectionCandidates.map(candidate => (
                <article key={candidate.id} className={`revision-candidate revision-candidate--${candidate.status}`}>
                  <MarkdownRenderer text={candidate.revisedBody} />
                  <p>{candidate.rationale}</p>
                  <div className="review-actions">
                    <button className="btn btn--primary btn--sm" type="button" onClick={() => onAcceptCandidate(candidate.id)} disabled={candidate.status === 'accepted'}><Check size={13} /> Accept</button>
                    <button className="btn btn--secondary btn--sm" type="button" onClick={() => onRejectCandidate(candidate.id)} disabled={candidate.status === 'rejected'}><X size={13} /> Reject</button>
                  </div>
                </article>
              ))}
            </section>
          </aside>
        </div>
      )}
    </section>
  );
};
