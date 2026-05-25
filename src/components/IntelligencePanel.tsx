import React, { useMemo, useState } from 'react';
import { Activity, Brain, CheckCircle2, Database, ListChecks, Search, Wrench } from 'lucide-react';
import type { EvidenceClaim, ExecutionTraceRecord, KnowledgeItem, RunState } from '../types/workflow';

interface IntelligencePanelProps {
  runState?: RunState | null;
  evidenceClaims: EvidenceClaim[];
  knowledgeItems: KnowledgeItem[];
  traces: ExecutionTraceRecord[];
  onClear: () => void;
  onRateRun: (rating: number) => void;
}

type IntelligenceTab = 'state' | 'knowledge' | 'trace' | 'eval';

export const IntelligencePanel: React.FC<IntelligencePanelProps> = ({ runState, evidenceClaims, knowledgeItems, traces, onClear, onRateRun }) => {
  const [tab, setTab] = useState<IntelligenceTab>('state');
  const latestEvaluation = runState?.evaluations.at(-1);
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
