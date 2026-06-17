"use client";

import React, { useEffect, useRef, useState } from "react";

const SEED = [
  { ticker: "ASML", name: "ASML Holding" },
  { ticker: "QQQM", name: "Invesco NASDAQ-100 ETF" },
  { ticker: "MSFT", name: "Microsoft" },
  { ticker: "NVDA", name: "NVIDIA" },
  { ticker: "PLTR", name: "Palantir Technologies" },
  { ticker: "HII", name: "Huntington Ingalls Industries" },
  { ticker: "LMT", name: "Lockheed Martin" },
  { ticker: "LLY", name: "Eli Lilly" },
  { ticker: "LEU", name: "Centrus Energy" },
  { ticker: "VRT", name: "Vertiv Holdings" },
  { ticker: "NEE", name: "NextEra Energy" },
];

const SENT = {
  positive: { label: "positive", color: "#3FB68B" },
  negative: { label: "negative", color: "#E06B6B" },
  neutral: { label: "neutral", color: "#8A95A5" },
  mixed: { label: "mixed", color: "#E8B84B" },
};

const LOADING_MESSAGES = [
  "Mama we're getting RICH!",
  "FLOCK OFF!!! SEE YA!!!",
  "Now wait a second... BE PATIENT!!!",
  "EAT THE RICH actually no eat MY ASS...",
];

export default function Home() {
  const [holdings, setHoldings] = useState(SEED);
  const [windowKey, setWindowKey] = useState("day");
  const [results, setResults] = useState({});
  const [running, setRunning] = useState(false);
  const [asOf, setAsOf] = useState(null);
  const [draft, setDraft] = useState("");
  const progressTimer = useRef(null);

  useEffect(() => {
    return () => {
      if (progressTimer.current) clearInterval(progressTimer.current);
    };
  }, []);

  function startFakeProgress() {
    if (progressTimer.current) clearInterval(progressTimer.current);

    progressTimer.current = setInterval(() => {
      setResults((prev) => {
        const next = { ...prev };

        for (const ticker of Object.keys(next)) {
          if (next[ticker].status === "loading") {
            const current = next[ticker].progress || 0;
            const bump = Math.floor(Math.random() * 9) + 3;
            const progress = Math.min(current + bump, 95);

            next[ticker] = {
              ...next[ticker],
              progress,
              messageIndex:
                Math.random() > 0.72
                  ? ((next[ticker].messageIndex || 0) + 1) %
                    LOADING_MESSAGES.length
                  : next[ticker].messageIndex || 0,
            };
          }
        }

        return next;
      });
    }, 900);
  }

  async function refresh() {
    if (running) return;

    setRunning(true);

    const init = {};
    holdings.forEach((h, i) => {
      init[h.ticker] = {
        status: "loading",
        progress: Math.floor(Math.random() * 8) + 3,
        messageIndex: i % LOADING_MESSAGES.length,
      };
    });

    setResults(init);
    startFakeProgress();

    try {
      const res = await fetch("/api/brief", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          holdings,
          windowKey,
        }),
      });

      if (!res.ok) throw new Error("brief failed");

      const data = await res.json();

      if (progressTimer.current) clearInterval(progressTimer.current);

      const next = {};
      for (const brief of data.briefs || []) {
        next[brief.ticker] = {
          status: "done",
          progress: 100,
          data: brief,
        };
      }

      holdings.forEach((h) => {
        if (!next[h.ticker]) {
          next[h.ticker] = { status: "error" };
        }
      });

      setResults(next);
      setAsOf(new Date());
    } catch {
      if (progressTimer.current) clearInterval(progressTimer.current);

      const fail = {};
      holdings.forEach((h) => {
        fail[h.ticker] = { status: "error" };
      });
      setResults(fail);
    }

    setRunning(false);
  }

  function addTicker() {
    const t = draft.trim().toUpperCase();
    if (!t || holdings.some((h) => h.ticker === t)) {
      setDraft("");
      return;
    }
    setHoldings((h) => [...h, { ticker: t, name: t }]);
    setDraft("");
  }

  function removeTicker(t) {
    setHoldings((h) => h.filter((x) => x.ticker !== t));
    setResults((r) => {
      const c = { ...r };
      delete c[t];
      return c;
    });
  }

  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="pb-root">
      <style>{CSS}</style>

      <header className="pb-head">
        <div className="pb-head-top">
          <div>
            <div className="pb-eyebrow">Portfolio Brief</div>
            <h1 className="pb-date">{dateStr}</h1>
          </div>

          <div className="pb-controls">
            <div className="pb-toggle">
              <button
                className={windowKey === "day" ? "on" : ""}
                onClick={() => setWindowKey("day")}
              >
                Today
              </button>
              <button
                className={windowKey === "week" ? "on" : ""}
                onClick={() => setWindowKey("week")}
              >
                This week
              </button>
              <button
                className={windowKey === "month" ? "on" : ""}
                onClick={() => setWindowKey("month")}
              >
                This month
              </button>
            </div>

            <button className="pb-refresh" onClick={refresh} disabled={running}>
              {running ? "Gathering…" : "Refresh brief"}
            </button>
          </div>
        </div>

        <div className="pb-tape">
          {holdings.map((h) => {
            const st = results[h.ticker];
            const sent = st?.data?.sentiment;
            const dot =
              st?.status === "loading"
                ? "#E8B84B"
                : st?.status === "error"
                ? "#E06B6B"
                : sent && SENT[sent]
                ? SENT[sent].color
                : "#3A4150";

            return (
              <span className="pb-tape-item" key={h.ticker}>
                <span
                  className={"pb-dot" + (st?.status === "loading" ? " pulse" : "")}
                  style={{ background: dot }}
                />
                {h.ticker}
                <button className="pb-x" onClick={() => removeTicker(h.ticker)}>
                  ×
                </button>
              </span>
            );
          })}

          <span className="pb-add">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTicker()}
              placeholder="Add ticker"
            />
          </span>
        </div>

        {asOf && (
          <div className="pb-asof">
            As of{" "}
            {asOf.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            })}{" "}
            ·{" "}
            {windowKey === "month"
              ? "past 30 days"
              : windowKey === "week"
              ? "past 7 days"
              : "past 24 hours"}
          </div>
        )}
      </header>

      <main className="pb-grid">
        {holdings.map((h) => {
          const st = results[h.ticker] || { status: "idle" };
          return <Card key={h.ticker} holding={h} state={st} />;
        })}
      </main>

      {!asOf && !running && (
        <div className="pb-empty">
          Hit <b>Refresh brief</b> to pull the latest news for your{" "}
          {holdings.length} holdings.
        </div>
      )}
    </div>
  );
}

