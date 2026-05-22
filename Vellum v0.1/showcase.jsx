/* global React, ReactDOM,
   Icon, Illu, Button, Input, Textarea, Select, Field,
   Checkbox, Radio, Toggle, Slider,
   Badge, Tag, Chip, Kbd, Card,
   Tabs, Segmented, Tooltip, Popover */

const { useState, useEffect, useRef } = React;

/* ——— Section shell ——— */
const Section = ({ id, num, name, desc, children, right }) => (
  <section id={id} className="section">
    <div className="section__head">
      <div>
        <div className="section__title">
          <span className="section__num">{num}</span>
          <h2 className="section__name">{name}</h2>
        </div>
        {desc && <p className="section__desc" style={{marginTop: 4}}>{desc}</p>}
      </div>
      {right}
    </div>
    {children}
  </section>
);

const Demo = ({ label, tall, split, children, style }) => (
  <div className="demo">
    <div className={`demo__preview ${tall ? 'demo__preview--tall' : ''} ${split ? 'demo__preview--split' : ''}`} style={style}>{children}</div>
    {label && <div className="demo__label">{label}</div>}
  </div>
);

/* ——— Sidebar nav ——— */
const NAV = [
  { group: 'FOUNDATIONS', items: [
    { id: 'colors', label: 'Colors' },
    { id: 'type', label: 'Typography' },
    { id: 'spacing', label: 'Spacing & Radius' },
    { id: 'shadow', label: 'Shadow & Motion' },
    { id: 'icons', label: 'Icons' },
    { id: 'illustrations', label: 'Illustrations' },
  ]},
  { group: 'CONTROLS', items: [
    { id: 'buttons', label: 'Buttons' },
    { id: 'inputs', label: 'Inputs' },
    { id: 'select', label: 'Select' },
    { id: 'checkbox', label: 'Checkbox & Radio' },
    { id: 'toggle', label: 'Toggles' },
    { id: 'slider', label: 'Sliders' },
  ]},
  { group: 'ELEMENTS', items: [
    { id: 'labels', label: 'Badges, Tags, Chips' },
    { id: 'cards', label: 'Cards & Blocks' },
    { id: 'tabs', label: 'Tabs & Segmented' },
  ]},
  { group: 'NAVIGATION', items: [
    { id: 'nav', label: 'Nav & Sidebar' },
    { id: 'overlays', label: 'Modals & Overlays' },
    { id: 'tooltips', label: 'Tooltips & Popovers' },
  ]},
  { group: 'PATTERNS', items: [
    { id: 'patterns', label: 'Patterns' },
  ]},
];

const Sidebar = ({ active, theme, setTheme }) => {
  return (
    <aside className="sidebar side">
      <div className="side__brand">
        <div className="side__logo">V</div>
        <div>
          <div className="side__name">Vellum</div>
          <div className="side__ver">v0.1 · design system</div>
        </div>
      </div>
      {NAV.map(g => (
        <div key={g.group} className="sidebar__group">
          <div className="sidebar__groupLabel">{g.group}</div>
          {g.items.map(it => (
            <a key={it.id} href={`#${it.id}`} className={`sidebar__item ${active === it.id ? 'sidebar__item--active' : ''}`}>
              {it.label}
            </a>
          ))}
        </div>
      ))}
      <div style={{ marginTop: 'auto', padding: '12px 4px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span className="t-meta">Theme</span>
        <Segmented
          options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]}
          value={theme} onChange={setTheme}/>
      </div>
    </aside>
  );
};

