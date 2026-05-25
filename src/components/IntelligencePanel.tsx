import React, { useMemo, useState } from 'react';
import { Activity, Brain, CheckCircle2, Database, ListChecks, Search, Wrench } from 'lucide-react';
import type { ClaimStatus, EvidenceClaim, ExecutionTraceRecord, KnowledgeItem, RunState } from '../types/workflow';

interface IntelligencePanelProps {
  runState?: RunState | null;
  evidenceClaims: EvidenceClaim[];
  knowledgeItems: KnowledgeItem[];
  traces: ExecutionTraceRecord[];
  onClear: () => void;
  onRateRun: (rating: number) => void;
  onResearchEvidence: () => void;
  onChallengeOutput: () => void;
  onRefineSection: (sectionId: string) => void;
  onSetClaimStatus: (claimId: string, status: ClaimStatus) => void;
  onResearchClaim: (claimId: string) => void;
  onChallengeClaim: (claimId: string) => void;
}

type IntelligenceTab = 'state' | 'knowledge' | 'trace' | 'eval';

export const IntelligencePanel: React.FC<IntelligencePanelProps> = ({ runState, evidenceClaims, knowledgeItems, traces, onClear, onRateRun, onResearchEvidence, onChallengeOutput, onRefineSection, onSetClaimStatus, onResearchClaim, onChallengeClaim }) => {
  const [tab, setTab] = useState<IntelligenceTab>('state');
  const latestEvaluation = runState?.evaluations.at(-1);
  const evidencePolicy = runState?.evidencePolicy ?? { required: false, status: 'not-required' as const, reasons: [], requiredToolIds: [] };
  const factualClaims = runState?.factualClaims ?? [];
  const researchBrief = runState?.researchBrief;
  const deliverableSections = runState?.deliverableSections ?? [];
  const counts = useMemo(() => ({
    evidence: evidenceClaims.length,
    knowledge: knowledgeItems.length,
    traces: traces.length,
    tools: runState?.toolCalls.length ?? 0
  }), [evidenceClaims.length, knowledgeItems.length, runState?.toolCalls.length, traces.length]);

  return (
    <section className="intelligence-panel" aria-label="Run intelligence state">
      <div className="intelligence-panel__header">
        <div>
          <div className="intelligence-panel__eyebrow">Runtime</div>
          <h2 className="intelligence-panel__title">Intelligence State</h2>
        </div>
        <button className="btn btn--secondary btn--sm" type="button" onClick={onClear}>Clear state</button>
      </div>

      <div className="intelligence-panel__tabs" aria-label="Runtime state sections">
        <button className={`intelligence-panel__tab ${tab === 'state' ? 'is-active' : ''}`} type="button" onClick={() => setTab('state')}><Brain size={13} /> State</button>
        <button className={`intelligence-panel__tab ${tab === 'knowledge' ? 'is-active' : ''}`} type="button" onClick={() => setTab('knowledge')}><Database size={13} /> Knowledge</button>
        <button className={`intelligence-panel__tab ${tab === 'trace' ? 'is-active' : ''}`} type="button" onClick={() => setTab('trace')}><Activity size={13} /> Trace</button>
        <button className={`intelligence-panel__tab ${tab === 'eval' ? 'is-active' : ''}`} type="button" onClick={() => setTab('eval')}><ListChecks size={13} /> Eval</button>
      </div>

      {!runState ? (
        <div className="intelligence-panel__empty">Run state, tool calls, traces, evidence, and evaluations will appear here after Penny starts a workflow.</div>
      ) : tab === 'state' ? (
        <div className="intelligence-panel__grid">
          <Metric label="Status" value={runState.status} />
          <Metric label="Confidence" value={runState.confidence} />
          <Metric label="Evidence" value={counts.evidence.toString()} />
          <Metric label="Tool calls" value={counts.tools.toString()} />
          <section className="intelligence-card intelligence-card--wide">
            <h3>Objective</h3>
            <p>{runState.objective}</p>
          </section>
          <section className="intelligence-card intelligence-card--wide">
            <h3>Evidence Policy</h3>
            <p>{evidencePolicy.required ? `Required: ${evidencePolicy.status}` : 'Not required'}</p>
            {evidencePolicy.reasons.length > 0 && (
              <ul>
                {evidencePolicy.reasons.map((reason, index) => <li key={`policy-${index}`}>{reason}</li>)}
              </ul>
            )}
            <div className="rating-row">
              <button className="btn btn--secondary btn--sm" type="button" onClick={onResearchEvidence} disabled={!evidencePolicy.required}>Research evidence</button>
              <button className="btn btn--secondary btn--sm" type="button" onClick={onChallengeOutput}>Challenge output</button>
            </div>
          </section>
          <section className="intelligence-card intelligence-card--wide">
            <h3>Factual Claims</h3>
            {factualClaims.length === 0 ? <p>No factual claims extracted.</p> : factualClaims.map(claim => (
              <article key={claim.id} className="knowledge-row">
                <Search size={13} />
                <div>
                  <strong>{claim.status} · {claim.confidence}</strong>
                  <span>{claim.text}</span>
                  {claim.matches && claim.matches.length > 0 && (
                    <small>{claim.matches.length} source matches · best score {claim.matches[0].score}/1</small>
                  )}
                  <div className="claim-actions">
                    <button className="btn btn--secondary btn--sm" type="button" onClick={() => onSetClaimStatus(claim.id, 'supported')}>Accept</button>
                    <button className="btn btn--secondary btn--sm" type="button" onClick={() => onSetClaimStatus(claim.id, 'assumption')}>Assume</button>
                    <button className="btn btn--secondary btn--sm" type="button" onClick={() => onSetClaimStatus(claim.id, 'unverified')}>Reject</button>
                    <button className="btn btn--secondary btn--sm" type="button" onClick={() => onResearchClaim(claim.id)}>Research</button>
                    <button className="btn btn--secondary btn--sm" type="button" onClick={() => onChallengeClaim(claim.id)}>Challenge</button>
                  </div>
                </div>
              </article>
            ))}
          </section>
          {researchBrief && (
            <section className="intelligence-card intelligence-card--wide">
              <h3>Research Brief</h3>
              <p>{researchBrief.sourceIds.length} sources from {researchBrief.queries.length} searches.</p>
              <StateList title="Current / News Signals" items={researchBrief.currentSignals} />
              <StateList title="Forecast Signals" items={researchBrief.forecastSignals} />
              <StateList title="Competitive Signals" items={researchBrief.competitiveSignals} />
              <StateList title="Caveats" items={researchBrief.caveats} />
            </section>
          )}
          {runState.scorecard && (
            <section className="intelligence-card intelligence-card--wide">
              <h3>Evaluation Scorecard</h3>
              <div className="score-grid">
                {Object.entries(runState.scorecard).filter(([key]) => key !== 'notes').map(([key, value]) => (
                  <div key={key} className="score-pill">
                    <span>{formatScoreLabel(key)}</span>
                    <strong>{typeof value === 'number' ? `${value}/10` : ''}</strong>
                  </div>
                ))}
              </div>
              <StateList title="Score Notes" items={runState.scorecard.notes} />
            </section>
          )}
          {deliverableSections.length > 0 && (
            <section className="intelligence-card intelligence-card--wide">
              <h3>Deliverable Sections</h3>
              {deliverableSections.map(section => (
                <article key={section.id} className="section-row">
                  <div>
                    <strong>{section.title}</strong>
                    <span>{section.status} · {section.sourceIds.length} linked sources</span>
                  </div>
                  <button className="btn btn--secondary btn--sm" type="button" onClick={() => onRefineSection(section.id)}>Refine</button>
                </article>
              ))}
            </section>
          )}
          <StateList title="Assumptions" items={runState.assumptions} />
          <StateList title="Open Questions" items={runState.openQuestions} />
          <StateList title="Decisions" items={runState.decisions} />
          <StateList title="Risks" items={runState.risks} />
          <StateList title="Conflicts" items={runState.conflicts} />
          <section className="intelligence-card intelligence-card--wide">
            <h3>Tool Calls</h3>
            {runState.toolCalls.length === 0 ? <p>No tools used yet.</p> : runState.toolCalls.map(call => (
              <article key={call.id} className="runtime-row">
                <Wrench size={13} />
                <div>
                  <strong>{call.toolName}</strong>
                  <span>{call.requestedBy} · {call.status} · {call.outputSummary || call.input}</span>
                </div>
              </article>
            ))}
          </section>
          {runState.projectLibrary && (
            <section className="intelligence-card intelligence-card--wide">
              <h3>Project Memory</h3>
              <p>{runState.projectLibrary.sources.length} saved sources · {runState.projectLibrary.acceptedClaims.length} accepted claims · {runState.projectLibrary.memories.length} memory snapshot</p>
            </section>
          )}
        </div>
      ) : tab === 'knowledge' ? (
        <div className="intelligence-list">
          <section className="intelligence-card">
            <h3>Evidence Claims</h3>
            {evidenceClaims.length === 0 ? <p>No evidence claims captured yet.</p> : evidenceClaims.map(claim => (
              <article key={claim.id} className="knowledge-row">
                <Search size={13} />
                <div>
                  <strong>{claim.confidence} confidence</strong>
                  <span>{claim.claim}</span>
                </div>
              </article>
            ))}
          </section>
          <section className="intelligence-card">
            <h3>Knowledge Items</h3>
            {knowledgeItems.length === 0 ? <p>No knowledge saved yet.</p> : knowledgeItems.map(item => (
              <article key={item.id} className="knowledge-row">
                <Database size={13} />
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.body}</span>
                </div>
              </article>
            ))}
          </section>
        </div>
      ) : tab === 'trace' ? (
        <div className="trace-list">
          {traces.length === 0 ? <div className="intelligence-panel__empty">No trace events yet.</div> : traces.map(trace => (
            <article key={trace.id} className="trace-row">
              <span className={`trace-row__type trace-row__type--${trace.type}`}>{trace.type}</span>
              <div>
                <strong>{trace.title}</strong>
                <p>{trace.detail}</p>
                <time>{new Date(trace.timestamp).toLocaleString()}</time>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="intelligence-panel__grid">
          <section className="intelligence-card intelligence-card--wide">
            <h3>Penny Evaluation</h3>
            {latestEvaluation ? (
              <>
                <p>{latestEvaluation.summary}</p>
                <StateList title="Gaps" items={latestEvaluation.gaps} />
                <StateList title="Next Actions" items={latestEvaluation.nextActions} />
              </>
            ) : <p>No evaluation yet.</p>}
          </section>
          <section className="intelligence-card intelligence-card--wide">
            <h3>User Rating</h3>
            <div className="rating-row" aria-label="Rate latest run">
              {[1, 2, 3, 4, 5].map(rating => (
                <button key={rating} className="btn btn--secondary btn--sm" type="button" onClick={() => onRateRun(rating)}>
                  <CheckCircle2 size={13} /> {rating}
                </button>
              ))}
            </div>
          </section>
          <section className="intelligence-card intelligence-card--wide">
            <h3>Repair Actions</h3>
            <div className="rating-row">
              <button className="btn btn--secondary btn--sm" type="button" onClick={onResearchEvidence}>Research missing evidence</button>
              <button className="btn btn--secondary btn--sm" type="button" onClick={onChallengeOutput}>Challenge recommendations</button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
};

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <section className="intelligence-card intelligence-card--metric">
    <span>{label}</span>
    <strong>{value}</strong>
  </section>
);

function formatScoreLabel(value: string) {
  return value.replace(/([A-Z])/g, ' $1').replace(/^./, character => character.toUpperCase());
}

const StateList: React.FC<{ title: string; items: string[] }> = ({ title, items }) => (
  <section className="intelligence-card">
    <h3>{title}</h3>
    {items.length === 0 ? <p>None captured.</p> : (
      <ul>
        {items.map((item, index) => <li key={`${title}-${index}`}>{item}</li>)}
      </ul>
    )}
  </section>
);