function Card({ holding, state }) {
  const { status, data } = state;
  const sent =
    data?.sentiment && SENT[data.sentiment] ? SENT[data.sentiment] : null;

  const loadingMessage =
    LOADING_MESSAGES[state.messageIndex || 0] || LOADING_MESSAGES[0];

  return (
    <article className={"pb-card " + status}>
      <div className="pb-card-head">
        <div>
          <div className="pb-company-name">{data?.name || holding.name}</div>
          <div className="pb-company-ticker">{holding.ticker}</div>
        </div>

        {sent && (
          <span className="pb-sent" style={{ color: sent.color }}>
            <span className="pb-dot" style={{ background: sent.color }} />
            {sent.label}
          </span>
        )}
      </div>

      {status === "idle" && <div className="pb-idle">Waiting for refresh</div>}

      {status === "loading" && (
        <div className="pb-loading">
          <div className="pb-loading-msg">{loadingMessage}</div>

          <div className="pb-progress">
            <div
              className="pb-progress-fill"
              style={{ width: `${state.progress || 0}%` }}
            />
          </div>

          <div className="pb-progress-text">{state.progress || 0}%</div>
        </div>
      )}

      {status === "error" && (
        <div className="pb-err">Couldn&apos;t load this one. Try refresh again.</div>
      )}

      {status === "done" && data && (
        <>
          {data.takeaway && <p className="pb-take">{data.takeaway}</p>}

          {data.items && data.items.length > 0 ? (
            <ul className="pb-items">
              {data.items.map((it, i) => (
                <li key={i}>
                  <a
                    href={it.url || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pb-it-title"
                  >
                    {it.title}
                  </a>
                  <div className="pb-it-meta">
                    {it.source}
                    {it.date ? " · " + it.date : ""}
                  </div>
                  {it.summary && <div className="pb-it-sum">{it.summary}</div>}
                </li>
              ))}
            </ul>
          ) : (
            <div className="pb-nonews">No material news in this window.</div>
          )}
        </>
      )}
    </article>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;450;500;600&display=swap');

.pb-root{
  --bg:#0B0F17; --surface:#141A24; --surface2:#10151E; --line:#232B38;
  --ink:#E8ECF1; --mut:#8A95A5; --accent:#E8B84B;
  min-height:100vh;
  background:
    radial-gradient(1200px 500px at 80% -10%, rgba(232,184,75,.06), transparent 60%),
    var(--bg);
  color:var(--ink);
  font-family:'Inter',system-ui,sans-serif;
  -webkit-font-smoothing:antialiased;
  padding:28px 20px 60px;
}

.pb-head{max-width:1160px;margin:0 auto 22px;}
.pb-head-top{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;flex-wrap:wrap;}
.pb-eyebrow{font-family:'Space Grotesk',sans-serif;font-weight:600;letter-spacing:.22em;text-transform:uppercase;font-size:11px;color:var(--accent);}
.pb-date{font-family:'Space Grotesk',sans-serif;font-weight:600;font-size:30px;line-height:1.1;margin:6px 0 0;letter-spacing:-.01em;}
.pb-controls{display:flex;gap:10px;align-items:center;flex-wrap:wrap;}

.pb-toggle{display:flex;border:1px solid var(--line);border-radius:999px;overflow:hidden;background:var(--surface2);}
.pb-toggle button{font-family:'Space Grotesk',sans-serif;font-size:13px;font-weight:500;background:transparent;color:var(--mut);border:0;padding:8px 16px;cursor:pointer;transition:.15s;}
.pb-toggle button.on{background:var(--ink);color:var(--bg);}

.pb-refresh{font-family:'Space Grotesk',sans-serif;font-size:13px;font-weight:600;background:var(--accent);color:#1a1405;border:0;border-radius:999px;padding:9px 20px;cursor:pointer;transition:.15s;}
.pb-refresh:hover{filter:brightness(1.07);}
.pb-refresh:disabled{opacity:.55;cursor:default;}

.pb-tape{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:18px;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:var(--surface2);}
.pb-tape-item{display:inline-flex;align-items:center;gap:7px;font-family:'Space Grotesk',sans-serif;font-weight:500;font-size:13px;letter-spacing:.02em;padding:4px 6px 4px 10px;border-radius:7px;color:var(--ink);}
.pb-tape-item:hover{background:rgba(255,255,255,.03);}
.pb-dot{width:7px;height:7px;border-radius:50%;display:inline-block;flex:none;}
.pb-dot.pulse{animation:pb-pulse 1.1s ease-in-out infinite;}
@keyframes pb-pulse{0%,100%{opacity:.35;}50%{opacity:1;}}
.pb-x{background:none;border:0;color:var(--mut);cursor:pointer;font-size:15px;line-height:1;padding:0 2px;opacity:0;transition:.12s;}
.pb-tape-item:hover .pb-x{opacity:.7;}
.pb-x:hover{color:var(--ink);}
.pb-add input{background:transparent;border:0;outline:none;color:var(--ink);font-family:'Space Grotesk',sans-serif;font-size:13px;width:96px;padding:4px 6px;}
.pb-add input::placeholder{color:#566072;}
.pb-asof{margin-top:10px;font-size:12px;color:var(--mut);letter-spacing:.02em;}

.pb-grid{max-width:1160px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px;}
.pb-card{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:18px 18px 16px;min-height:150px;animation:pb-rise .35s ease both;}
@keyframes pb-rise{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:none;}}
.pb-card-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:14px;}

.pb-company-name{
  font-family:'Space Grotesk',sans-serif;
  font-weight:700;
  font-size:20px;
  line-height:1.2;
  letter-spacing:-.01em;
}

.pb-company-ticker{
  font-family:'Space Grotesk',sans-serif;
  font-size:11px;
  letter-spacing:.15em;
  text-transform:uppercase;
  color:var(--mut);
  margin-top:3px;
}

.pb-sent{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.1em;white-space:nowrap;}

.pb-take{font-size:14.5px;line-height:1.5;margin:0 0 14px;color:var(--ink);border-left:2px solid var(--accent);padding-left:11px;}
.pb-items{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:13px;}
.pb-items li{padding-bottom:13px;border-bottom:1px solid var(--line);}
.pb-items li:last-child{border-bottom:0;padding-bottom:0;}
.pb-it-title{color:var(--ink);text-decoration:none;font-weight:600;font-size:14px;line-height:1.4;display:inline-block;transition:.12s;}
.pb-it-title:hover{color:var(--accent);}
.pb-it-meta{font-family:'Space Grotesk',sans-serif;font-size:11px;color:var(--mut);margin:3px 0 4px;letter-spacing:.03em;text-transform:uppercase;}
.pb-it-sum{font-size:13px;line-height:1.5;color:#B7C0CC;}

.pb-idle{color:#566072;font-size:13px;padding:8px 0;}
.pb-nonews,.pb-err{color:var(--mut);font-size:13px;padding:4px 0;}
.pb-err{color:#E06B6B;}

.pb-loading{
  margin-top:8px;
  padding-top:4px;
}

.pb-loading-msg{
  font-family:'Space Grotesk',sans-serif;
  font-size:14px;
  font-weight:600;
  color:var(--ink);
  margin-bottom:10px;
}

.pb-progress{
  height:10px;
  border-radius:999px;
  overflow:hidden;
  background:#1B2230;
  border:1px solid #263041;
}

.pb-progress-fill{
  height:100%;
  background:linear-gradient(90deg, var(--accent), #F0D27A);
  transition:width .45s ease;
}

.pb-progress-text{
  margin-top:8px;
  font-family:'Space Grotesk',sans-serif;
  font-size:12px;
  color:var(--mut);
  letter-spacing:.04em;
}

.pb-empty{max-width:1160px;margin:30px auto 0;text-align:center;color:var(--mut);font-size:14px;}
.pb-empty b{color:var(--ink);}

@media (prefers-reduced-motion: reduce){
  .pb-card,.pb-dot.pulse{animation:none;}
  .pb-progress-fill{transition:none;}
}

@media (max-width:560px){
  .pb-date{font-size:24px;}
  .pb-grid{grid-template-columns:1fr;}
  .pb-toggle{width:100%;}
  .pb-toggle button{flex:1;}
}
`;