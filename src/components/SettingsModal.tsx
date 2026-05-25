import React, { useState } from 'react';
import { X, Cpu, HelpCircle, Route } from 'lucide-react';
import type { Agent, ModelProvider } from '../services/coordinator';

export interface ProviderStatus {
  provider: ModelProvider;
  configured: boolean;
  missing: string[];
  defaultModel: string;
}

interface SettingsModalProps {
  provider: ModelProvider;
  model: string;
  agents: Agent[];
  stepModelOverrides: Record<string, string>;
  providerStatuses: ProviderStatus[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (provider: ModelProvider, model: string, stepModelOverrides: Record<string, string>) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  provider,
  model,
  agents,
  stepModelOverrides,
  providerStatuses,
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
  const selectedProviderStatus = providerStatuses.find(status => status.provider === providerSelect);

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
              {getProviderOptions(providerStatuses).map(option => (
                <option key={option.provider} value={option.provider}>
                  {option.label}{option.configured ? '' : ' (missing env)'}
                </option>
              ))}
            </select>
            {selectedProviderStatus && !selectedProviderStatus.configured && (
              <p className="settings-warning">Missing server env: {selectedProviderStatus.missing.join(' or ')}</p>
            )}
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
              <p>The office calls a server-side model router. Choose a configured provider; missing provider keys must be added in Vercel environment variables, then redeployed.</p>
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

function getProviderOptions(statuses: ProviderStatus[]) {
  const fallback = [
    { provider: 'gemini' as const, configured: true, missing: [], defaultModel: 'gemini-3.5-flash' },
    { provider: 'openai' as const, configured: true, missing: [], defaultModel: 'gpt-5.4' },
    { provider: 'anthropic' as const, configured: true, missing: [], defaultModel: 'claude-opus-4-6' },
    { provider: 'azure-openai' as const, configured: true, missing: [], defaultModel: 'gpt-4.1' },
    { provider: 'github-models' as const, configured: true, missing: [], defaultModel: 'openai/gpt-5.4' }
  ];
  const source = statuses.length > 0 ? statuses : fallback;
  return source.map(status => ({ ...status, label: getProviderLabel(status.provider) }));
}

function getProviderLabel(provider: ModelProvider) {
  if (provider === 'gemini') return 'Gemini';
  if (provider === 'openai') return 'OpenAI';
  if (provider === 'anthropic') return 'Anthropic';
  if (provider === 'azure-openai') return 'Azure OpenAI';
  return 'GitHub Models';
}

function getProviderModels(provider: ModelProvider) {
  if (provider === 'gemini') return ['gemini-3.5-flash', 'gemini-3.1-pro', 'gemini-2.5-flash'];
  if (provider === 'openai') return ['gpt-5.4', 'gpt-5.4-mini', 'gpt-5.2', 'gpt-4.1'];
  if (provider === 'anthropic') return ['claude-opus-4-6', 'claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5'];
  if (provider === 'azure-openai') return ['gpt-4.1', 'gpt-5.4', 'gpt-5.4-mini'];
  return ['openai/gpt-5.4', 'openai/gpt-5.4-mini', 'anthropic/claude-opus-4-6'];
}
