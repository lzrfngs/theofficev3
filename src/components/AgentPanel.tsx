import React, { useRef, useEffect, useState } from 'react';
import { Send, Eye, X, Loader2, Edit } from 'lucide-react';
import type { Agent, ChatMessage } from '../services/coordinator';

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

  // Simple regex markdown parser for beautiful rendering
  const renderMarkdown = (text: string) => {
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Italic
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Headers
    html = html.replace(/^### (.*?)$/gm, '<h4 class="text-md font-semibold mt-3 mb-1 text-slate-100">$1</h4>');
    html = html.replace(/^## (.*?)$/gm, '<h3 class="text-lg font-semibold mt-4 mb-2 text-slate-100">$1</h3>');
    html = html.replace(/^# (.*?)$/gm, '<h2 class="text-xl font-bold mt-4 mb-2 text-slate-100">$1</h2>');
    
    // Blockquotes
    html = html.replace(/^&gt; (.*?)$/gm, '<blockquote class="border-l-4 border-slate-500 pl-3 my-2 text-slate-400 italic bg-slate-900/50 py-1 pr-2 rounded-r">$1</blockquote>');
    
    // Code block
    html = html.replace(/```(.*?)\n([\s\S]*?)```/g, '<pre class="bg-slate-950 p-3 rounded-lg overflow-x-auto my-2 border border-slate-800 font-mono text-xs text-emerald-400"><code class="language-$1">$2</code></pre>');
    
    // Inline code
    html = html.replace(/`(.*?)`/g, '<code class="bg-slate-900 px-1 py-0.5 rounded text-rose-400 font-mono text-xs">$1</code>');
    
    // Tables (Simple conversion for Vivienne's SWOT matrices)
    if (html.includes('|')) {
      const lines = html.split('\n');
      let inTable = false;
      let tableHtml = '<div class="overflow-x-auto my-3"><table class="min-w-full divide-y divide-slate-800 border border-slate-800 text-xs text-left">';
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('|') && line.endsWith('|')) {
          if (!inTable) {
            inTable = true;
            tableHtml += '<tbody class="divide-y divide-slate-800 bg-slate-900/20">';
          }
          
          // Skip divider lines like |---|---|
          if (line.includes('---')) continue;
          
          const cells = line.split('|').filter(c => c.length > 0);
          tableHtml += '<tr class="hover:bg-slate-800/30">';
          cells.forEach((cell) => {
            tableHtml += `<td class="px-3 py-2 text-slate-300 font-normal border-r border-slate-800 last:border-0">${cell.trim()}</td>`;
          });
          tableHtml += '</tr>';
        } else {
          if (inTable) {
            inTable = false;
            tableHtml += '</tbody></table></div>';
            lines[i] = tableHtml + '\n' + lines[i];
          }
        }
      }
      if (inTable) {
        tableHtml += '</tbody></table></div>';
        html = lines.map((l, idx) => idx === lines.length - 1 ? tableHtml : l).join('\n');
      } else {
        html = lines.join('\n');
      }
    }

    // Bullet Lists
    html = html.replace(/^\* (.*?)$/gm, '<li class="ml-4 list-disc text-slate-300">$1</li>');
    html = html.replace(/^- (.*?)$/gm, '<li class="ml-4 list-disc text-slate-300">$1</li>');
    
    // Double newlines into spacing
    const paras = html.split(/\n\n+/);
    return paras.map(para => {
      const trimmed = para.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('<h') || trimmed.startsWith('<pre') || trimmed.startsWith('<blockquote') || trimmed.startsWith('<li') || trimmed.startsWith('<div')) {
        return trimmed;
      }
      return `<p class="mb-2 text-slate-300">${trimmed.replace(/\n/g, '<br/>')}</p>`;
    }).join('');
  };

  // Get initials for placeholder avatar
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('');
  };

  const isCoordinator = !!onSendMessage;

  return (
    <div className={`agent-card glass-panel ${isActive ? agent.activeClass : ''}`}>
      {/* Agent Card Header */}
      {isCoordinator ? (
        <div className="agent-header-vertical">
          <div className="portrait-container-full">
            {agent.avatar ? (
              <img src={agent.avatar} alt={agent.name} className="portrait-img-full" />
            ) : (
              <div className="portrait-placeholder-full" style={{ color: agent.color, backgroundColor: 'rgba(255,255,255,0.03)' }}>
                {getInitials(agent.name)}
              </div>
            )}
          </div>

          <div className="agent-meta-vertical flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="agent-name block text-lg font-serif font-medium leading-tight" style={{ color: agent.color }}>{agent.name}</span>
              <span className="agent-title block text-xs text-slate-400 leading-normal">{agent.title}</span>
            </div>

            <div className="flex items-center justify-between border-t border-slate-800/40 pt-2.5">
              <span className={`badge agent-badge ${agent.badgeClass}`}>
                {isThinking || isCoordinating ? (
                  <Loader2 className="animate-spin flex-shrink-0" size={10} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
                ) : (
                  <span className={`status-indicator ${isActive ? 'status-active' : 'status-idle'}`} />
                )}
                {isThinking ? 'thinking' : isCoordinating ? 'coordinating' : isActive ? 'active' : 'idle'}
              </span>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                {onEditPortrait && (
                  <button
                    className="btn btn--secondary btn--icon"
                    style={{ width: '28px', height: '28px', borderRadius: '50%', padding: 0 }}
                    onClick={onEditPortrait}
                    title="Change Portrait / Local Image"
                  >
                    <Edit size={13} />
                  </button>
                )}
                <button
                  className="btn btn--secondary btn--icon"
                  style={{ width: '28px', height: '28px', borderRadius: '50%', padding: 0 }}
                  onClick={() => setShowInspector(!showInspector)}
                  title="Inspect Agent System Prompt"
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
              <div className="portrait-placeholder" style={{ color: agent.color, backgroundColor: 'rgba(255,255,255,0.03)' }}>
                {getInitials(agent.name)}
              </div>
            )}
          </div>

          <div className="agent-meta">
            <div className="flex items-center justify-between">
              <span className="agent-name" style={{ color: agent.color }}>{agent.name}</span>
            </div>
            <span className="agent-title">{agent.title}</span>
            <span className={`badge agent-badge ${agent.badgeClass}`}>
              {isThinking || isCoordinating ? (
                <Loader2 className="animate-spin flex-shrink-0" size={10} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
              ) : (
                <span className={`status-indicator ${isActive ? 'status-active' : 'status-idle'}`} />
              )}
              {isThinking ? 'thinking' : isCoordinating ? 'coordinating' : isActive ? 'active' : 'idle'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {onEditPortrait && (
              <button
                className="btn btn--secondary btn--icon"
                style={{ width: '28px', height: '28px', borderRadius: '50%', padding: 0 }}
                onClick={onEditPortrait}
                title="Change Portrait / Local Image"
              >
                <Edit size={13} />
              </button>
            )}
            <button
              className="btn btn--secondary btn--icon"
              style={{ width: '28px', height: '28px', borderRadius: '50%', padding: 0 }}
              onClick={() => setShowInspector(!showInspector)}
              title="Inspect Agent System Prompt"
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
            <h4 className="font-semibold text-slate-200" style={{ color: agent.color }}>
              Training Profile: {agent.name}
            </h4>
            <button className="inspector-close" onClick={() => setShowInspector(false)}>
              <X size={16} />
            </button>
          </div>
          <div 
            className="text-xs text-slate-400 overflow-y-auto leading-relaxed select-text markdown-content"
            style={{ maxHeight: '300px' }}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(agent.systemPrompt || 'Loading profile instructions...') }}
          />
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
              <div
                className={`message-bubble ${msg.role === 'thought' ? 'message-thought' : ''} select-text markdown-content`}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }}
              />
            </div>
          ))}

          {isThinking && (
            <div className="chat-message message-agent">
              <div className="message-sender">
                <span>{agent.name} is drafting response...</span>
              </div>
              <div className="message-bubble bg-slate-900/40 border border-slate-800/80 rounded-lg">
                <div className="typing-indicator">
                  <div className="typing-dot" style={{ backgroundColor: agent.color }}></div>
                  <div className="typing-dot" style={{ backgroundColor: agent.color }}></div>
                  <div className="typing-dot" style={{ backgroundColor: agent.color }}></div>
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
            <button type="submit" className="btn btn--primary btn--icon chat-send-btn" disabled={!inputValue.trim() || isThinking}>
              {isThinking ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
