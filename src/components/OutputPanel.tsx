import React from 'react';
import type { Agent, ChatMessage } from '../services/coordinator';

interface OutputPanelProps {
  coordinator: Agent;
  messages: ChatMessage[];
}

export const OutputPanel: React.FC<OutputPanelProps> = ({ coordinator, messages }) => {
  const outputMessages = messages.filter(message => message.role === 'agent');
  const latestOutput = outputMessages.at(-1);

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
        <div className="output-panel__body">
          <div className="output-panel__meta">
            <span>{latestOutput.sender}</span>
            <span>{latestOutput.timestamp}</span>
          </div>
          <div className="output-panel__text">{latestOutput.text}</div>
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
