"use client";

import { useState } from "react";

export type TriggeredRule = {
  id: string;
  name: string;
  weight: number;
  category: string;
  reason: string;
};

export type ScoredApp = {
  name: string;
  bundleId: string;
  tier: "DELETE" | "RECONSIDER" | "KEEP";
  score: number;
  triggered: TriggeredRule[];
  one_liner: string;
  genre: string;
};

export type Summary = {
  total: number;
  delete: number;
  reconsider: number;
  keep: number;
  totalScore: number;
};

const TIER_COLOR: Record<ScoredApp["tier"], string> = {
  DELETE: "text-red-400 border-red-500/40 bg-red-500/5",
  RECONSIDER: "text-yellow-400 border-yellow-500/40 bg-yellow-500/5",
  KEEP: "text-accent border-accent/40 bg-accent/5",
};

export default function AuditResults({
  summary,
  scored,
  unmatched,
  onShare,
  onReset,
}: {
  summary: Summary;
  scored: ScoredApp[];
  unmatched?: string[];
  onShare?: () => void;
  onReset?: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* summary */}
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 border-b border-neutral-900 pb-4 text-sm">
        <span className="text-white">
          <span className="text-red-400 font-semibold">{summary.delete}</span>{" "}
          <span className="text-neutral-500">/ {summary.total}</span> flagged{" "}
          <span className="text-red-400">DELETE</span>
        </span>
        <span className="text-neutral-500">
          score: <span className="text-white">{summary.totalScore}</span>
        </span>
        <span className="ml-auto flex gap-3 text-xs text-neutral-500">
          {onShare && (
            <button onClick={onShare} className="hover:text-white">
              [ share ]
            </button>
          )}
          {onReset && (
            <button onClick={onReset} className="hover:text-white">
              [ reset ]
            </button>
          )}
        </span>
      </div>

      {/* tiered lists */}
      {(["DELETE", "RECONSIDER", "KEEP"] as const).map((tier) => {
        const apps = scored.filter((s) => s.tier === tier);
        if (apps.length === 0) return null;
        return (
          <section key={tier}>
            <div className="mb-2 flex items-baseline justify-between text-xs uppercase tracking-[0.25em]">
              <span className={TIER_COLOR[tier].split(" ")[0]}>{tier}</span>
              <span className="text-neutral-600">{apps.length}</span>
            </div>
            <ul className="space-y-2">
              {apps.map((a) => (
                <Row key={a.bundleId} app={a} />
              ))}
            </ul>
          </section>
        );
      })}

      {unmatched && unmatched.length > 0 && (
        <details className="border-t border-neutral-900 pt-4 text-xs text-neutral-500">
          <summary className="cursor-pointer hover:text-neutral-300">
            unmatched OCR candidates ({unmatched.length})
          </summary>
          <div className="mt-2 font-mono text-neutral-600">
            {unmatched.map((u) => `"${u}"`).join(", ")}
          </div>
        </details>
      )}
    </div>
  );
}

function Row({ app }: { app: ScoredApp }) {
  const [open, setOpen] = useState(false);
  const colors = TIER_COLOR[app.tier];
  return (
    <li className={`rounded-md border ${colors.split(" ").slice(1).join(" ")} border-opacity-40`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-3 py-2 text-left"
      >
        <span
          className={`w-20 rounded border px-1.5 py-0.5 text-center text-[10px] tracking-[0.15em] ${colors}`}
        >
          {app.tier}
        </span>
        <span className="flex-1 truncate text-sm text-white">{app.name}</span>
        <span className="text-xs text-neutral-500">{app.genre}</span>
        <span
          className={`w-8 text-right font-semibold ${colors.split(" ")[0]}`}
        >
          {app.score}
        </span>
      </button>
      {open && app.triggered.length > 0 && (
        <ul className="border-t border-neutral-900 px-3 py-2 text-xs text-neutral-400 space-y-1">
          {app.triggered.map((t) => (
            <li key={t.id}>
              <span className="text-neutral-600">[{t.weight}]</span> {t.reason}
            </li>
          ))}
        </ul>
      )}
      {open && app.triggered.length === 0 && (
        <div className="border-t border-neutral-900 px-3 py-2 text-xs text-neutral-500">
          No rules fired.
        </div>
      )}
    </li>
  );
}
