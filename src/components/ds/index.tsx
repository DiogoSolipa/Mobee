'use client';
/* Mobee design-system primitives, ported from the design system's components/bundle.js to typed React.
   Icons: 24px grid, 2px round stroke, drawn in currentColor. */
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Part = [string, Record<string, string | number>];
const fill = (o: Record<string, string | number>) => ({ fill: 'currentColor', stroke: 'none', ...o });

const ICONS: Record<string, Part[]> = {
  walk: [['circle', { cx: 13, cy: 4.5, r: 2 }], ['path', { d: 'M10.5 21l2.5-7 3 3v4' }], ['path', { d: 'M13 14l1-5-3.5 1.5L9 13' }], ['path', { d: 'M14 9l1.5 3H18' }]],
  bus: [['rect', { x: 4, y: 3, width: 16, height: 15, rx: 3 }], ['path', { d: 'M4 11h16M7 18v2.5M17 18v2.5' }], ['circle', fill({ cx: 8, cy: 14.5, r: 1.1 })], ['circle', fill({ cx: 16, cy: 14.5, r: 1.1 })]],
  metro: [['rect', { x: 5, y: 3, width: 14, height: 14, rx: 4 }], ['path', { d: 'M5 10h14M8.5 21l2-4M15.5 21l-2-4' }], ['circle', fill({ cx: 9, cy: 13.5, r: 1.1 })], ['circle', fill({ cx: 15, cy: 13.5, r: 1.1 })]],
  bike: [['circle', { cx: 6, cy: 16, r: 3.5 }], ['circle', { cx: 18, cy: 16, r: 3.5 }], ['path', { d: 'M6 16l4-7h5l3 7M10 9l3.5 7M13 6h3' }]],
  car: [['path', { d: 'M4 15v-3l2.2-5h11.6L20 12v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z' }], ['path', { d: 'M4 12h16M7.5 16v2.5M16.5 16v2.5' }]],
  clock: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M12 7v5l3 2' }]],
  replan: [['path', { d: 'M4.5 11a7.5 7.5 0 0 1 13-4.2L20 9M20 4v5h-5' }], ['path', { d: 'M19.5 13a7.5 7.5 0 0 1-13 4.2L4 15M4 20v-5h5' }]],
  stop: [['path', { d: 'M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z' }], ['circle', { cx: 12, cy: 10, r: 2.2 }]],
  calendar: [['rect', { x: 4, y: 5, width: 16, height: 15, rx: 3 }], ['path', { d: 'M4 10h16M8.5 3v4M15.5 3v4' }]],
  swap: [['path', { d: 'M8 20V4M4.5 7.5L8 4l3.5 3.5M16 4v16M12.5 16.5L16 20l3.5-3.5' }]],
  check: [['path', { d: 'M5 12.5l4.5 4.5L19 7.5' }]],
  alert: [['path', { d: 'M12 4l9 16H3z' }], ['path', { d: 'M12 10v4' }], ['circle', fill({ cx: 12, cy: 17, r: 1.1 })]],
  route: [['circle', { cx: 6, cy: 18, r: 2 }], ['circle', { cx: 18, cy: 6, r: 2 }], ['path', { d: 'M8 18h6.5a3 3 0 0 0 0-6h-5a3 3 0 0 1 0-6H16' }]],
  arrow: [['path', { d: 'M5 12h14M13 6l6 6-6 6' }]],
  undo: [['path', { d: 'M9 14L4 9l5-5' }], ['path', { d: 'M4 9h10.5a5.5 5.5 0 0 1 0 11H11' }]],
};

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 24, label, className }: { name: IconName | string; size?: number; label?: string; className?: string }) {
  const parts = ICONS[name] ?? [];
  return (
    <svg className={['mb-icon', className].filter(Boolean).join(' ')} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" focusable="false" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {parts.map(([tag, attrs], i) => {
        const Tag = tag as 'path';
        return <Tag key={i} {...(attrs as Record<string, string>)} />;
      })}
    </svg>
  );
}