/* ——— Foundations: Colors ——— */
const ColorsSection = () => {
  const surfaces = [
    { name: 'surface-0', var: '--surface-0' },
    { name: 'surface-1', var: '--surface-1' },
    { name: 'surface-2', var: '--surface-2' },
    { name: 'surface-3', var: '--surface-3' },
  ];
  const ink = [
    { name: 'ink-1', var: '--ink-1' },
    { name: 'ink-2', var: '--ink-2' },
    { name: 'ink-3', var: '--ink-3' },
    { name: 'ink-4', var: '--ink-4' },
  ];
  const accent = [
    { name: 'accent',       var: '--accent' },
    { name: 'accent-hover', var: '--accent-hover' },
    { name: 'accent-soft',  var: '--accent-soft' },
    { name: 'accent-ink',   var: '--accent-ink' },
  ];
  const semantic = [
    { name: 'success', var: '--success' },
    { name: 'warning', var: '--warning' },
    { name: 'danger',  var: '--danger' },
    { name: 'info',    var: '--info' },
  ];

  const SwatchRow = ({ title, items, ink = false }) => (
    <div>
      <div className="t-meta" style={{ marginBottom: 8 }}>{title}</div>
      <div className="grid-4">
        {items.map(s => (
          <div key={s.name} className="swatch"
            style={{
              background: `var(${s.var})`,
              color: ink ? 'var(--ink-inv)' : 'var(--ink-1)',
            }}>
            <div className="swatch__meta">
              <span>{s.var}</span>
            </div>
            <div className="swatch__name">{s.name}</div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <Section id="colors" num="01" name="Color"
      desc="Warm paper surfaces and graphite ink, with an ochre accent for emphasis. All pairings clear 4.5:1 contrast for body text.">
      <div className="col" style={{ gap: 24 }}>
        <SwatchRow title="Surfaces" items={surfaces}/>
        <SwatchRow title="Ink" items={ink} ink/>
        <SwatchRow title="Accent" items={accent}/>
        <SwatchRow title="Semantic" items={semantic} ink/>
      </div>
    </Section>
  );
};

/* ——— Foundations: Type ——— */
const TypeSection = () => (
  <Section id="type" num="02" name="Typography" desc="A humanist sans for UI paired with a Georgia-family serif for editorial moments. Mono for meta.">
    <Card>
      <div className="col" style={{ gap: 22 }}>
        <div>
          <div className="t-meta" style={{marginBottom: 6}}>Display · Serif italic · 48</div>
          <div className="t-display">The quiet confidence of warm paper.</div>
        </div>
        <div>
          <div className="t-meta" style={{marginBottom: 6}}>Title · Serif · 32</div>
          <div className="t-title">Crafted, monochrome, a touch of ochre.</div>
        </div>
        <hr className="divider"/>
        <div>
          <div className="t-meta" style={{marginBottom: 6}}>H1 · Sans · 24 / 500</div>
          <div className="t-h1">Heading for a section</div>
        </div>
        <div>
          <div className="t-meta" style={{marginBottom: 6}}>H2 · Sans · 20 / 500</div>
          <div className="t-h2">Subsection title</div>
        </div>
        <div>
          <div className="t-meta" style={{marginBottom: 6}}>Body · Sans · 15 / 400</div>
          <div className="t-body" style={{maxWidth: '60ch'}}>Vellum pairs a warm humanist sans with a classic serif. Body sits at 15px on a 1.5 line-height so it stays comfortable in dense UIs — while display and titles get the editorial weight of a serif italic.</div>
        </div>
        <div>
          <div className="t-meta" style={{marginBottom: 6}}>Small · Sans · 13 / 400</div>
          <div className="t-small">Supporting copy for dense interfaces and captions.</div>
        </div>
        <div>
          <div className="t-meta" style={{marginBottom: 6}}>Meta · Mono · 11 / tracked</div>
          <div className="t-meta">SECTION LABEL · 01</div>
        </div>
        <hr className="divider"/>
        <div className="grid-2">
          <div>
            <div className="t-meta" style={{marginBottom: 6}}>Sans — Instrument Sans</div>
            <div style={{fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-32)', letterSpacing: '-0.01em'}}>Aa Rg</div>
            <div className="t-mono t-dim" style={{marginTop: 4}}>humanist · warm · 400/500/600</div>
          </div>
          <div>
            <div className="t-meta" style={{marginBottom: 6}}>Serif — Georgia Pro / Georgia</div>
            <div style={{fontFamily: 'var(--font-serif)', fontSize: 'var(--fs-32)', fontStyle: 'italic'}}>Aa Rg</div>
            <div className="t-mono t-dim" style={{marginTop: 4}}>editorial · roman + italic</div>
          </div>
        </div>
      </div>
    </Card>
  </Section>
);

/* ——— Foundations: Spacing & Radius ——— */
const SpacingSection = () => {
  const scale = [2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64];
  const radii = [
    { name: 'xs', var: 'var(--r-xs)' },
    { name: 'sm', var: 'var(--r-sm)' },
    { name: 'md', var: 'var(--r-md)' },
    { name: 'lg', var: 'var(--r-lg)' },
    { name: 'xl', var: 'var(--r-xl)' },
    { name: '2xl', var: 'var(--r-2xl)' },
  ];
  return (
    <Section id="spacing" num="03" name="Spacing & Radius" desc="A 4px base grid and a radius family from sharp (3px) to soft (20px).">
      <div className="grid-2">
        <Card>
          <div className="t-meta" style={{marginBottom: 12}}>Spacing</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {scale.map(px => (
              <div key={px} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: px, height: 12,
                  background: 'var(--accent)',
                  borderRadius: 2,
                  boxShadow: 'var(--edge-top)'
                }}/>
                <span className="t-mono t-dim">{px}px</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <div className="t-meta" style={{marginBottom: 12}}>Radius</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {radii.map(r => (
              <div key={r.name} style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
                <div style={{
                  width: 72, height: 52,
                  background: 'linear-gradient(180deg, var(--surface-0), var(--surface-2))',
                  boxShadow: 'var(--edge-top), var(--edge-ring), var(--shadow-sm)',
                  borderRadius: r.var,
                }}/>
                <span className="t-mono t-dim">r-{r.name}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </Section>
  );
};

/* ——— Foundations: Shadow & Motion ——— */
const ShadowSection = () => {
  const shadows = ['xs', 'sm', 'md', 'lg', 'xl'];
  return (
    <Section id="shadow" num="04" name="Shadow & Motion" desc="Soft, warm shadows. Motion favors gentle easing with a springy nudge on toggles and segmented thumbs.">
      <Card>
        <div className="t-meta" style={{marginBottom: 14}}>Elevation</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
          {shadows.map(s => (
            <div key={s} style={{display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center'}}>
              <div style={{
                width: '100%', height: 64,
                background: 'var(--surface-1)',
                borderRadius: 'var(--r-md)',
                boxShadow: `var(--shadow-${s}), var(--edge-top), var(--edge-ring)`
              }}/>
              <span className="t-mono t-dim">shadow-{s}</span>
            </div>
          ))}
        </div>
        <hr className="divider"/>
        <div className="t-meta" style={{marginBottom: 14}}>Motion</div>
        <div className="t-small" style={{marginBottom: 8}}>Durations 90–480ms · eases: out, in-out, spring. Presses scale 0.97. Hover transitions 150–220ms.</div>
      </Card>
    </Section>
  );
};

/* ——— Icons ——— */
const IconsSection = () => {
  const entries = Object.entries(Icon);
  return (
    <Section id="icons" num="05" name="Icons" desc={`A curated monoline set — ${entries.length} icons, 1.5px stroke, optically balanced at 16px.`}>
      <div className="iconGrid">
        {entries.map(([name, I]) => (
          <div key={name} className="iconGrid__cell" data-name={name}><I size={18}/></div>
        ))}
      </div>
    </Section>
  );
};

/* ——— Illustrations ——— */
const IllustrationsSection = () => {
  const entries = Object.entries(Illu);
  return (
    <Section id="illustrations" num="06" name="Illustrations" desc="Simple, on-brand scenes. Adapt automatically to theme via currentColor and surface tokens.">
      <div className="grid-4">
        {entries.map(([name, I]) => (
          <Card key={name} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10}}>
            <I size={140}/>
            <div className="t-mono t-dim">{name}</div>
          </Card>
        ))}
      </div>
    </Section>
  );
};

/* ——— Buttons ——— */
const ButtonsSection = () => (
  <Section id="buttons" num="07" name="Buttons" desc="Primary, secondary, ghost, danger · three sizes · optional icons.">
    <div className="grid-3">
      <Demo label="Primary" split>
        <Button variant="primary" size="sm">Continue</Button>
        <Button variant="primary">Continue</Button>
        <Button variant="primary" size="lg" icon={<Icon.Sparkle size={16}/>}>Generate</Button>
      </Demo>
      <Demo label="Secondary" split>
        <Button size="sm">Cancel</Button>
        <Button icon={<Icon.Download/>}>Export</Button>
        <Button size="lg" iconRight={<Icon.ArrowRight/>}>Next step</Button>
      </Demo>
      <Demo label="Ghost" split>
        <Button variant="ghost" size="sm">Skip</Button>
        <Button variant="ghost" icon={<Icon.Plus/>}>Add item</Button>
        <Button variant="ghost" size="lg">Learn more</Button>
      </Demo>
      <Demo label="Danger" split>
        <Button variant="danger" size="sm">Delete</Button>
        <Button variant="danger" icon={<Icon.Trash/>}>Delete file</Button>
      </Demo>
      <Demo label="Icon only" split>
        <Button size="sm" aria-label="Settings"><Icon.Settings/></Button>
        <Button aria-label="Edit"><Icon.Edit/></Button>
        <Button variant="primary" aria-label="Add"><Icon.Plus/></Button>
        <Button variant="ghost" aria-label="More"><Icon.MoreH/></Button>
      </Demo>
      <Demo label="States" split>
        <Button variant="primary">Default</Button>
        <Button variant="primary" disabled>Disabled</Button>
        <Button disabled>Disabled</Button>
      </Demo>
    </div>
  </Section>
);

/* ——— Inputs ——— */
const InputsSection = () => {
  const [s, setS] = useState('');
  return (
    <Section id="inputs" num="08" name="Inputs" desc="Text, search, textarea. Three sizes, with icon adornments and full field wiring.">
      <div className="grid-2">
        <Demo label="Text inputs">
          <div className="col" style={{ width: '100%', gap: 12 }}>
            <Field label="Full name"><Input placeholder="Ada Lovelace"/></Field>
            <Field label="Email" hint="We'll never share this."><Input type="email" placeholder="[email protected]"/></Field>
            <Field label="Password" error="Must be 8+ characters"><Input type="password" defaultValue="short"/></Field>
          </div>
        </Demo>
        <Demo label="Sizes & variants">
          <div className="col" style={{ width: '100%', gap: 12 }}>
            <Input size="sm" placeholder="Small"/>
            <Input placeholder="Medium (default)"/>
            <Input size="lg" placeholder="Large"/>
            <Input icon={<Icon.Search/>} placeholder="Search components…" value={s} onChange={e => setS(e.target.value)}/>
            <Textarea placeholder="Tell us more…"/>
          </div>
        </Demo>
      </div>
    </Section>
  );
};

/* ——— Select ——— */
const SelectSection = () => {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState('Paper');
  const options = ['Paper', 'Vellum', 'Linen', 'Canvas', 'Plaster'];
  return (
    <Section id="select" num="09" name="Select & Combobox" desc="Native select plus a popover-based combobox.">
      <div className="grid-2">
        <Demo label="Native select">
          <div className="col" style={{ width: '100%', gap: 12 }}>
            <Field label="Material">
              <Select defaultValue="vellum">
                <option value="paper">Paper</option>
                <option value="vellum">Vellum</option>
                <option value="linen">Linen</option>
                <option value="canvas">Canvas</option>
              </Select>
            </Field>
          </div>
        </Demo>
        <Demo label="Combobox (popover)">
          <div style={{ width: '100%' }}>
            <Field label="Material">
              <Popover
                trigger={
                  <button className="input" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left' }}>
                    <span>{sel}</span>
                    <Icon.ChevronDown/>
                  </button>
                }>
                {(close) => (
                  <>
                    {options.map(o => (
                      <button key={o} className="popover__item" onClick={() => { setSel(o); close(); }}>
                        <span style={{ width: 14 }}>{sel === o ? <Icon.Check size={14}/> : null}</span>
                        <span>{o}</span>
                      </button>
                    ))}
                  </>
                )}
              </Popover>
            </Field>
          </div>
        </Demo>
      </div>
    </Section>
  );
};

/* ——— Checkbox / Radio ——— */
const CheckboxSection = () => {
  const [boxes, setBoxes] = useState({ a: true, b: false, c: true });
  const [radio, setRadio] = useState('b');
  return (
    <Section id="checkbox" num="10" name="Checkbox & Radio" desc="Springy tick animation; supports keyboard focus and 44px hit target via label.">
      <div className="grid-2">
        <Demo label="Checkbox">
          <div className="col" style={{gap: 12, alignItems: 'flex-start'}}>
            <Checkbox label="Auto-save drafts"     checked={boxes.a} onChange={e => setBoxes(s => ({...s, a: e.target.checked}))}/>
            <Checkbox label="Send weekly digest"   checked={boxes.b} onChange={e => setBoxes(s => ({...s, b: e.target.checked}))}/>
            <Checkbox label="Share with team"      checked={boxes.c} onChange={e => setBoxes(s => ({...s, c: e.target.checked}))}/>
            <Checkbox label="Disabled option" disabled/>
          </div>
        </Demo>
        <Demo label="Radio">
          <div className="col" style={{gap: 12, alignItems: 'flex-start'}}>
            {['a','b','c'].map(v => (
              <Radio key={v} name="plan" value={v} checked={radio === v} onChange={() => setRadio(v)}
                label={{a:'Free', b:'Studio', c:'Agency'}[v] + ' plan'}/>
            ))}
          </div>
        </Demo>
      </div>
    </Section>
  );
};

/* ——— Toggle & Slider ——— */
const ToggleSliderSection = () => {
  const [t1, setT1] = useState(true);
  const [t2, setT2] = useState(false);
  const [sl, setSl] = useState(42);
  const [vol, setVol] = useState(75);
  return (
    <>
      <Section id="toggle" num="11" name="Toggles" desc="Track fills with accent on activation; thumb spring-travels with a slight overshoot.">
        <div className="grid-2">
          <Demo label="Toggle — default">
            <div className="col" style={{gap: 14, alignItems: 'flex-start'}}>
              <Toggle label="Enable frosted surfaces" checked={t1} onChange={e => setT1(e.target.checked)}/>
              <Toggle label="Reduced motion"          checked={t2} onChange={e => setT2(e.target.checked)}/>
              <Toggle label="Disabled toggle" disabled/>
            </div>
          </Demo>
          <Demo label="With secondary text">
            <div className="col" style={{ width: '100%', gap: 16 }}>
              {[
                ['Notifications', 'Pings for mentions and replies only.', true],
                ['Background sync', 'Pulls changes while idle.', false],
              ].map(([title, sub, on], i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 'var(--fs-14)', fontWeight: 500 }}>{title}</div>
                    <div className="t-small">{sub}</div>
                  </div>
                  <Toggle defaultChecked={on}/>
                </div>
              ))}
            </div>
          </Demo>
        </div>
      </Section>

      <Section id="slider" num="12" name="Sliders" desc="Accent-fill track, soft-3D thumb. Focus state on keyboard.">
        <div className="grid-2">
          <Demo label="Slider · continuous" tall>
            <div style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span className="t-meta">Opacity</span>
                <span className="t-mono t-dim">{sl}%</span>
              </div>
              <Slider value={sl} onChange={e => setSl(+e.target.value)}/>
            </div>
          </Demo>
          <Demo label="Slider · with icons" tall>
            <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12 }}>
              <Icon.Minus/>
              <Slider value={vol} onChange={e => setVol(+e.target.value)}/>
              <Icon.Plus/>
            </div>
          </Demo>
        </div>
      </Section>
    </>
  );
};

/* ——— Labels / Badges / Chips ——— */
const LabelsSection = () => {
  const [chip, setChip] = useState(new Set(['Design']));
  const toggle = (c) => setChip(s => { const n = new Set(s); n.has(c) ? n.delete(c) : n.add(c); return n; });
  return (
    <Section id="labels" num="13" name="Badges, Tags, Chips" desc="Micro-labels with semantic color; tags for removable items; chips for filter selections.">
      <div className="grid-3">
        <Demo label="Badges" split>
          <Badge>Neutral</Badge>
          <Badge variant="accent">Accent</Badge>
          <Badge variant="success" dot>Active</Badge>
          <Badge variant="warning" dot>Pending</Badge>
          <Badge variant="danger" dot>Error</Badge>
          <Badge variant="info">Beta</Badge>
        </Demo>
        <Demo label="Tags" split>
          <Tag onRemove={() => {}}>research</Tag>
          <Tag onRemove={() => {}}>design-system</Tag>
          <Tag>immutable</Tag>
        </Demo>
        <Demo label="Kbd" split>
          <span className="row" style={{ gap: 4 }}><Kbd>⌘</Kbd><Kbd>K</Kbd></span>
          <span className="row" style={{ gap: 4 }}><Kbd>⇧</Kbd><Kbd>Tab</Kbd></span>
          <span className="row" style={{ gap: 4 }}><Kbd>Esc</Kbd></span>
        </Demo>
        <Demo label="Chips · filter" split style={{gridColumn: 'span 2'}}>
          {['Design', 'Engineering', 'Product', 'Research', 'Ops'].map(c => (
            <Chip key={c} active={chip.has(c)} onClick={() => toggle(c)}>{c}</Chip>
          ))}
        </Demo>
        <Demo label="Chip with icon">
          <Chip active icon={<Icon.Filter size={14}/>}>Filters · 3</Chip>
        </Demo>
      </div>
    </Section>
  );
};

/* ——— Cards & Blocks ——— */
const CardsSection = () => (
  <Section id="cards" num="14" name="Cards & Blocks" desc="Flat, raised, sunken, outline. Use raised sparingly for emphasis.">
    <div className="grid-4">
      <Card>
        <div className="t-meta">Default</div>
        <div className="t-h3" style={{marginTop: 6}}>Soft paper card</div>
        <p className="t-small" style={{marginTop: 4}}>The everyday surface. Clean edge-ring, no elevation.</p>
      </Card>
      <Card variant="raised">
        <div className="t-meta">Raised</div>
        <div className="t-h3" style={{marginTop: 6}}>Subtly lifted</div>
        <p className="t-small" style={{marginTop: 4}}>Gradient and shadow give it a gentle 3D rise.</p>
      </Card>
      <Card variant="sunken">
        <div className="t-meta">Sunken</div>
        <div className="t-h3" style={{marginTop: 6}}>Well below the page</div>
        <p className="t-small" style={{marginTop: 4}}>For inputs that receive — trays and wells.</p>
      </Card>
      <Card variant="outline">
        <div className="t-meta">Outline</div>
        <div className="t-h3" style={{marginTop: 6}}>Quiet frame</div>
        <p className="t-small" style={{marginTop: 4}}>Defines without asserting.</p>
      </Card>
    </div>
  </Section>
);

/* ——— Tabs & Segmented ——— */
const TabsSection = () => {
  const [t, setT] = useState('overview');
  const [seg, setSeg] = useState('week');
  return (
    <Section id="tabs" num="15" name="Tabs & Segmented" desc="Tabs for top-level content, segmented for scope toggles within a view.">
      <div className="grid-2">
        <Demo label="Tabs" tall>
          <div style={{ width: '100%' }}>
            <Tabs value={t} onChange={setT} tabs={[
              { value: 'overview', label: 'Overview' },
              { value: 'activity', label: 'Activity' },
              { value: 'files',    label: 'Files' },
              { value: 'settings', label: 'Settings' },
            ]}/>
            <div style={{paddingTop: 20}}>
              <div className="t-small">Showing: <b>{t}</b></div>
            </div>
          </div>
        </Demo>
        <Demo label="Segmented" tall>
          <Segmented
            value={seg} onChange={setSeg}
            options={[
              { value: 'day',   label: 'Day' },
              { value: 'week',  label: 'Week' },
              { value: 'month', label: 'Month' },
              { value: 'year',  label: 'Year' },
            ]}/>
        </Demo>
      </div>
    </Section>
  );
};

/* ——— Nav & Sidebar ——— */
const NavSection = () => (
  <Section id="nav" num="16" name="Nav & Sidebar" desc="Frosted top bar for apps on rich backgrounds; paper sidebar for focused workspaces.">
    <div className="col" style={{ gap: 16 }}>
      <Demo label="Navbar · frosted" style={{background: `linear-gradient(135deg, var(--accent-soft), var(--surface-2)), repeating-linear-gradient(45deg, var(--surface-1) 0 12px, var(--surface-2) 12px 24px)`, padding: 16}}>
        <div className="navbar" style={{ width: '100%' }}>
          <div className="navbar__brand">Vellum</div>
          <nav className="navbar__links">
            <a href="#" className="navbar__link" aria-current="page">Projects</a>
            <a href="#" className="navbar__link">Library</a>
            <a href="#" className="navbar__link">Team</a>
          </nav>
          <div style={{flex: 1}}/>
          <Input size="sm" icon={<Icon.Search size={14}/>} placeholder="Search…" style={{ width: 200 }}/>
          <Button size="sm" variant="ghost" aria-label="Notifications"><Icon.Bell/></Button>
          <div className="avatar">V</div>
        </div>
      </Demo>
      <Demo label="Sidebar" tall>
        <div style={{ display: 'flex', gap: 16, width: '100%' }}>
          <aside className="sidebar" style={{ width: 220 }}>
            <div className="sidebar__groupLabel">WORKSPACE</div>
            <a href="#nav" className="sidebar__item sidebar__item--active"><Icon.Home size={16}/> Home</a>
            <a href="#nav" className="sidebar__item"><Icon.Folder size={16}/> Projects</a>
            <a href="#nav" className="sidebar__item"><Icon.Star size={16}/> Favorites</a>
            <div className="sidebar__groupLabel" style={{marginTop: 8}}>TOOLS</div>
            <a href="#nav" className="sidebar__item"><Icon.Sparkle size={16}/> Generate</a>
            <a href="#nav" className="sidebar__item"><Icon.Settings size={16}/> Settings</a>
          </aside>
          <div style={{ flex: 1, padding: 20, background: 'var(--surface-2)', borderRadius: 'var(--r-md)', color: 'var(--ink-3)', display: 'grid', placeItems: 'center', fontSize: 'var(--fs-13)' }}>workspace content</div>
        </div>
      </Demo>
    </div>
  </Section>
);

/* ——— Overlays ——— */
const OverlaysSection = () => {
  const [modal, setModal] = useState(false);
  const [drawer, setDrawer] = useState(false);
  return (
    <Section id="overlays" num="17" name="Modals & Overlays" desc="Frosted panels float above a blurred scrim. Gentle fade-scale on enter.">
      <div className="grid-2">
        <Demo label="Modal" tall>
          <div className="col" style={{gap: 10, alignItems: 'center'}}>
            <Button variant="primary" onClick={() => setModal(true)} icon={<Icon.Sparkle size={14}/>}>Open modal</Button>
            <div className="t-small">click to open</div>
          </div>
        </Demo>
        <Demo label="Drawer" tall>
          <div className="col" style={{gap: 10, alignItems: 'center'}}>
            <Button onClick={() => setDrawer(true)} iconRight={<Icon.ArrowRight size={14}/>}>Open drawer</Button>
            <div className="t-small">slides in from the right</div>
          </div>
        </Demo>
      </div>

      {/* Stage showing live modal inside a card */}
      <div style={{ marginTop: 20 }}>
        <div className="demo__label" style={{marginBottom: 10}}>Static preview</div>
        <div className="modalStage">
          <div className="modalStage__center">
            <div className="modal" style={{ animation: 'fadeScale 320ms var(--ease-out)' }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div className="t-h2">Rename project</div>
                <Button variant="ghost" size="sm" aria-label="Close"><Icon.X/></Button>
              </div>
              <p className="t-small" style={{marginTop: 4, marginBottom: 16}}>Change the name of this project. Collaborators will be notified.</p>
              <Field label="Project name"><Input defaultValue="Vellum design system"/></Field>
              <div className="row" style={{marginTop: 20, justifyContent: 'flex-end'}}>
                <Button variant="ghost">Cancel</Button>
                <Button variant="primary">Save</Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'grid', placeItems: 'center' }}>
          <div className="scrim" style={{ position: 'fixed' }} onClick={() => setModal(false)}/>
          <div className="modal" style={{ position: 'relative', animation: 'fadeScale 320ms var(--ease-out)' }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div className="t-h2">You did it</div>
              <Button variant="ghost" size="sm" aria-label="Close" onClick={() => setModal(false)}><Icon.X/></Button>
            </div>
            <p className="t-small" style={{marginTop: 4, marginBottom: 16}}>This is a live, frosted modal over the page. Click outside or press Close.</p>
            <div className="row" style={{marginTop: 20, justifyContent: 'flex-end'}}>
              <Button variant="ghost" onClick={() => setModal(false)}>Dismiss</Button>
              <Button variant="primary" onClick={() => setModal(false)}>Great</Button>
            </div>
          </div>
        </div>
      )}

      {/* Live drawer */}
      {drawer && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100 }}>
          <div className="scrim" style={{ position: 'fixed' }} onClick={() => setDrawer(false)}/>
          <div className="drawer" style={{ position: 'fixed', top: 0, right: 0, animation: 'slideInRight 320ms var(--ease-out)' }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div className="t-h2">Filters</div>
              <Button variant="ghost" size="sm" aria-label="Close" onClick={() => setDrawer(false)}><Icon.X/></Button>
            </div>
            <div className="col" style={{ gap: 14, marginTop: 16 }}>
              <Field label="Status">
                <div className="row" style={{ gap: 6 }}>
                  <Chip active>Active</Chip>
                  <Chip>Archived</Chip>
                </div>
              </Field>
              <Field label="Owner"><Input placeholder="Any"/></Field>
              <Field label="Tags">
                <div className="row" style={{ gap: 6 }}>
                  <Tag onRemove={()=>{}}>design</Tag>
                  <Tag onRemove={()=>{}}>research</Tag>
                </div>
              </Field>
            </div>
            <div className="row" style={{marginTop: 24, justifyContent: 'flex-end'}}>
              <Button variant="ghost" onClick={() => setDrawer(false)}>Clear</Button>
              <Button variant="primary" onClick={() => setDrawer(false)}>Apply</Button>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
    </Section>
  );
};

/* ——— Tooltips & Popovers ——— */
const TooltipsSection = () => (
  <Section id="tooltips" num="18" name="Tooltips & Popovers" desc="Tooltips inverse-tint; popovers are frosted to echo overlays.">
    <div className="grid-2">
      <Demo label="Tooltip" tall>
        <div className="row" style={{ gap: 16 }}>
          <Tooltip label="Save draft"><Button aria-label="Save"><Icon.Download/></Button></Tooltip>
          <Tooltip label="Archive"><Button aria-label="Archive"><Icon.Folder/></Button></Tooltip>
          <Tooltip label="Favorite"><Button aria-label="Favorite"><Icon.Star/></Button></Tooltip>
          <Tooltip label="Delete"><Button variant="ghost" aria-label="Delete"><Icon.Trash/></Button></Tooltip>
        </div>
      </Demo>
      <Demo label="Popover menu" tall>
        <Popover trigger={<Button iconRight={<Icon.ChevronDown/>}>Actions</Button>} align="start">
          {(close) => (
            <>
              <button className="popover__item" onClick={close}><Icon.Edit/> Rename</button>
              <button className="popover__item" onClick={close}><Icon.Copy/> Duplicate</button>
              <button className="popover__item" onClick={close}><Icon.Link/> Copy link</button>
              <div className="popover__sep"/>
              <button className="popover__item" onClick={close} style={{ color: 'var(--danger)' }}>
                <Icon.Trash/> Delete
              </button>
            </>
          )}
        </Popover>
      </Demo>
    </div>
  </Section>
);

/* ——— Patterns: chat, list, dashboard snippet ——— */
const PatternsSection = () => (
  <Section id="patterns" num="19" name="Patterns" desc="A few compositions to show the system in motion.">
    <div className="grid-2">
      <Card>
        <div className="t-meta" style={{marginBottom: 12}}>Conversation</div>
        <div className="chat">
          <div className="chat__row">
            <div className="avatar">A</div>
            <div className="chat__bubble">Morning — pushed the token pass, want to take a look?</div>
          </div>
          <div className="chat__row chat__row--me">
            <div className="chat__bubble chat__bubble--me">On it. The warm greys look great at dusk.</div>
          </div>
          <div className="chat__row">
            <div className="avatar">A</div>
            <div className="chat__bubble">Let me know if the ochre needs dialing back.</div>
          </div>
        </div>
        <div className="row" style={{marginTop: 14}}>
          <Input placeholder="Reply…" icon={<Icon.Mail size={14}/>}/>
          <Button variant="primary" aria-label="Send"><Icon.ArrowRight/></Button>
        </div>
      </Card>

      <Card>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <div className="t-meta">Project list</div>
          <Badge variant="accent">12 items</Badge>
        </div>
        <div>
          {[
            ['Vellum · design system', 'Design · Active',    'success'],
            ['Onboarding v3',          'Design · Review',    'warning'],
            ['Marketing refresh',      'Brand · Scoping',    'info'],
            ['Archive · Q1',           'Ops · Archived',     null],
          ].map(([name, meta, v], i) => (
            <div className="listRow" key={i}>
              <div className="ph" style={{ width: 36, height: 36 }}>{name[0]}</div>
              <div style={{flex: 1}}>
                <div style={{ fontSize: 'var(--fs-14)', fontWeight: 500 }}>{name}</div>
                <div className="t-small">{meta}</div>
              </div>
              {v && <Badge variant={v} dot>{meta.split('· ')[1]}</Badge>}
              <Button size="sm" variant="ghost" aria-label="More"><Icon.MoreH/></Button>
            </div>
          ))}
        </div>
      </Card>

      <Card style={{gridColumn: 'span 2'}}>
        <div className="row" style={{justifyContent: 'space-between', marginBottom: 14}}>
          <div>
            <div className="t-meta">Weekly</div>
            <div className="t-h2" style={{ marginTop: 2 }}>Active sessions</div>
          </div>
          <Segmented
            value="week"
            options={[{value:'day',label:'Day'},{value:'week',label:'Week'},{value:'month',label:'Month'}]}
            onChange={()=>{}}/>
        </div>
        {/* Tiny SVG chart */}
        <svg viewBox="0 0 600 160" style={{ width: '100%', height: 160, display: 'block' }}>
          <defs>
            <linearGradient id="p-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--accent)" stopOpacity="0.25"/>
              <stop offset="1" stopColor="var(--accent)" stopOpacity="0"/>
            </linearGradient>
          </defs>
          <path d="M0,120 C60,100 90,60 160,70 C230,80 260,40 320,46 C380,52 420,90 480,70 C540,50 580,30 600,32 L600,160 L0,160 Z"
                fill="url(#p-fill)"/>
          <path d="M0,120 C60,100 90,60 160,70 C230,80 260,40 320,46 C380,52 420,90 480,70 C540,50 580,30 600,32"
                fill="none" stroke="var(--accent)" strokeWidth="2"/>
          {[0,1,2,3,4,5,6].map(i => (
            <line key={i} x1={i*100} x2={i*100} y1={0} y2={160} stroke="var(--line-1)" strokeWidth="1"/>
          ))}
        </svg>
        <div className="row" style={{justifyContent: 'space-between', marginTop: 10, fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-11)', color: 'var(--ink-3)'}}>
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => <span key={d}>{d}</span>)}
        </div>
      </Card>
    </div>
  </Section>
);

/* ——— Hero ——— */
const Hero = () => (
  <div className="hero">
    <div className="hero__bg"/>
    <div className="hero__inner">
      <div>
        <div className="hero__eyebrow">Vellum · v0.1</div>
        <h1 className="hero__title">A warm, monochrome<br/><em>interface kit.</em></h1>
        <p className="hero__sub">Paper-soft surfaces, frosted overlays, and a whisper of ochre. Built for clickable prototypes in Claude Design and Claude Code.</p>
        <div className="hero__actions">
          <Button variant="primary" size="lg" iconRight={<Icon.ArrowRight/>}>Explore components</Button>
          <Button variant="ghost" size="lg" icon={<Icon.Copy size={14}/>}>Copy tokens</Button>
          <span className="t-meta" style={{marginLeft: 8}}>⌘ + K</span>
        </div>
      </div>
      <div className="hero__sample">
        <div className="row" style={{justifyContent: 'space-between', marginBottom: 8}}>
          <div className="t-meta">Preview</div>
          <Badge variant="accent" dot>Live</Badge>
        </div>
        <h4>New project</h4>
        <p>A quick taste of the components working together.</p>
        <Field label="Name"><Input defaultValue="Morning notes"/></Field>
        <div className="row" style={{marginTop: 12, justifyContent: 'space-between'}}>
          <Toggle defaultChecked label="Private"/>
          <Button variant="primary" size="sm">Create</Button>
        </div>
      </div>
    </div>
  </div>
);

/* ——— App ——— */
const App = () => {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('vellum-theme') || 'light'; } catch { return 'light'; }
  });
  const [active, setActive] = useState('colors');
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('vellum-theme', theme); } catch {}
  }, [theme]);

  // Scrollspy
  useEffect(() => {
    const ids = NAV.flatMap(g => g.items.map(i => i.id));
    const onScroll = () => {
      let cur = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top < 120) cur = id;
      }
      setActive(cur);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="shell">
      <Sidebar active={active} theme={theme} setTheme={setTheme}/>
      <main>
        <Hero/>
        <ColorsSection/>
        <TypeSection/>
        <SpacingSection/>
        <ShadowSection/>
        <IconsSection/>
        <IllustrationsSection/>
        <ButtonsSection/>
        <InputsSection/>
        <SelectSection/>
        <CheckboxSection/>
        <ToggleSliderSection/>
        <LabelsSection/>
        <CardsSection/>
        <TabsSection/>
        <NavSection/>
        <OverlaysSection/>
        <TooltipsSection/>
        <PatternsSection/>
        <footer style={{ marginTop: 60, padding: '24px 0 40px', textAlign: 'center' }}>
          <div className="t-meta">VELLUM · V0.1 · MADE FOR WARM INTERFACES</div>
        </footer>
      </main>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('app')).render(<App/>);
