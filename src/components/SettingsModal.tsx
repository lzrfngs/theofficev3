import React, { useState } from 'react';
import { X, Key, Cpu, HelpCircle } from 'lucide-react';

interface SettingsModalProps {
  apiKey: string;
  model: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (apiKey: string, model: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  apiKey,
  model,
  isOpen,
  onClose,
  onSave
}) => {
  const [keyInput, setKeyInput] = useState(apiKey);
  const [modelSelect, setModelSelect] = useState(model);
  const [showKey, setShowKey] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(keyInput.trim(), modelSelect);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <form onSubmit={handleSubmit} className="modal-content glass-panel border border-slate-700/80 shadow-2xl">
        <div className="modal-header">
          <h3 className="modal-title flex items-center gap-2 text-white">
            <Cpu size={20} className="text-blue-400" />
            Workspace Settings
          </h3>
          <button type="button" className="btn btn--secondary btn--icon" style={{ width: '32px', height: '32px', padding: 0, borderRadius: '50%' }} onClick={onClose} title="Close settings" aria-label="Close settings">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-4 py-2">
          {/* API Key */}
          <div className="form-group">
            <label className="form-label flex items-center justify-between">
              <span className="flex items-center gap-1.5"><Key size={13} /> Gemini API Key</span>
              <button 
                type="button" 
                className="text-[10px] text-blue-400 hover:text-blue-300 font-medium"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? 'Hide Key' : 'Reveal Key'}
              </button>
            </label>
            <input
              type={showKey ? 'text' : 'password'}
              className="input"
              placeholder="Enter Gemini API Key (Optional)..."
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
            />
            {!keyInput && (
              <span className="text-[11px] text-slate-500 italic mt-1">
                Leave blank to run in simulated mode (fully offline, no API key required).
              </span>
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
              <option value="gemini-3.5-flash">Gemini 3.5 Flash (Fast, Recommended)</option>
              <option value="gemini-3.1-pro">Gemini 3.1 Pro (Thorough, Analytical)</option>
              <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash-Lite (Low Latency)</option>
              <option value="gemini-2.5-flash">Gemini 2.5 Flash (Stable Legacy)</option>
            </select>
          </div>

          <div className="p-3 bg-slate-900/40 border border-slate-800 rounded-lg flex gap-3 text-xs text-slate-400">
            <HelpCircle size={16} className="text-slate-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-300 mb-0.5">How it works</p>
              <p>The office coordinates multi-agent conversations. When you provide an API Key, the main agent Penelope generates dynamic sub-tasks for the experts, calls them using their training instructions, and summarizes their outputs in real time.</p>
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