/* Logo: a monoline route. The "m" is two arches whose last leg stops short — the stop (honey dot) has moved. */
const MARK = 'M16 44V27a8 8 0 0 1 16 0V44M32 27a8 8 0 0 1 16 0V33';
const WORD = ['M8 46V29a8 8 0 0 1 16 0V46M24 29a8 8 0 0 1 16 0V35', 'M95 4V46', 'M135 33.5H160A12.5 12.5 0 1 0 156.34 42.34', 'M175 33.5H200A12.5 12.5 0 1 0 196.34 42.34'];
export function Logo({ variant = 'wordmark', size, dot = 'var(--honey)', label = 'Mobee' }: { variant?: 'wordmark' | 'mark'; size?: number; dot?: string; label?: string }) {
  const a11y = label === '' ? { 'aria-hidden': true as const } : { role: 'img', 'aria-label': label };
  const st = { fill: 'none', stroke: 'currentColor', strokeWidth: 7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (variant === 'mark') {
    const s = size ?? 48;
    return (
      <svg className="mb-logo" width={s} height={s} viewBox="0 0 64 64" {...a11y}>
        <path d={MARK} {...st} />
        <circle cx={48} cy={44} r={4.5} fill={dot} />
      </svg>
    );
  }
  const ht = size ?? 32;
  return (
    <svg className="mb-logo" width={ht * 4} height={ht} viewBox="0 0 208 52" {...a11y}>
      {WORD.map((d, i) => <path key={i} d={d} {...st} />)}
      <circle cx={67.5} cy={33.5} r={12.5} {...st} />
      <circle cx={107.5} cy={33.5} r={12.5} {...st} />
      <circle cx={40} cy={46} r={4.5} fill={dot} />
    </svg>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'quiet' | 'danger'; size?: 'md' | 'lg'; icon?: IconName; block?: boolean };
export function Button({ variant = 'secondary', size = 'md', icon, block, className, children, ...rest }: BtnProps) {
  return (
    <button type="button" {...rest} className={['mb-btn', `mb-btn--${variant}`, `mb-btn--${size}`, block && 'mb-btn--block', className].filter(Boolean).join(' ')}>
      {icon ? <Icon name={icon} size={20} /> : null}
      <span>{children}</span>
    </button>
  );
}

export type ContextKey = 'work' | 'home' | 'errand' | 'self';
export function Dot({ context }: { context?: ContextKey }) {
  return <span className={['mb-dot', context && `mb-dot--${context}`].filter(Boolean).join(' ')} aria-hidden="true" />;
}

export function Chip({ selected, onToggle, context, icon, children }: { selected: boolean; onToggle: (v: boolean) => void; context?: ContextKey; icon?: IconName; children: ReactNode }) {
  return (
    <button type="button" className="mb-chip" aria-pressed={selected} onClick={() => onToggle(!selected)}>
      {context ? <Dot context={context} /> : null}
      {icon ? <Icon name={icon} size={18} /> : null}
      {children}
    </button>
  );
}

export type StopStatus = 'on-time' | 'moved' | 'at-risk';
const STATUS_ICON: Record<StopStatus, IconName> = { 'on-time': 'check', moved: 'replan', 'at-risk': 'alert' };
export function StatusPill({ status, children }: { status: StopStatus; children: ReactNode }) {
  return (
    <span className={`mb-status mb-status--${status}`}>
      <Icon name={STATUS_ICON[status]} size={16} />
      {children}
    </span>
  );
}

export function Segmented<T extends string>({ label, value, options, onChange }: { label?: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div>
      {label ? <span className="mb-seg-label">{label}</span> : null}
      <div className="mb-seg" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={o.value === value} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Notification({ title, body, time, onClose, closeLabel }: { title: string; body: string; time: string; onClose?: () => void; closeLabel?: string }) {
  return (
    <div className="mb-notif" role="status" aria-label="Mobee notification">
      <span className="mb-notif__icon"><Logo variant="mark" size={30} dot="currentColor" label="" /></span>
      <div>
        <div className="mb-notif__top"><span>Mobee</span><span className="mono">{time}</span></div>
        <div className="mb-notif__title">{title}</div>
        <div className="mb-notif__body">{body}</div>
      </div>
      {onClose ? <button type="button" className="mb-btn mb-btn--quiet" onClick={onClose} aria-label={closeLabel}>×</button> : null}
    </div>
  );
}
