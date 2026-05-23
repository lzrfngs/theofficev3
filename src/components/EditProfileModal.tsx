import React, { useState } from 'react';
import { X, Upload, Link2, Trash2 } from 'lucide-react';
import type { Agent } from '../services/coordinator';

interface EditProfileModalProps {
  agent: Agent | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (agentId: string, avatarUrl: string) => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  agent,
  isOpen,
  onClose,
  onSave
}) => {
  const [avatarInput, setAvatarInput] = useState(() => agent?.avatar || '');
  const [uploadError, setUploadError] = useState('');

  if (!isOpen || !agent) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setUploadError('');
    
    if (!file) return;

    // Check file size (limit to 2MB to keep localStorage happy)
    if (file.size > 2 * 1024 * 1024) {
      setUploadError('Image size must be smaller than 2MB for storage limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Url = event.target?.result as string;
      setAvatarInput(base64Url);
    };
    reader.onerror = () => {
      setUploadError('Failed to read local image file.');
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(agent.id, avatarInput);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <form onSubmit={handleSubmit} className="modal-content glass-panel border border-slate-700/80 shadow-2xl">
        <div className="modal-header">
          <h3 className="modal-title flex items-center gap-2 text-white">
            Change Agent Portrait: <span style={{ color: agent.color }}>{agent.name}</span>
          </h3>
          <button type="button" className="btn btn--secondary" style={{ padding: '4px', borderRadius: '50%', height: '32px', width: '32px' }} onClick={onClose} title="Close portrait editor" aria-label="Close portrait editor">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-4 py-2">
          {/* Avatar Preview */}
          <div className="flex justify-center my-2">
            <div className="portrait-container portrait-large border border-slate-700" style={{ width: '100px', height: '100px', borderRadius: 'var(--r-xl)' }}>
              {avatarInput ? (
                <img src={avatarInput} alt="Preview" className="portrait-img" />
              ) : (
                <div className="portrait-placeholder" style={{ color: agent.color, fontSize: '36px' }}>
                  {agent.name.split(' ').map(n => n[0]).join('')}
                </div>
              )}
            </div>
          </div>

          {/* Option 1: File Upload */}
          <div className="form-group field">
            <label className="field-label flex items-center gap-1.5">
              <Upload size={13} /> Upload Local Image File
            </label>
            <label className="portrait-upload-label border border-dashed border-slate-700 hover:border-slate-500 rounded-lg p-4 cursor-pointer flex flex-col items-center gap-2">
              <Upload size={20} className="text-slate-400" />
              <span className="text-xs text-slate-400">Choose a PNG, JPG, or SVG file (Max 2MB)</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
            </label>
            {uploadError && <span className="field-error text-xs text-rose-500 mt-1">{uploadError}</span>}
          </div>

          <div className="flex items-center gap-4 my-1">
            <div className="divider flex-grow" style={{ margin: 0 }} />
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold font-mono">OR</span>
            <div className="divider flex-grow" style={{ margin: 0 }} />
          </div>

          {/* Option 2: Image URL */}
          <div className="form-group field">
            <label className="field-label flex items-center gap-1.5">
              <Link2 size={13} /> Paste Image Link / URL
            </label>
            <input
              type="text"
              className="input"
              placeholder="Paste portrait image URL..."
              value={avatarInput.startsWith('data:') ? '' : avatarInput}
              onChange={(e) => setAvatarInput(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-between border-t border-slate-800 pt-4 mt-2">
          {avatarInput ? (
            <button 
              type="button" 
              className="btn btn--danger btn--sm flex items-center gap-1.5"
              onClick={() => setAvatarInput('')}
            >
              <Trash2 size={13} /> Remove Portrait
            </button>
          ) : (
            <div />
          )}

          <div className="flex gap-3">
            <button type="button" className="btn btn--secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary">
              Apply Portrait
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
