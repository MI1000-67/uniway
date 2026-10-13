import React, { useEffect, useRef, useId } from 'react';
import { Icon } from '../icons';
export function ThemeSwitch({ dark, toggle }: { dark: boolean; toggle: () => void }) {
  return (
    <button
      className="theme-switch"
      role="switch"
      aria-checked={dark}
      aria-label="Night theme"
      onClick={toggle}
    >
      <span className="scene" aria-hidden="true">
        <span className="night-sky" />
        <span className="cloud cloud-one" />
        <span className="cloud cloud-two" />
        <span className="star star-one">✦</span>
        <span className="star star-two">✧</span>
        <span className="star star-three">·</span>
        <span className="celestial">
          <span className="sun-disc" />
          <span className="moon-disc">
            <i />
            <i />
            <i />
          </span>
        </span>
      </span>
    </button>
  );
}

export function Dialog({
  title,
  subtitle,
  close,
  children,
  wide = false,
  dismissible = true,
}: {
  title: string;
  subtitle?: string;
  close: () => void;
  children: React.ReactNode;
  wide?: boolean;
  dismissible?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const el = ref.current!;
    el.showModal();
    return () => el.close();
  }, []);
  return (
    <dialog
      aria-labelledby={titleId}
      className={`dialog ${wide ? 'wide' : ''}`}
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        if (dismissible) close();
      }}
      onClick={(e) => {
        if (dismissible && e.target === e.currentTarget) close();
      }}
    >
      <div className="dialog-content">
        {dismissible && (
          <button className="icon-button dialog-close" aria-label="Close dialog" onClick={close}>
            <Icon name="close" />
          </button>
        )}
        <span className="eyebrow">YOUR CAMPUS, CONNECTED</span>
        <h2 id={titleId}>{title}</h2>
        {subtitle && <p className="muted dialog-sub">{subtitle}</p>}
        {children}
      </div>
    </dialog>
  );
}
