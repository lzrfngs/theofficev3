import React, { useState } from 'react';
import { Archive, CheckCircle2, FolderPlus, Lightbulb, XCircle } from 'lucide-react';
import type { ProjectLibrary, RunState } from '../types/workflow';

interface ProjectsPanelProps {
  projects: ProjectLibrary[];
  activeProjectId: string | null;
  runState: RunState | null;
  onCreateProject: (name: string) => void;
  onSelectProject: (projectId: string) => void;
  onSaveRunToProject: () => void;
  onDeleteProject: (projectId: string) => void;
}

export const ProjectsPanel: React.FC<ProjectsPanelProps> = ({ projects, activeProjectId, runState, onCreateProject, onSelectProject, onSaveRunToProject, onDeleteProject }) => {
  const [name, setName] = useState('');
  const activeProject = projects.find(project => project.id === activeProjectId) ?? projects[0];

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    onCreateProject(name.trim());
    setName('');
  };

  return (
    <section className="projects-panel" aria-label="Projects and memory">
      <div className="projects-panel__header">
        <div>
          <div className="projects-panel__eyebrow">Memory</div>
          <h2 className="projects-panel__title">Projects</h2>
        </div>
        <button className="btn btn--primary btn--sm" type="button" onClick={onSaveRunToProject} disabled={!runState}>Save current run</button>
      </div>

      <aside className="projects-panel__sidebar">
        <form className="projects-panel__create" onSubmit={handleSubmit}>
          <input className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="New project" aria-label="New project name" />
          <button className="btn btn--secondary btn--sm" type="submit"><FolderPlus size={13} /> Create</button>
        </form>
        <div className="projects-panel__list">
          {projects.length === 0 ? (
            <div className="projects-panel__empty">Create a project to retain sources, claims, sections, and run memories.</div>
          ) : projects.map(project => (
            <button key={project.id} className={`project-row ${project.id === activeProject?.id ? 'is-active' : ''}`} type="button" onClick={() => onSelectProject(project.id)}>
              <strong>{project.name}</strong>
              <span>{project.memories.length} runs · {project.sources.length} sources</span>
            </button>
          ))}
        </div>
      </aside>

      <div className="projects-panel__detail">
        {!activeProject ? (
          <div className="projects-panel__empty projects-panel__empty--detail">No project selected.</div>
        ) : (
          <>
            <div className="project-detail__hero">
              <div>
                <div className="projects-panel__eyebrow">Active project</div>
                <h3>{activeProject.name}</h3>
                <p>Updated {new Date(activeProject.updatedAt).toLocaleString()}</p>
              </div>
              <button className="btn btn--danger btn--sm" type="button" onClick={() => onDeleteProject(activeProject.id)}>Delete</button>
            </div>

            <div className="project-metrics">
              <Metric icon={<Archive size={14} />} label="Memories" value={activeProject.memories.length} />
              <Metric icon={<CheckCircle2 size={14} />} label="Accepted claims" value={activeProject.acceptedClaims.length} />
              <Metric icon={<XCircle size={14} />} label="Rejected claims" value={activeProject.rejectedClaims.length} />
              <Metric icon={<Lightbulb size={14} />} label="Open questions" value={activeProject.openQuestions.length} />
            </div>

            <div className="project-columns">
              <ProjectList title="Accepted Claims" items={activeProject.acceptedClaims.map(claim => claim.text)} empty="No accepted claims yet." />
              <ProjectList title="Rejected Claims" items={activeProject.rejectedClaims.map(claim => claim.text)} empty="No rejected claims yet." />
              <ProjectList title="Sources" items={activeProject.sources.map(source => source.title)} empty="No saved sources yet." />
              <ProjectList title="Sections" items={activeProject.deliverableSections.map(section => section.title)} empty="No saved sections yet." />
              <ProjectList title="Open Questions" items={activeProject.openQuestions} empty="No open questions yet." wide />
            </div>
          </>
        )}
      </div>
    </section>
  );
};

const Metric: React.FC<{ icon: React.ReactNode; label: string; value: number }> = ({ icon, label, value }) => (
  <section className="project-metric">
    {icon}
    <span>{label}</span>
    <strong>{value}</strong>
  </section>
);

const ProjectList: React.FC<{ title: string; items: string[]; empty: string; wide?: boolean }> = ({ title, items, empty, wide = false }) => (
  <section className={`project-card ${wide ? 'project-card--wide' : ''}`}>
    <h3>{title}</h3>
    {items.length === 0 ? <p>{empty}</p> : (
      <ul>
        {items.slice(0, 10).map((item, index) => <li key={`${title}-${index}`}>{item}</li>)}
      </ul>
    )}
  </section>
);
