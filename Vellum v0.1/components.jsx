/* global React */
const { useState, useEffect, useRef, useLayoutEffect } = React;

/* ============================================================
   Icons — Lucide-style thin-line SVGs (1.5px stroke, 16-20px)
   ============================================================ */
const Ic = ({ d, size = 16, stroke = 1.5, fill = 'none', children, ...p }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24"
       fill={fill} stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" {...p}>
    {d ? <path d={d}/> : children}
  </svg>
);

const Icon = {
  Search: (p) => <Ic size={16} {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></Ic>,
  Plus: (p) => <Ic {...p}><path d="M12 5v14M5 12h14"/></Ic>,
  Minus: (p) => <Ic {...p}><path d="M5 12h14"/></Ic>,
  Check: (p) => <Ic stroke={2.5} {...p}><path d="m5 12 5 5L20 7"/></Ic>,
  X: (p) => <Ic {...p}><path d="M18 6 6 18M6 6l12 12"/></Ic>,
  ArrowRight: (p) => <Ic {...p}><path d="M5 12h14M13 6l6 6-6 6"/></Ic>,
  ArrowLeft: (p) => <Ic {...p}><path d="M19 12H5M11 6l-6 6 6 6"/></Ic>,
  ChevronDown: (p) => <Ic {...p}><path d="m6 9 6 6 6-6"/></Ic>,
  ChevronRight: (p) => <Ic {...p}><path d="m9 6 6 6-6 6"/></Ic>,
  ChevronUp: (p) => <Ic {...p}><path d="m6 15 6-6 6 6"/></Ic>,
  Settings: (p) => <Ic {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></Ic>,
  User: (p) => <Ic {...p}><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></Ic>,
  Home: (p) => <Ic {...p}><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1Z"/></Ic>,
  Bell: (p) => <Ic {...p}><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/></Ic>,
  Mail: (p) => <Ic {...p}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></Ic>,
  Sun: (p) => <Ic {...p}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></Ic>,
  Moon: (p) => <Ic {...p}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></Ic>,
  Heart: (p) => <Ic {...p}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/></Ic>,
  Star: (p) => <Ic {...p}><path d="m12 2 3 7 7.5.6-5.7 4.9 1.8 7.3L12 18l-6.6 3.8 1.8-7.3L1.5 9.6 9 9Z"/></Ic>,
  Trash: (p) => <Ic {...p}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></Ic>,
  Folder: (p) => <Ic {...p}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></Ic>,
  File: (p) => <Ic {...p}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M14 3v6h6"/></Ic>,
  Edit: (p) => <Ic {...p}><path d="M11 4H4v16h16v-7"/><path d="m18.4 2.6 3 3L12 15l-4 1 1-4Z"/></Ic>,
  Copy: (p) => <Ic {...p}><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></Ic>,
  Download: (p) => <Ic {...p}><path d="M12 3v12M6 11l6 6 6-6M4 21h16"/></Ic>,
  Upload: (p) => <Ic {...p}><path d="M12 21V9M6 13l6-6 6 6M4 3h16"/></Ic>,
  Link: (p) => <Ic {...p}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.1 1.1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.1-1.1"/></Ic>,
  Filter: (p) => <Ic {...p}><path d="M3 5h18l-7 9v6l-4-2v-4Z"/></Ic>,
  Menu: (p) => <Ic {...p}><path d="M4 6h16M4 12h16M4 18h16"/></Ic>,
  MoreH: (p) => <Ic {...p}><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></Ic>,
  Info: (p) => <Ic {...p}><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/></Ic>,
  Alert: (p) => <Ic {...p}><path d="M12 3 2 21h20Z"/><path d="M12 10v4M12 18h.01"/></Ic>,
  Calendar: (p) => <Ic {...p}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></Ic>,
  Image: (p) => <Ic {...p}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></Ic>,
  Play: (p) => <Ic {...p}><path d="M6 4v16l14-8Z" fill="currentColor"/></Ic>,
  Pause: (p) => <Ic {...p}><rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/></Ic>,
  Lock: (p) => <Ic {...p}><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></Ic>,
  Eye: (p) => <Ic {...p}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></Ic>,
  Code: (p) => <Ic {...p}><path d="m8 6-6 6 6 6M16 6l6 6-6 6M14 4l-4 16"/></Ic>,
  Sparkle: (p) => <Ic {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/></Ic>,
  Command: (p) => <Ic {...p}><path d="M18 6a3 3 0 1 0-3 3v6a3 3 0 1 0 3-3H9a3 3 0 1 0 3 3V9a3 3 0 1 0-3 3"/></Ic>,
};

/* ============================================================
   Illustrations — frosted glass, blur + grain
   Stage: a colorful blurred backdrop, frosted glass panel(s)
   on top, with subject shapes layered in.
   ============================================================ */
const IlluStage = ({ size = 160, tint = 'a', children }) => {
  const uid = React.useId ? React.useId().replace(/:/g, '') : Math.random().toString(36).slice(2);
  // Two tint variants using monochrome graphite + warm surface blobs
  const blobs = tint === 'a'
    ? [
        { cx: 40, cy: 40, r: 60, fill: 'var(--surface-3)' },
        { cx: 160, cy: 100, r: 70, fill: 'var(--ink-2)', op: 0.35 },
        { cx: 120, cy: 30, r: 40, fill: 'var(--accent-soft)', op: 0.8 },
      ]
    : [
        { cx: 170, cy: 40, r: 55, fill: 'var(--ink-2)', op: 0.4 },
        { cx: 30, cy: 110, r: 60, fill: 'var(--surface-3)' },
        { cx: 100, cy: 70, r: 50, fill: 'var(--accent-soft)', op: 0.7 },
      ];
  return (
    <svg width={size} height={size * 0.75} viewBox="0 0 200 150" aria-hidden>
      <defs>
        <clipPath id={`c-${uid}`}><rect x="0" y="0" width="200" height="150" rx="12"/></clipPath>
        <filter id={`blur-${uid}`}><feGaussianBlur stdDeviation="14"/></filter>
        <filter id={`grain-${uid}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>
          <feColorMatrix values="0 0 0 0 0.2  0 0 0 0 0.18  0 0 0 0 0.15  0 0 0 0.35 0"/>
          <feComposite in2="SourceGraphic" operator="in"/>
        </filter>
        <linearGradient id={`glass-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--surface-0)" stopOpacity="0.92"/>
          <stop offset="1" stopColor="var(--surface-0)" stopOpacity="0.82"/>
        </linearGradient>
        <linearGradient id={`edge-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="white" stopOpacity="0.55"/>
          <stop offset="0.4" stopColor="white" stopOpacity="0.05"/>
          <stop offset="1" stopColor="white" stopOpacity="0"/>
        </linearGradient>
      </defs>

      <g clipPath={`url(#c-${uid})`}>
        {/* solid base (darker so glass reads as "above") */}
        <rect x="0" y="0" width="200" height="150" fill="var(--ink-2)" opacity="0.28"/>
        <rect x="0" y="0" width="200" height="150" fill="var(--surface-3)"/>
        {/* grain */}
        <rect x="0" y="0" width="200" height="150" filter={`url(#grain-${uid})`} opacity="0.4"/>
        {/* subject (frosted glass + content) */}
        {children && children({ uid })}
      </g>
      {/* outer ring */}
      <rect x="0.5" y="0.5" width="199" height="149" rx="12" fill="none" stroke="var(--line-2)" opacity="0.6"/>
    </svg>
  );
};

const GlassPanel = ({ x, y, w, h, r = 10, uid, children }) => (
  <g>
    <rect x={x} y={y} width={w} height={h} rx={r}
      fill={`url(#glass-${uid})`}
      stroke="white" strokeOpacity="0.35"/>
    {/* top highlight */}
    <rect x={x + 1} y={y + 1} width={w - 2} height="1.2" rx="0.6" fill="white" opacity="0.5"/>
    {children}
  </g>
);

const Illu = {
  Empty: ({ size = 160 }) => (
    <IlluStage size={size} tint="a">
      {({ uid }) => (
        <>
          <GlassPanel x={34} y={30} w={132} h={90} uid={uid}>
            <rect x="48" y="50" width="60" height="6" rx="3" fill="var(--ink-1)" opacity="0.90"/>
            <rect x="48" y="64" width="90" height="5" rx="2.5" fill="var(--ink-1)" opacity="0.55"/>
            <rect x="48" y="76" width="50" height="5" rx="2.5" fill="var(--ink-1)" opacity="0.55"/>
            <circle cx="146" cy="46" r="10" fill="var(--accent-ink)"/>
            <path d="m141 46 3 3 6-6" stroke="var(--surface-0)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          </GlassPanel>
        </>
      )}
    </IlluStage>
  ),
  Document: ({ size = 160 }) => (
    <IlluStage size={size} tint="b">
      {({ uid }) => (
        <>
          {/* back frosted card */}
          <GlassPanel x={58} y={32} w={80} h={96} uid={uid}/>
          {/* front — offset */}
          <GlassPanel x={48} y={22} w={80} h={96} uid={uid}>
            <rect x="60" y="42" width="56" height="5" rx="2.5" fill="var(--ink-1)" opacity="0.85"/>
            <rect x="60" y="54" width="56" height="4" rx="2" fill="var(--ink-1)" opacity="0.55"/>
            <rect x="60" y="64" width="40" height="4" rx="2" fill="var(--ink-1)" opacity="0.55"/>
            <rect x="60" y="84" width="44" height="14" rx="4" fill="var(--ink-1)"/>
            <rect x="66" y="89" width="20" height="4" rx="2" fill="var(--surface-0)"/>
          </GlassPanel>
        </>
      )}
    </IlluStage>
  ),
  Chart: ({ size = 160 }) => (
    <IlluStage size={size} tint="a">
      {({ uid }) => (
        <GlassPanel x={24} y={20} w={152} h={108} uid={uid}>
          {/* bars with frosted look */}
          <rect x="42" y="78" width="16" height="34" rx="3" fill="var(--ink-1)" opacity="0.55"/>
          <rect x="66" y="62" width="16" height="50" rx="3" fill="var(--ink-1)" opacity="0.70"/>
          <rect x="90" y="46" width="16" height="66" rx="3" fill="var(--ink-1)" opacity="0.85"/>
          <rect x="114" y="64" width="16" height="48" rx="3" fill="var(--ink-1)" opacity="0.65"/>
          <rect x="138" y="38" width="16" height="74" rx="3" fill="var(--ink-1)"/>
          <circle cx="146" cy="38" r="5" fill="var(--accent-ink)"/>
          <rect x="24" y="108" width="152" height="1" fill="var(--ink-1)" opacity="0.30"/>
        </GlassPanel>
      )}
    </IlluStage>
  ),
  Cloud: ({ size = 160 }) => (
    <IlluStage size={size} tint="b">
      {({ uid }) => (
        <>
          {/* back cloud frosted */}
          <g opacity="0.55">
            <path d="M72 96a22 22 0 0 1 8-42 30 30 0 0 1 58 8 18 18 0 0 1 14 34Z"
                  fill={`url(#glass-${uid})`} stroke="white" strokeOpacity="0.3"/>
          </g>
          {/* front cloud */}
          <path d="M52 100a22 22 0 0 1 8-42 30 30 0 0 1 58 8 18 18 0 0 1 14 34Z"
                fill={`url(#glass-${uid})`} stroke="white" strokeOpacity="0.45"/>
          {/* drops */}
          <rect x="68" y="104" width="4" height="14" rx="2" fill="var(--ink-1)" opacity="0.80"/>
          <rect x="88" y="110" width="4" height="14" rx="2" fill="var(--ink-1)" opacity="0.80"/>
          <rect x="108" y="104" width="4" height="14" rx="2" fill="var(--ink-1)" opacity="0.80"/>
        </>
      )}
    </IlluStage>
  ),
  Lock: ({ size = 160 }) => (
    <IlluStage size={size} tint="a">
      {({ uid }) => (
        <>
          {/* shackle behind */}
          <path d="M78 68V46a22 22 0 0 1 44 0v22h-10V46a12 12 0 0 0-24 0v22Z"
                fill={`url(#glass-${uid})`} stroke="white" strokeOpacity="0.4"/>
          {/* body */}
          <GlassPanel x={56} y={66} w={88} h={58} r={10} uid={uid}>
            <circle cx="100" cy="90" r="7" fill="var(--ink-1)"/>
            <rect x="97" y="92" width="6" height="14" rx="3" fill="var(--ink-1)"/>
          </GlassPanel>
        </>
      )}
    </IlluStage>
  ),
};

/* ============================================================
   Primitives
   ============================================================ */

const Button = React.forwardRef(({ variant = 'secondary', size = 'md', icon, iconRight, children, className = '', ...p }, ref) => {
  const cls = ['btn', `btn--${variant}`, size !== 'md' && `btn--${size}`, !children && 'btn--icon', className].filter(Boolean).join(' ');
  return (
    <button ref={ref} className={cls} {...p}>
      {icon}
      {children}
      {iconRight}
    </button>
  );
});

const Input = React.forwardRef(({ icon, size = 'md', className = '', ...p }, ref) => {
  const input = <input ref={ref} className={`input ${size !== 'md' ? 'input--' + size : ''} ${className}`} {...p}/>;
  if (!icon) return input;
  return <div className="input-group"><span className="input-icon">{icon}</span>{input}</div>;
});

const Textarea = React.forwardRef((p, ref) => <textarea ref={ref} className="input" {...p}/>);

const Select = ({ children, ...p }) => (
  <select className="input select" {...p}>{children}</select>
);

const Field = ({ label, hint, error, children }) => (
  <label className="field">
    {label && <span className="field-label">{label}</span>}
    {children}
    {error ? <span className="field-error">{error}</span> : hint && <span className="field-hint">{hint}</span>}
  </label>
);

const Checkbox = ({ label, checked, onChange, ...p }) => (
  <label className="check">
    <input type="checkbox" checked={checked} onChange={onChange} {...p}/>
    <span className="check__box">
      <Icon.Check size={12} stroke={3}/>
    </span>
    {label && <span>{label}</span>}
  </label>
);

const Radio = ({ label, ...p }) => (
  <label className="check">
    <input type="radio" {...p}/>
    <span className="check__dot"/>
    {label && <span>{label}</span>}
  </label>
);

const Toggle = ({ label, checked, onChange, ...p }) => (
  <label className="toggle">
    <input type="checkbox" checked={checked} onChange={onChange} {...p}/>
    <span className="toggle__track"><span className="toggle__thumb"/></span>
    {label && <span>{label}</span>}
  </label>
);

const Slider = ({ min = 0, max = 100, value, onChange, ...p }) => {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <input type="range" className="slider"
      style={{ '--val': pct + '%' }}
      min={min} max={max} value={value}
      onChange={onChange} {...p}/>
  );
};

const Badge = ({ children, variant, dot, ...p }) => (
  <span className={`badge ${variant ? 'badge--' + variant : ''} ${dot ? 'badge--dot' : ''}`} {...p}>{children}</span>
);

const Tag = ({ children, onRemove }) => (
  <span className="tag">
    {children}
    {onRemove && <button onClick={onRemove} aria-label="Remove"><Icon.X size={12}/></button>}
  </span>
);

const Chip = ({ children, active, onClick, icon }) => (
  <button className={`chip ${active ? 'chip--active' : ''}`} aria-pressed={active} onClick={onClick}>
    {icon}{children}
  </button>
);

const Kbd = ({ children }) => <span className="kbd">{children}</span>;

const Card = ({ variant, children, className = '', ...p }) => (
  <div className={`card ${variant ? 'card--' + variant : ''} ${className}`} {...p}>{children}</div>
);

/* Tabs */
const Tabs = ({ tabs, value, onChange }) => (
  <div className="tabs" role="tablist">
    {tabs.map(t => (
      <button key={t.value} role="tab" aria-selected={value === t.value}
        className="tabs__tab" onClick={() => onChange(t.value)}>{t.label}</button>
    ))}
  </div>
);

/* Segmented */
const Segmented = ({ options, value, onChange }) => {
  const ref = useRef(null);
  const [thumb, setThumb] = useState({ x: 0, w: 0 });
  useLayoutEffect(() => {
    const idx = options.findIndex(o => o.value === value);
    const node = ref.current?.children[idx + 1]; // +1 for thumb
    if (node) setThumb({ x: node.offsetLeft, w: node.offsetWidth });
  }, [value, options]);
  return (
    <div className="segmented" ref={ref}>
      <span className="segmented__thumb" style={{ transform: `translateX(${thumb.x - 3}px)`, width: thumb.w }}/>
      {options.map(o => (
        <button key={o.value} className="segmented__opt" aria-selected={value === o.value}
          onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
};

/* Tooltip (hover) */
const Tooltip = ({ label, children, side = 'top' }) => {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}>
      {children}
      <span className="tooltip" role="tooltip"
        style={{
          position: 'absolute',
          bottom: side === 'top' ? 'calc(100% + 8px)' : 'auto',
          top: side === 'bottom' ? 'calc(100% + 8px)' : 'auto',
          left: '50%',
          transform: `translateX(-50%) translateY(${open ? 0 : (side === 'top' ? 4 : -4)}px)`,
          opacity: open ? 1 : 0,
          transition: 'opacity 150ms, transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          pointerEvents: 'none',
          zIndex: 10,
        }}>{label}</span>
    </span>
  );
};

/* Popover / menu */
const Popover = ({ trigger, children, align = 'start' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);
  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      {React.cloneElement(trigger, { onClick: () => setOpen(v => !v) })}
      {open && (
        <div className="popover" style={{
          position: 'absolute', top: 'calc(100% + 6px)',
          left: align === 'start' ? 0 : 'auto',
          right: align === 'end' ? 0 : 'auto',
          zIndex: 20,
          animation: 'popIn 180ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}>{typeof children === 'function' ? children(() => setOpen(false)) : children}</div>
      )}
    </span>
  );
};

Object.assign(window, {
  Icon, Illu, Button, Input, Textarea, Select, Field,
  Checkbox, Radio, Toggle, Slider,
  Badge, Tag, Chip, Kbd, Card,
  Tabs, Segmented, Tooltip, Popover,
});
