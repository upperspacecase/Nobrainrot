"use client";

import { useEffect, useRef, useState } from "react";
import AuditResults, {
  type ScoredApp,
  type Summary,
} from "./AuditResults";
import { decodeShare, encodeShare } from "@/lib/share";

type AuditResponse = {
  summary: Summary;
  scored: ScoredApp[];
  unmatched?: string[];
  ms: number;
  frames?: number;
};

type Phase =
  | { kind: "idle" }
  | { kind: "processing"; label: string }
  | { kind: "results"; data: AuditResponse; fromShare?: boolean }
  | { kind: "error"; message: string };

const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_VIDEO = ["video/mp4", "video/quicktime", "video/webm"];
const ACCEPTED_IMAGE = ["image/png", "image/jpeg", "image/webp"];

export default function AuditForm() {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [mode, setMode] = useState<"upload" | "paste">("upload");
  const [pasteText, setPasteText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load results from URL hash on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.location.hash) return;
    (async () => {
      const decoded = await decodeShare(window.location.hash);
      if (decoded) {
        setPhase({
          kind: "results",
          data: {
            summary: decoded.summary as Summary,
            scored: decoded.scored as ScoredApp[],
            unmatched: decoded.unmatched as string[] | undefined,
            ms: 0,
          },
          fromShare: true,
        });
      }
    })();
  }, []);

  const reset = () => {
    setPhase({ kind: "idle" });
    setPasteText("");
    if (typeof window !== "undefined" && window.location.hash) {
      history.replaceState(null, "", window.location.pathname);
    }
  };

  const submitFile = async (file: File) => {
    const isVideo = ACCEPTED_VIDEO.includes(file.type);
    const isImage = ACCEPTED_IMAGE.includes(file.type);
    if (!isVideo && !isImage) {
      setPhase({
        kind: "error",
        message: `Unsupported file type: ${file.type || "unknown"}`,
      });
      return;
    }
    const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (file.size > maxBytes) {
      setPhase({
        kind: "error",
        message: `File is ${(file.size / 1024 / 1024).toFixed(1)} MB — max ${
          maxBytes / 1024 / 1024
        } MB.`,
      });
      return;
    }

    setPhase({
      kind: "processing",
      label: isVideo
        ? "extracting frames · reading labels · scoring…"
        : "reading labels · scoring…",
    });

    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/audit", {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      setPhase({ kind: "results", data: json });
    } catch (e) {
      setPhase({ kind: "error", message: (e as Error).message });
    }
  };

  const submitNames = async () => {
    const names = pasteText
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (names.length === 0) {
      setPhase({ kind: "error", message: "Paste at least one app name." });
      return;
    }
    setPhase({ kind: "processing", label: "scoring…" });
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ names }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setPhase({ kind: "results", data: json });
    } catch (e) {
      setPhase({ kind: "error", message: (e as Error).message });
    }
  };

  const share = async () => {
    if (phase.kind !== "results") return;
    const hash = await encodeShare({
      v: 1,
      summary: phase.data.summary,
      scored: phase.data.scored,
      unmatched: phase.data.unmatched,
      generated_at: new Date().toISOString(),
    });
    const url = `${window.location.origin}${window.location.pathname}#${hash}`;
    history.replaceState(null, "", `#${hash}`);
    try {
      await navigator.clipboard.writeText(url);
      // cheap toast
      const el = document.createElement("div");
      el.textContent = "link copied";
      el.className =
        "fixed bottom-6 left-1/2 -translate-x-1/2 rounded bg-accent px-3 py-1.5 text-xs text-black";
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 1800);
    } catch {
      /* ignore */
    }
  };

  if (phase.kind === "results") {
    return (
      <div className="space-y-6">
        {phase.fromShare && (
          <div className="rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs text-neutral-500">
            Viewing a shared audit. Results are encoded in the URL — nothing
            was fetched from a server.
          </div>
        )}
        {phase.data.frames !== undefined && phase.data.frames > 1 && (
          <div className="text-xs text-neutral-500">
            {phase.data.frames} unique frames analyzed · {phase.data.ms}ms
          </div>
        )}
        <AuditResults
          summary={phase.data.summary}
          scored={phase.data.scored}
          unmatched={phase.data.unmatched}
          onShare={share}
          onReset={reset}
        />
      </div>
    );
  }

  if (phase.kind === "processing") {
    return (
      <div className="rounded-lg border border-neutral-900 bg-neutral-950 p-8 text-center">
        <div className="text-xs uppercase tracking-[0.25em] text-neutral-500">
          auditing
        </div>
        <div className="mt-3 text-sm text-neutral-300">
          <span className="inline-block animate-pulse">· {phase.label}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1 text-xs">
        <TabButton
          active={mode === "upload"}
          onClick={() => setMode("upload")}
          label="upload"
        />
        <TabButton
          active={mode === "paste"}
          onClick={() => setMode("paste")}
          label="paste names"
        />
      </div>

      {mode === "upload" ? (
        <label
          className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-neutral-800 bg-neutral-950 px-4 py-10 text-center transition hover:border-accent/40 hover:bg-accent/5"
          onDragOver={(e) => {
            e.preventDefault();
            e.currentTarget.classList.add("border-accent/60", "bg-accent/10");
          }}
          onDragLeave={(e) => {
            e.currentTarget.classList.remove(
              "border-accent/60",
              "bg-accent/10",
            );
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.classList.remove(
              "border-accent/60",
              "bg-accent/10",
            );
            const f = e.dataTransfer.files?.[0];
            if (f) submitFile(f);
          }}
        >
          <div className="text-3xl text-neutral-600">⇅</div>
          <div className="mt-2 text-sm text-neutral-300">
            drop screenshot or screen recording
          </div>
          <div className="mt-1 text-xs text-neutral-500">
            .png / .jpg / .mov / .mp4 / .webm · up to 200 MB
          </div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept={[...ACCEPTED_IMAGE, ...ACCEPTED_VIDEO].join(",")}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) submitFile(f);
            }}
          />
        </label>
      ) : (
        <div className="space-y-3">
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={6}
            placeholder={"Coin Master\nTikTok\nCandy Crush\nNotes\nCalculator"}
            className="w-full rounded-lg border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-200 placeholder:text-neutral-700 focus:border-accent/60 focus:outline-none font-mono"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-500">
              one app per line, or comma-separated
            </span>
            <button
              onClick={submitNames}
              disabled={pasteText.trim().length === 0}
              className="rounded bg-accent px-4 py-2 text-xs font-semibold text-black hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              audit &rarr;
            </button>
          </div>
        </div>
      )}

      {phase.kind === "error" && (
        <div className="rounded border border-red-500/40 bg-red-500/5 px-3 py-2 text-xs text-red-400">
          {phase.message}
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded px-3 py-1.5 uppercase tracking-[0.2em] transition ${
        active
          ? "bg-neutral-900 text-white"
          : "text-neutral-500 hover:text-neutral-300"
      }`}
    >
      {label}
    </button>
  );
}
