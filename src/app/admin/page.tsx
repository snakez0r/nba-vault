"use client";

import { useState } from "react";

// Utility: Format Date object as YYYYMMDD
function formatYyyymmdd(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

// Utility: Given start, end (YYYY-MM-DD), return array of YYYYMMDD strings, inclusive
function getDateRange(start: string, end: string): string[] {
  const arr: string[] = [];
  let d = new Date(start);
  const endD = new Date(end);
  while (d <= endD) {
    arr.push(formatYyyymmdd(d));
    d.setDate(d.getDate() + 1);
  }
  return arr;
}

export default function AdminBackfill() {
  const todayIso = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState("2025-10-21");
  const [endDate, setEndDate] = useState(todayIso);
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalDays, setTotalDays] = useState(0);
  const [currentDate, setCurrentDate] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  async function startBackfill() {
    setIsSyncing(true);
    setLogs([]);
    setProgress(0);

    const dates = getDateRange(startDate, endDate);
    setTotalDays(dates.length);

    for (const dateString of dates) {
      setCurrentDate(dateString);
      try {
        const res = await fetch(`/api/sync?date=${dateString}`);
        let info = '';
        if (res.ok) {
          const data = await res.json();
          info = data?.games_synced !== undefined
            ? `Synced ${data.games_synced} games`
            : JSON.stringify(data);
          setLogs((prev) => [
            ...prev,
            `${dateString}: ✅ ${info}`,
          ]);
        } else {
          const errText = await res.text();
          setLogs((prev) => [
            ...prev,
            `${dateString}: ❌ Error ${res.status} - ${errText}`,
          ]);
        }
      } catch (e: any) {
        setLogs((prev) => [
          ...prev,
          `${dateString}: ❌ Exception - ${e?.message || e}`,
        ]);
      }
      setProgress((p) => p + 1);
      // Wait 1s to avoid rate limiting
      await new Promise((res) => setTimeout(res, 1000));
    }

    setIsSyncing(false);
    setCurrentDate(null);
  }

  const percent =
    totalDays > 0 ? Math.round((progress / totalDays) * 100) : 0;

  return (
    <div
      className="min-h-screen bg-black flex flex-col items-center justify-center"
      style={{
        fontFamily: "Menlo, 'Fira Mono', monospace",
        color: "#00ff9c",
        letterSpacing: 0.2,
      }}
    >
      <div
        className="w-full max-w-xl mx-auto p-6 rounded-xl shadow-lg"
        style={{
          background:
            "linear-gradient(137deg, #21262d 75%, #17212e 100%)",
          border: "2px solid #222831",
        }}
      >
        <h1 className="text-2xl font-bold mb-4 text-[#ffb300] text-center tracking-wider">
          NBA Season Backfill Admin
        </h1>
        <div className="flex gap-4 mb-6 justify-center items-end">
          <div>
            <label className="block text-xs mb-1 text-gray-400">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-[#00ff9c] outline-none"
              disabled={isSyncing}
              min="2020-01-01"
              max={endDate}
            />
          </div>
          <div>
            <label className="block text-xs mb-1 text-gray-400">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-[#00ff9c] outline-none"
              disabled={isSyncing}
              min={startDate}
              max={todayIso}
            />
          </div>
          <button
            className={`px-5 py-2 rounded text-black font-bold text-lg shadow-lg transition
              ${isSyncing
                ? "bg-gray-700 cursor-not-allowed"
                : "bg-[#00ff9c] hover:bg-[#44ffb3]"}`}
            disabled={isSyncing}
            onClick={startBackfill}
          >
            {isSyncing ? "Syncing…" : "Start Season Backfill"}
          </button>
        </div>
        <div className="mb-3">
          <div className="flex justify-between mb-1 text-xs text-gray-400">
            <span>
              {isSyncing
                ? `Syncing: ${currentDate || ""}`
                : progress === totalDays && totalDays > 0
                ? "Backfill complete."
                : "Idle"}
            </span>
            <span>
              {progress} / {totalDays} days
            </span>
          </div>
          <div className="w-full h-5 rounded bg-[#15171c] border border-gray-800 overflow-hidden relative">
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${percent}%`,
                background:
                  "linear-gradient(90deg, #00ff9c 30%, #1de7c6 90%)",
                boxShadow:
                  percent > 0
                    ? "0 0 24px #00ffae, 0 0 48px #1de7c688"
                    : undefined,
                transition: "width 280ms cubic-bezier(.4,2,.3,1)"
              }}
            ></div>
          </div>
        </div>
        <div
          className="mt-6 h-64 rounded bg-[#181d22] border-2 border-[#232b34] px-3 py-2 font-mono text-sm overflow-y-auto"
          style={{
            boxShadow: "0 0 24px #00ffae33, 0 0 16px #232b3466 inset",
            maxHeight: "18rem"
          }}
        >
          {logs.length === 0 ? (
            <div className="text-gray-500">No output yet. Logs will appear here during sync.</div>
          ) : (
            <ul>
              {logs.map((entry, idx) => (
                <li key={idx} className="whitespace-pre-wrap">
                  <span
                    style={{
                      color:
                        entry.includes("✅")
                          ? "#00ff9c"
                          : entry.includes("❌")
                          ? "#ff5d5d"
                          : "#aaaaaa",
                    }}
                  >
                    {entry}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="mt-2 text-xs text-gray-600 text-center">
          <span>
            This tool runs a day-by-day sync of NBA games through the backend API. For internal/admin use only.
          </span>
        </div>
      </div>
    </div>
  );
}
