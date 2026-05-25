import React, { useState } from 'react';
import { X, Cpu, HelpCircle, Route } from 'lucide-react';
import type { Agent, ModelProvider } from '../services/coordinator';

interface SettingsModalProps {
  provider: ModelProvider;
  model: string;
  agents: Agent[];
  stepModelOverrides: Record<string, string>;
  isOpen: boolean;
  onClose: () => void;
  onSave: (provider: ModelProvider, model: string, stepModelOverrides: Record<string, string>) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  provider,
  model,
  agents,
  stepModelOverrides,
  isOpen,
  onClose,
  onSave
}) => {
  const [providerSelect, setProviderSelect] = useState<ModelProvider>(provider);
  const [modelSelect, setModelSelect] = useState(model);
  const [overrideSelect, setOverrideSelect] = useState<Record<string, string>>(stepModelOverrides);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(providerSelect, modelSelect.trim(), cleanOverrides(overrideSelect));
    onClose();
  };

  const providerModels = getProviderModels(providerSelect);

  return (
    <div className="modal-overlay">
      <form onSubmit={handleSubmit} className="modal-content glass-panel border border-slate-700/80 shadow-2xl">
        <div className="modal-header">
          <h3 className="modal-title flex items-center gap-2 text-white">
            <Cpu size={20} className="text-blue-400" />
            Workspace Settings
          </h3>
          <button type="button" className="btn btn--secondary btn--icon modal-close-button" onClick={onClose} title="Close settings" aria-label="Close settings">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-4 py-2">
          {/* Provider */}
          <div className="form-group">
            <label className="form-label flex items-center gap-1.5">
              <Route size={13} /> Model Provider
            </label>
            <select
              className="input select cursor-pointer"
              aria-label="Model provider"
              title="Model provider"
              value={providerSelect}
              onChange={(event) => {
                const nextProvider = event.target.value as ModelProvider;
                setProviderSelect(nextProvider);
                setModelSelect(getProviderModels(nextProvider)[0]);
              }}
            >
              <option value="gemini">Gemini</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="azure-openai">Azure OpenAI</option>
              <option value="github-models">GitHub Models</option>
            </select>
          </div>

          {/* Model Selection */}
          <div className="form-group">
            <label className="form-label flex items-center gap-1.5">
              <Cpu size={13} /> LLM Model
            </label>
            <select
              className="input select cursor-pointer"
              aria-label="LLM model"
              title="LLM model"
              value={modelSelect}
              onChange={(e) => setModelSelect(e.target.value)}
            >
              {providerModels.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <input
              type="text"
              className="input"
              aria-label="Custom model name"
              title="Custom model name"
              placeholder="Or type a custom deployment/model name..."
              value={modelSelect}
              onChange={(event) => setModelSelect(event.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label flex items-center gap-1.5">
              <Cpu size={13} /> Per-agent models
            </label>
            <div className="model-overrides">
              {agents.map(agent => (
                <label key={agent.id} className="model-overrides__row">
                  <span>{agent.name}</span>
                  <input
                    type="text"
                    className="input"
                    placeholder={modelSelect}
                    value={overrideSelect[agent.id] || ''}
                    onChange={(event) => setOverrideSelect(prev => ({ ...prev, [agent.id]: event.target.value }))}
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="p-3 bg-slate-900/40 border border-slate-800 rounded-lg flex gap-3 text-xs text-slate-400">
            <HelpCircle size={16} className="text-slate-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-300 mb-0.5">How it works</p>
              <p>The office now calls a server-side model router. Put provider keys in Vercel environment variables, then choose the provider and model here.</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-800 pt-4 mt-2">
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary">
            Save changes
          </button>
        </div>
      </form>
    </div>
  );
};

function cleanOverrides(overrides: Record<string, string>) {
  return Object.fromEntries(Object.entries(overrides).map(([key, value]) => [key, value.trim()]).filter(([, value]) => value));
}

function getProviderModels(provider: ModelProvider) {
  if (provider === 'gemini') return ['gemini-3.5-flash', 'gemini-3.1-pro', 'gemini-2.5-flash'];
  if (provider === 'openai') return ['gpt-5.4', 'gpt-5.4-mini', 'gpt-5.2', 'gpt-4.1'];
  if (provider === 'anthropic') return ['claude-opus-4-6', 'claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5'];
  if (provider === 'azure-openai') return ['gpt-4.1', 'gpt-5.4', 'gpt-5.4-mini'];
  return ['openai/gpt-5.4', 'openai/gpt-5.4-mini', 'anthropic/claude-opus-4-6'];
}
