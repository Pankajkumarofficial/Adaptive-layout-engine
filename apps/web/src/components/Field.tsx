import type { ReactNode } from 'react';

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-tiny leading-snug text-ink-3">{label}</span>
      {children}
    </label>
  );
}

export function Swatch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <span className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-6 w-8 cursor-pointer rounded-bench border border-rule bg-transparent p-0"
        aria-label="colour"
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-24 rounded-bench border border-rule bg-card px-2 py-1 tabular text-tiny text-ink focus:border-guide focus:outline-none"
      />
    </span>
  );
}
