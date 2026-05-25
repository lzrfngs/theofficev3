import React, { useRef, useEffect, useState } from 'react';
import { Send, Eye, X, Loader2, Edit } from 'lucide-react';
import type { Agent, ChatMessage } from '../services/coordinator';
import { MarkdownRenderer } from './MarkdownRenderer';

interface AgentPanelProps {
  agent: Agent;
  messages: ChatMessage[];
  isThinking: boolean;
  onSendMessage?: (text: string) => void;
  isActive: boolean;
  isCoordinating?: boolean;
  onEditPortrait?: () => void;
}

export const AgentPanel: React.FC<AgentPanelProps> = ({
  agent,
  messages,
  isThinking,
  onSendMessage,
  isActive,
  isCoordinating = false,
  onEditPortrait
}) => {
  const [inputValue, setInputValue] = useState('');
  const [showInspector, setShowInspector] = useState(false);
  const chatHistoryRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat when messages change
  useEffect(() => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTo({
        top: chatHistoryRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isThinking]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !onSendMessage) return;
    onSendMessage(inputValue.trim());
    setInputValue('');
  };

  // Get initials for placeholder avatar
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('');
  };

  const isCoordinator = !!onSendMessage;

  return (
    <div className={`agent-card glass-panel ${agent.badgeClass} ${isActive ? agent.activeClass : ''}`}>
      {/* Agent Card Header */}
      {isCoordinator ? (
        <div className="agent-header-vertical">
          <div className="portrait-container-full">
            {agent.avatar ? (
              <img src={agent.avatar} alt={agent.name} className="portrait-img-full" />
            ) : (
              <div className="portrait-placeholder-full portrait-placeholder--agent">
                {getInitials(agent.name)}
              </div>
            )}
          </div>

          <div className="agent-meta-vertical flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="agent-name block text-lg font-serif font-medium leading-tight">{agent.name}</span>
              <span className="agent-title block text-xs text-slate-400 leading-normal">{agent.title}</span>
            </div>

            <div className="flex items-center justify-between border-t border-slate-800/40 pt-2.5">
              <span className={`badge agent-badge ${agent.badgeClass}`}>
                {isThinking || isCoordinating ? (
                  <Loader2 className="agent-badge__spinner animate-spin flex-shrink-0" size={10} />
                ) : (
                  <span className={`status-indicator ${isActive ? 'status-active' : 'status-idle'}`} />
                )}
                {isThinking ? 'thinking' : isCoordinating ? 'coordinating' : isActive ? 'active' : 'idle'}
              </span>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                {onEditPortrait && (
                  <button
                    className="btn btn--secondary btn--icon agent-header__icon-button"
                    onClick={onEditPortrait}
                    title="Change Portrait / Local Image"
                    aria-label="Change portrait or local image"
                  >
                    <Edit size={13} />
                  </button>
                )}
                <button
                  className="btn btn--secondary btn--icon agent-header__icon-button"
                  onClick={() => setShowInspector(!showInspector)}
                  title="Inspect Agent System Prompt"
                  aria-label="Inspect agent system prompt"
                >
                  <Eye size={13} />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="agent-header">
          <div className="portrait-container portrait-small">
            {agent.avatar ? (
              <img src={agent.avatar} alt={agent.name} className="portrait-img" />
            ) : (
              <div className="portrait-placeholder portrait-placeholder--agent">
                {getInitials(agent.name)}
              </div>
            )}
          </div>

          <div className="agent-meta">
            <div className="flex items-center justify-between">
              <span className="agent-name">{agent.name}</span>
            </div>
            <span className="agent-title">{agent.title}</span>
            <span className={`badge agent-badge ${agent.badgeClass}`}>
              {isThinking || isCoordinating ? (
                <Loader2 className="agent-badge__spinner animate-spin flex-shrink-0" size={10} />
              ) : (
                <span className={`status-indicator ${isActive ? 'status-active' : 'status-idle'}`} />
              )}
              {isThinking ? 'thinking' : isCoordinating ? 'coordinating' : isActive ? 'active' : 'idle'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {onEditPortrait && (
              <button
                className="btn btn--secondary btn--icon agent-header__icon-button"
                onClick={onEditPortrait}
                title="Change Portrait / Local Image"
                aria-label="Change portrait or local image"
              >
                <Edit size={13} />
              </button>
            )}
            <button
              className="btn btn--secondary btn--icon agent-header__icon-button"
              onClick={() => setShowInspector(!showInspector)}
              title="Inspect Agent System Prompt"
              aria-label="Inspect agent system prompt"
            >
              <Eye size={13} />
            </button>
          </div>
        </div>
      )}

      {/* System Prompt / Training Inspector */}
      {showInspector && (
        <div className="inspector-popup glass-panel border border-slate-700/60 shadow-2xl">
          <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-800">
            <h4 className="inspector-title font-semibold text-slate-200">
              Training Profile: {agent.name}
            </h4>
            <button className="inspector-close" onClick={() => setShowInspector(false)} title="Close inspector" aria-label="Close inspector">
              <X size={16} />
            </button>
          </div>
          <div className="inspector-body text-xs text-slate-400 overflow-y-auto leading-relaxed select-text">
            <MarkdownRenderer text={agent.systemPrompt || 'Loading profile instructions...'} />
          </div>
        </div>
      )}

      {/* Chat Area */}
      <div className="chat-console">
        <div className="chat-history" ref={chatHistoryRef}>
          {messages.length === 0 && !agent.isCoordinator && !isThinking && (
            <div className="flex-grow flex items-center justify-center text-slate-500 h-full py-6 select-none">
              <span className="text-[11px] font-mono tracking-wider uppercase opacity-40">Awaiting coordinator command...</span>
            </div>
          )}
          
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`chat-message ${msg.role === 'user' ? 'message-user' : 'message-agent'}`}
            >
              <div className="message-sender">
                <span>{msg.sender}</span>
                <span className="message-time">{msg.timestamp}</span>
              </div>
              <div className={`message-bubble ${msg.role === 'thought' ? 'message-thought' : ''} select-text`}>
                <MarkdownRenderer text={msg.text} />
              </div>
            </div>
          ))}

          {isThinking && (
            <div className="chat-message message-agent">
              <div className="message-sender">
                <span>{agent.name} is drafting response...</span>
              </div>
              <div className="message-bubble bg-slate-900/40 border border-slate-800/80 rounded-lg">
                <div className="typing-indicator">
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Bar (Only render for the coordinator) */}
        {onSendMessage && (
          <form onSubmit={handleSubmit} className="chat-input-bar">
            <input
              type="text"
              className="input chat-input"
              placeholder="Give Penny a task..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={isThinking}
            />
            <button type="submit" className="btn btn--primary btn--icon chat-send-btn" disabled={!inputValue.trim() || isThinking} title="Send task to Penny" aria-label="Send task to Penny">
              {isThinking ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
