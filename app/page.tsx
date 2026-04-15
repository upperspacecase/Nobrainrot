import DemoPlayer from "@/components/DemoPlayer";

export default function Page() {
  return (
    <main className="min-h-screen bg-black text-neutral-200 font-mono">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        {/* header */}
        <header className="mb-16">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-neutral-500">
            <span className="inline-block h-2 w-2 rounded-full bg-accent" />
            <span>life-time / wireheading-audit</span>
          </div>
          <h1 className="mt-6 text-4xl sm:text-5xl font-semibold leading-[1.05] text-white">
            Audit your phone for
            <br />
            <span className="text-accent">slot-machine apps.</span>
          </h1>
          <p className="mt-6 max-w-xl text-neutral-400 leading-relaxed">
            Upload a screen recording of scrolling through your iOS home
            screens. Get back a ranked kill list of apps using slot-machine
            mechanics — with the specific dark patterns flagged and reasons
            why.
          </p>

          <div className="mt-10 flex items-center gap-4">
            <button
              disabled
              className="rounded-md bg-accent px-5 py-3 text-sm font-semibold text-black hover:bg-accent/90 disabled:opacity-60 disabled:cursor-not-allowed"
              title="Demo only — pipeline shipping soon"
            >
              Audit my phone &rarr;
            </button>
            <span className="text-xs text-neutral-500">
              pipeline shipping soon — watch the demo below
            </span>
          </div>
        </header>

        {/* remotion demo */}
        <section className="mb-16">
          <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-neutral-500">
            <span>— demo.mp4</span>
            <span>60s</span>
          </div>
          <div className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950">
            <DemoPlayer />
          </div>
        </section>

        {/* how it works */}
        <section className="mb-16">
          <h2 className="mb-6 text-xs uppercase tracking-[0.25em] text-neutral-500">
            How it works
          </h2>
          <ol className="space-y-4 text-sm leading-relaxed">
            {[
              ["01", "Record your home screens", "Slow scroll through your iOS home screens. Drop the video here."],
              ["02", "Frames → OCR → metadata", "We pull frames, read the app labels, and look each one up in the App Store."],
              ["03", "Rule-based scoring", "Every score is transparent — gambling advisory, casino keywords, streak mechanics, dual currency, comeback notifications."],
              ["04", "Ranked kill list", "DELETE / RECONSIDER / KEEP. Export as markdown or close the tab."],
            ].map(([n, title, body]) => (
              <li key={n} className="flex gap-5 border-l-2 border-neutral-800 pl-5">
                <span className="text-accent shrink-0">{n}</span>
                <div>
                  <div className="text-white">{title}</div>
                  <div className="text-neutral-400">{body}</div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* rubric */}
        <section className="mb-16">
          <h2 className="mb-6 text-xs uppercase tracking-[0.25em] text-neutral-500">
            What we flag
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {[
              ["slot", "Gambling advisory"],
              ["slot", "Casino / jackpot keywords"],
              ["slot", "Gacha summon mechanics"],
              ["feed", "Short video feeds"],
              ["feed", "Infinite-scroll social"],
              ["streak", "Streaks & daily logins"],
              ["streak", "Energy / stamina timers"],
              ["currency", "Dual currency + IAP"],
              ["notif", "Comeback notifications"],
              ["time", "Limited-time FOMO events"],
            ].map(([cat, label]) => (
              <div
                key={label}
                className="flex items-center justify-between border-b border-neutral-900 py-2"
              >
                <span className="text-neutral-200">{label}</span>
                <span className="text-[10px] uppercase tracking-widest text-neutral-600">
                  {cat}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* privacy */}
        <section className="mb-16 rounded-lg border border-neutral-900 bg-neutral-950 p-6 text-sm leading-relaxed">
          <div className="mb-2 text-xs uppercase tracking-[0.25em] text-accent">
            Privacy
          </div>
          <p className="text-neutral-300">
            No accounts. No tracking. Your video is processed in memory and
            discarded the moment the request ends. We never see your app list.
            The source is open.
          </p>
        </section>

        <footer className="flex items-center justify-between text-xs text-neutral-600">
          <span>life-time.co — tools to get you offline</span>
          <span>v0.1 · rule-based · no LLM</span>
        </footer>
      </div>
    </main>
  );
}
