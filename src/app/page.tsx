"use client";

import { useEffect, useState } from "react";
import { getScoreboard, getSummary } from "@/lib/espn";
import { calculateWatchability } from "@/lib/math";

/**
 * Certain ESPN NBA team abbreviations do not match the team logo file names.
 * This mapping corrects ESPN API abbreviations to ESPN's logo abbreviations.
 */
const ESPN_LOGO_ABBR_MAP: Record<string, string> = {
  BRK: "BKN",
  PHX: "PHX", // Some sources use PHO, but logo CDN uses PHX
  NOR: "NOP",
  UTA: "UTA",
  SAS: "SA",
  GSW: "GS",
  NYC: "NYK",
  LAL: "LAL",
  LAC: "LAC",
  CHI: "CHI",
  BOS: "BOS",
  MIL: "MIL",
  POR: "POR",
  ATL: "ATL",
  CHA: "CHA",
  CLE: "CLE",
  DAL: "DAL",
  DEN: "DEN",
  DET: "DET",
  HOU: "HOU",
  IND: "IND",
  MIA: "MIA",
  MEM: "MEM",
  MIN: "MIN",
  OKC: "OKC",
  ORL: "ORL",
  PHI: "PHI",
  SAC: "SAC",
  TOR: "TOR",
  WAS: "WAS",
};

type WatchStyle = "Balanced" | "Clutch Thriller" | "Superstar Show";

interface GameCardData {
  eventId: string;
  awayAbbr: string;
  awayLogo: string;
  homeAbbr: string;
  homeLogo: string;
  grade: string;
  finalScore: number;
  marginSubscore: number;
  leadChangesSubscore: number;
  starPowerBonus: number;
  topPlayerMessage: string;
  isLoading?: boolean;
  awayScore?: number;
  homeScore?: number;
  rawMargin?: number;
  rawLeadChanges?: number;
  topPlayerStats?: {
    pts: number;
    reb: number;
    ast: number;
    blk: number;
    stl: number;
    displayName: string;
  };
}

const GRADE_COLOR: Record<string, string> = {
  "A+": "from-green-400 to-green-200",
  "A": "from-green-400 to-green-200",
  "A-": "from-green-400 to-green-200",
  "B+": "from-yellow-400 to-yellow-200",
  "B": "from-yellow-400 to-yellow-200",
  "B-": "from-yellow-400 to-yellow-200",
  "C+": "from-orange-400 to-orange-200",
  "C": "from-orange-400 to-orange-200",
  "C-": "from-orange-400 to-orange-200",
  "D": "from-red-500 to-red-300",
  "F": "from-red-700 to-red-400",
};

function getGradeShadowStyle(grade: string) {
  if (grade.startsWith("A"))
    return { textShadow: "0 0 24px rgba(34,197,94,0.9), 0 0 60px rgba(34,197,94,0.22)" };
  if (grade.startsWith("B"))
    return { textShadow: "0 0 20px rgba(255,215,0,0.66),0 0 40px rgba(251,191,36,0.25)" };
  if (grade.startsWith("C"))
    return { textShadow: "0 0 12px rgba(251,146,60,0.36),0 0 40px rgba(251,146,60,0.08)" };
  return { textShadow: "0 0 22px rgba(239,68,68,0.52), 0 0 40px rgba(239,68,68,0.18)" };
}

const WATCH_STYLE_LABELS: Record<WatchStyle, string> = {
  Balanced: "Balanced",
  "Clutch Thriller": "Clutch Thriller",
  "Superstar Show": "Superstar Show",
};

// Helper: Correct abbreviation for ESPN logo CDN
function getLogoAbbr(teamAbbr: string): string {
  if (!teamAbbr) return "";
  return ESPN_LOGO_ABBR_MAP[teamAbbr.toUpperCase()] || teamAbbr.toUpperCase();
}

function getESPNLogoUrl(teamAbbr: string) {
  const abbr = getLogoAbbr(teamAbbr);
  return `https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/${abbr.toLowerCase()}.png`;
}

const NBA_LOGO_FALLBACK = "https://cdn.nba.com/logos/leagues/logo-nba.svg";

function findKeyRecursive(obj: any, key: string): any {
  if (typeof obj !== "object" || obj === null) return undefined;
  if (Object.prototype.hasOwnProperty.call(obj, key)) {
    return obj[key];
  }
  for (const k in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) {
      const found = findKeyRecursive(obj[k], key);
      if (typeof found !== "undefined") return found;
    }
  }
  return undefined;
}

function abbrFromTeamName(name: string | undefined): string {
  if (!name || typeof name !== "string") return "";
  const letters = name.replace(/[^a-zA-Z]/g, "");
  if (letters.length >= 3) return letters.slice(0, 3).toUpperCase();
  const trimmed = name.trim();
  if (!trimmed) return "";
  return trimmed.slice(0, 3).toUpperCase().replace(/\s/g, "");
}

function resolveTeamAbbr(boxTeam: any, scoreboardTeam: any): string {
  const tryThree = (team: any): string => {
    const a = team?.team?.abbreviation;
    if (typeof a === "string" && a.trim().length >= 2 && a.trim().length <= 4)
      return a.trim().toUpperCase();
    return "";
  };
  let abbr = tryThree(boxTeam);
  if (abbr) return abbr;
  abbr = tryThree(scoreboardTeam);
  if (abbr) return abbr;
  const displayName =
    boxTeam?.team?.displayName ||
    boxTeam?.team?.shortDisplayName ||
    boxTeam?.team?.name ||
    scoreboardTeam?.team?.displayName ||
    scoreboardTeam?.team?.shortDisplayName ||
    scoreboardTeam?.team?.name ||
    "";
  return abbrFromTeamName(displayName);
}

function marginFromSummaryHeader(summary: any): number | undefined {
  const competitors = summary?.header?.competitions?.[0]?.competitors;
  if (!Array.isArray(competitors) || competitors.length === 0) return undefined;
  const away = competitors.find((c: any) => c.homeAway === "away") ?? competitors[0];
  const home = competitors.find((c: any) => c.homeAway === "home") ?? competitors[1];
  if (!away || !home) return undefined;
  const score0 = parseInt(String(away.score ?? ""), 10);
  const score1 = parseInt(String(home.score ?? ""), 10);
  if (!Number.isFinite(score0) || !Number.isFinite(score1)) return undefined;
  return Math.abs(score0 - score1);
}

function leadChangesFromSummary(summary: any): number {
  const teams = summary?.boxscore?.teams;
  if (!Array.isArray(teams)) {
    const fallback = findKeyRecursive(summary, "leadChanges");
    const v = parseInt(String(fallback ?? "0"), 10);
    return Number.isFinite(v) ? v : 0;
  }
  for (const t of teams) {
    const statsArray = t?.statistics ?? [];
    const leadChangesObj = statsArray.find((s: any) => s.name === "leadChanges");
    const raw = leadChangesObj?.displayValue;
    if (raw !== undefined && raw !== null && String(raw) !== "") {
      const n = parseInt(String(raw), 10);
      if (Number.isFinite(n)) return n;
    }
  }
  const statsArray = teams[0]?.statistics ?? [];
  const leadChangesObj = statsArray.find((s: any) => s.name === "leadChanges");
  const n = parseInt(String(leadChangesObj?.displayValue ?? "0"), 10);
  return Number.isFinite(n) ? n : 0;
}

function SubscoreTable({
  rawMargin,
  marginScore,
  rawLeadChanges,
  leadChangesScore,
  starPowerBonus,
}: {
  rawMargin: number | undefined;
  marginScore: number;
  rawLeadChanges: number | undefined;
  leadChangesScore: number;
  starPowerBonus: number;
}) {
  const factorClass = "px-2 py-2 font-semibold text-zinc-400";
  const statClass = "px-2 py-2 font-extrabold text-white text-base";
  const ptsClass = "px-2 py-2 font-bold";

  return (
    <div className="w-full max-w-full overflow-x-auto" style={{ minWidth: "0" }}>
      <div
        className="w-full rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl shadow-xl overflow-hidden"
      >
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="px-2 py-2 text-left text-zinc-300 font-bold bg-transparent">
                Factor
              </th>
              <th className="px-2 py-2 text-left text-zinc-400 font-bold whitespace-nowrap bg-transparent">
                Actual Stat
              </th>
              <th className="px-2 py-2 text-left text-zinc-400 font-bold whitespace-nowrap bg-transparent">
                Watchability Points
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-white/10">
              <td className={factorClass}>
                Score Margin
                <div className="text-zinc-500 text-[10px] mt-1">
                  Lower = better
                </div>
              </td>
              <td className={statClass}>
                <span className="tabular-nums">
                  {typeof rawMargin === "number" ? rawMargin : "?"}
                </span>{" "}
                <span className="text-[11px] font-normal text-zinc-400 pl-0.5">
                  pt difference
                </span>
              </td>
              <td className={`${ptsClass} text-green-300`}>
                {Math.round(marginScore)}
              </td>
            </tr>
            <tr className="border-t border-white/10">
              <td className={factorClass}>
                Lead Changes
                <div className="text-zinc-500 text-[10px] mt-1">
                  Higher = better
                </div>
              </td>
              <td className={statClass}>
                <span className="tabular-nums">
                  {typeof rawLeadChanges === "number" ? rawLeadChanges : "?"}
                </span>{" "}
                <span className="text-[11px] font-normal text-zinc-400 pl-0.5">
                  lead changes
                </span>
              </td>
              <td className={`${ptsClass} text-yellow-200`}>
                {Math.round(leadChangesScore)}
              </td>
            </tr>
            <tr className="border-t border-white/10">
              <td className={factorClass}>
                Star Power Bonus
                <div className="text-zinc-500 text-[10px] mt-1">
                  For top individual
                </div>
              </td>
              <td className={statClass}>–</td>
              <td className={`${ptsClass} text-purple-200`}>
                {Math.round(starPowerBonus)}
              </td>
            </tr>
          </tbody>
        </table>
        <div className="flex flex-col text-[11px] mt-2 gap-1 text-zinc-400 min-h-[2.5rem] px-4 pb-3 pt-2">
          <span>
            Margin: Smaller difference in final score = more watchable (closer
            finish).
          </span>
          <span>
            Lead Changes: More lead changes = more exciting, unpredictable game.
          </span>
          <span>
            Star Power: Bonus for an especially spectacular individual
            performance.
          </span>
        </div>
      </div>
    </div>
  );
}

export default function NBAWatchabilityDashboard() {
  const getDefaultDate = (): string => {
    // Default to today's date in YYYY-MM-DD; clamp at 2026-04-04 if future
    const d = new Date();
    // Clamp date to today if the current date is after today (prevents future dates)
    return d > new Date()
      ? new Date().toISOString().slice(0, 10)
      : d.toISOString().slice(0, 10);
  };

  const [date, setDate] = useState<string>(getDefaultDate());
  const [watchStyle, setWatchStyle] = useState<WatchStyle>("Balanced");
  const [gamesData, setGamesData] = useState<GameCardData[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [detailShowScore, setDetailShowScore] = useState(false);
  const [showPlayerStatline, setShowPlayerStatline] = useState(false);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  // Mobile date picker visibility state
  const [mobileDateOpen, setMobileDateOpen] = useState(false);

  function isMobile() {
    if (typeof window === "undefined") return false;
    return window.innerWidth < 1024;
  }

  useEffect(() => {
    let cancelled = false;
    async function fetchGames() {
      setLoading(true);
      setGamesData([]);
      try {
        const scoreboard = await getScoreboard(date.replaceAll("-", ""));
        const events = scoreboard?.events ?? [];

        const allGames: GameCardData[] = [];
        for (const event of events) {
          const eventId = event?.id ?? "";

          const comp = event?.competitions?.[0]?.competitors ?? [];
          const awayTeamObj =
            comp.find((c: any) => c.homeAway === "away") ?? comp[0] ?? {};
          const homeTeamObj =
            comp.find((c: any) => c.homeAway === "home") ?? comp[1] ?? {};

          let summary: any = null;
          try {
            summary = await getSummary(eventId);
          } catch {
            summary = null;
          }

          const boxTeams = Array.isArray(summary?.boxscore?.teams)
            ? summary.boxscore.teams
            : [];
          const boxAway =
            boxTeams.find((t: any) => t.homeAway === "away") ?? boxTeams[0] ?? {};
          const boxHome =
            boxTeams.find((t: any) => t.homeAway === "home") ?? boxTeams[1] ?? {};

          const awayAbbrRaw = resolveTeamAbbr(boxAway, awayTeamObj);
          const homeAbbrRaw = resolveTeamAbbr(boxHome, homeTeamObj);

          const awayAbbr = awayAbbrRaw || "NBA";
          const homeAbbr = homeAbbrRaw || "NBA";

          const awayLogo = getESPNLogoUrl(awayAbbr);
          const homeLogo = getESPNLogoUrl(homeAbbr);

          const awayScoreSb = parseInt(String(awayTeamObj?.score ?? ""), 10);
          const homeScoreSb = parseInt(String(homeTeamObj?.score ?? ""), 10);
          const sbAwayOk = Number.isFinite(awayScoreSb);
          const sbHomeOk = Number.isFinite(homeScoreSb);

          let margin: number;
          const marginFromHeader = marginFromSummaryHeader(summary);
          if (marginFromHeader !== undefined) {
            margin = marginFromHeader;
          } else if (sbAwayOk && sbHomeOk) {
            if (awayScoreSb === 0 && homeScoreSb === 0) {
              margin = 0;
            } else {
              margin = Math.abs(awayScoreSb - homeScoreSb);
            }
          } else {
            margin = 0;
          }
          if (!Number.isFinite(margin)) margin = 0;

          let leadChanges = leadChangesFromSummary(summary);
          if (!Number.isFinite(leadChanges)) leadChanges = 0;

          let topPlayer = {
            pts: 0,
            reb: 0,
            ast: 0,
            blk: 0,
            stl: 0,
            displayName: "Unknown",
          };
          let topPlayerMessage = "";

          try {
            const boxPlayers = summary?.boxscore?.players;
            let maxPts = -1;
            if (Array.isArray(boxPlayers)) {
              for (const team of boxPlayers) {
                const stats0 = team?.statistics?.[0];
                if (!stats0) continue;
                const keys = stats0.names || stats0.labels || [];
                const ptsIdx = keys.indexOf("PTS");
                const rebIdx = keys.indexOf("REB");
                const astIdx = keys.indexOf("AST");
                const blkIdx = keys.indexOf("BLK");
                const stlIdx = keys.indexOf("STL");

                if (ptsIdx !== -1) {
                  const athletes = Array.isArray(stats0.athletes)
                    ? stats0.athletes
                    : [];

                  for (const athlete of athletes) {
                    const statsArr = Array.isArray(athlete.stats)
                      ? athlete.stats
                      : [];
                    const pts = parseInt(statsArr[ptsIdx]) || 0;
                    const reb =
                      rebIdx !== -1 && statsArr[rebIdx] !== undefined
                        ? parseInt(statsArr[rebIdx]) || 0
                        : 0;
                    const ast =
                      astIdx !== -1 && statsArr[astIdx] !== undefined
                        ? parseInt(statsArr[astIdx]) || 0
                        : 0;
                    const blk =
                      blkIdx !== -1 && statsArr[blkIdx] !== undefined
                        ? parseInt(statsArr[blkIdx]) || 0
                        : 0;
                    const stl =
                      stlIdx !== -1 && statsArr[stlIdx] !== undefined
                        ? parseInt(statsArr[stlIdx]) || 0
                        : 0;
                    const name =
                      athlete?.athlete?.displayName ||
                      athlete?.displayName ||
                      athlete?.shortName ||
                      "Unknown";

                    if (pts > maxPts) {
                      maxPts = pts;
                      topPlayer = {
                        pts,
                        reb,
                        ast,
                        blk,
                        stl,
                        displayName: name,
                      };
                    }
                  }
                }
              }
            }
            if (maxPts > -1) {
              topPlayerMessage = `${topPlayer.displayName}: ${topPlayer.pts} pts, ${topPlayer.reb} reb, ${topPlayer.ast} ast`;
            }
          } catch {
            topPlayer = {
              pts: 0,
              reb: 0,
              ast: 0,
              blk: 0,
              stl: 0,
              displayName: "Unknown",
            };
            topPlayerMessage = "";
          }

          ["pts", "reb", "ast", "blk", "stl"].forEach((key) => {
            const n = Number((topPlayer as any)[key]);
            (topPlayer as any)[key] = Number.isFinite(n) ? n : 0;
          });
          const playerName =
            typeof topPlayer.displayName === "string" &&
            topPlayer.displayName.trim()
              ? topPlayer.displayName.trim()
              : "Unknown";
          topPlayer.displayName = playerName;

          let calc = null;
          try {
            calc = calculateWatchability(
              margin,
              leadChanges,
              {
                pts: topPlayer.pts,
                reb: topPlayer.reb,
                ast: topPlayer.ast,
                blk: topPlayer.blk,
                stl: topPlayer.stl,
                name: playerName,
              },
              watchStyle
            );
          } catch (e) {
            calc = {
              grade: "?",
              finalScore: 0,
              marginSubscore: 0,
              leadChangesSubscore: 0,
              starPowerBonus: 0,
              topPlayerMessage: "",
            };
          }

          let awayScore = sbAwayOk ? awayScoreSb : undefined;
          let homeScore = sbHomeOk ? homeScoreSb : undefined;

          allGames.push({
            eventId,
            awayAbbr: awayAbbr,
            awayLogo,
            homeAbbr: homeAbbr,
            homeLogo,
            grade: calc?.grade ?? "?",
            finalScore: calc?.finalScore ?? 0,
            marginSubscore: calc?.marginSubscore ?? 0,
            leadChangesSubscore: calc?.leadChangesSubscore ?? 0,
            starPowerBonus: calc?.starPowerBonus ?? 0,
            topPlayerMessage: calc?.topPlayerMessage ?? topPlayerMessage ?? "",
            isLoading: false,
            awayScore,
            homeScore,
            rawMargin: Number.isFinite(margin) ? margin : undefined,
            rawLeadChanges: Number.isFinite(leadChanges) ? leadChanges : undefined,
            topPlayerStats: { ...topPlayer },
          });
        }
        if (!cancelled) setGamesData(allGames);
      } catch (e) {
        if (!cancelled) setGamesData([]);
      }
      setLoading(false);
    }
    fetchGames();
    return () => {
      cancelled = true;
    };
  }, [date, watchStyle]);

  useEffect(() => {
    if (gamesData.length === 0) {
      setSelectedEventId(null);
      return;
    }
    setSelectedEventId((prev) => {
      if (prev && gamesData.some((g) => g.eventId === prev)) return prev;
      return gamesData[0]?.eventId ?? null;
    });
  }, [gamesData]);

  useEffect(() => {
    setDetailShowScore(false);
    setShowPlayerStatline(false);
  }, [selectedEventId]);

  const selectedGame =
    gamesData.find((g) => g.eventId === selectedEventId) ?? null;

  const statlineAvailable =
    selectedGame &&
    selectedGame.topPlayerStats &&
    typeof selectedGame.topPlayerStats.pts === "number" &&
    (selectedGame.topPlayerStats.pts > 0 ||
      selectedGame.topPlayerStats.reb > 0 ||
      selectedGame.topPlayerStats.ast > 0 ||
      selectedGame.topPlayerStats.blk > 0 ||
      selectedGame.topPlayerStats.stl > 0);

  // Sidebar open/close for mobile
  function handleSidebarToggle() {
    setShowSidebar((s) => !s);
  }

  // For mobile, close sidebar on navigation
  useEffect(() => {
    if (!isMobile()) {
      setShowSidebar(false);
    }
  }, []);

  // Responsive root: flex-col for mobile, row for desktop
  return (
    <div className="min-h-screen min-h-0 bg-zinc-950 text-zinc-100 flex flex-col lg:flex-row overflow-hidden">
      {/* Mobile topbar date picker (hidden on lg+) */}
      <div className="flex lg:hidden items-center justify-center w-full px-2 pt-4 pb-2 bg-zinc-950 z-20">
        <button
          className="flex items-center gap-2 rounded-lg px-4 py-2 bg-zinc-800 hover:bg-zinc-700 transition text-sm font-semibold text-white shadow border border-zinc-900"
          onClick={() => setMobileDateOpen(true)}
        >
          <svg
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="inline-block mr-1"
          >
            <rect x="3" y="4" width="12" height="11" rx="2" />
            <path d="M16 7H2" />
            <path d="M7 2v2" />
            <path d="M11 2v2" />
          </svg>
          <span>
            Date:{" "}
            <span className="font-bold text-cyan-200">{date}</span>
          </span>
        </button>
        {/* Date modal for mobile */}
        {mobileDateOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setMobileDateOpen(false)}>
            <div
              className="bg-zinc-900 rounded-2xl shadow-xl p-6 mx-4 max-w-xs w-full flex flex-col items-center"
              onClick={(e) => e.stopPropagation()}
            >
              <label htmlFor="mob-date" className="block text-sm font-semibold mb-2 text-zinc-200 text-center">
                Select date
              </label>
              <input
                id="mob-date"
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                min="2023-10-20"
                value={date}
                onChange={e => {
                  setDate(e.target.value);
                  setMobileDateOpen(false);
                }}
                className="rounded-md px-4 py-3 text-zinc-900 w-full bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-400 font-medium"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setMobileDateOpen(false)}
                className="mt-6 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-sm transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
      {/* Sidebar: mobile fixed slide-in left, desktop static */}
      {/* Overlay for mobile sidebar menu */}
      {showSidebar && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 transition-opacity lg:hidden"
          onClick={() => setShowSidebar(false)}
          aria-label="Close sidebar overlay"
        />
      )}
      {/* Sidebar itself */}
      <aside
        className={`
          fixed z-50 inset-y-0 left-0 w-4/5 max-w-xs bg-zinc-900/95 shadow-2xl border-r border-zinc-800 h-full transform transition-transform duration-300 ease-in-out
          ${showSidebar ? "translate-x-0" : "-translate-x-full"}
          lg:static lg:translate-x-0 lg:shadow-none lg:bg-zinc-900/85 lg:border-b-0 lg:border-r
        `}
        style={{
          minHeight: 0,
          minWidth: 0,
        }}
        tabIndex={-1}
        aria-modal="true"
        role="navigation"
      >
        <div className="relative h-full flex flex-col p-4 sm:p-6 md:p-8">
          {/* Close button for mobile */}
          <button
            aria-label="Close sidebar"
            onClick={() => setShowSidebar(false)}
            className="absolute right-3 top-3 z-10 lg:hidden p-2 rounded-full bg-black/30 hover:bg-black/60 text-white"
            style={{ display: showSidebar ? "block" : "none" }}
          >
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
          <h1 className="text-2xl font-black tracking-tight mb-8 flex justify-between items-end">
            NBA Watchability
            <span className="hidden md:inline text-zinc-400 font-medium text-base ml-0.5">
              {" "}
              Dashboard
            </span>
          </h1>
          <div className="mb-8 hidden lg:block">
            <label className="block text-sm font-semibold mb-2" htmlFor="date">
              Date
            </label>
            <input
              id="date"
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              min="2023-10-20"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-md px-3 py-2 text-zinc-900 w-full bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-400 font-medium mt-1"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-2">
              Watch Style
            </label>
            <div className="flex flex-col gap-1">
              {(Object.keys(WATCH_STYLE_LABELS) as WatchStyle[]).map((style) => (
                <label
                  key={style}
                  className="flex items-center gap-2 cursor-pointer select-none"
                >
                  <input
                    type="radio"
                    value={style}
                    checked={watchStyle === style}
                    onChange={() => setWatchStyle(style)}
                    className="accent-blue-500"
                  />
                  <span className="font-medium">{WATCH_STYLE_LABELS[style]}</span>
                </label>
              ))}
            </div>
          </div>
          <span className="mt-auto text-xs text-zinc-500 pt-8 pb-2 block">
            Powered by ESPN NBA & Next.js 14
          </span>
        </div>
      </aside>

      {/* Mobile: hamburger */}
      <button
        aria-label="Open menu"
        className="fixed left-3 top-3 z-30 p-2 rounded-full bg-zinc-800/90 hover:bg-zinc-700 text-white shadow-md border border-zinc-900 lg:hidden"
        onClick={handleSidebarToggle}
        style={{ display: showSidebar ? "none" : "inline-flex" }}
      >
        <svg width="25" height="25" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="7" x2="21" y2="7" />
          <line x1="4" y1="13" x2="21" y2="13" />
          <line x1="4" y1="19" x2="21" y2="19" />
        </svg>
      </button>

      <main className="flex-1 flex flex-col min-h-0 min-w-0">
        {loading && (
          <div className="w-full text-center text-lg py-10 animate-pulse shrink-0 p-8">
            Loading games...
          </div>
        )}
        {!loading && gamesData.length === 0 && (
          <div className="p-8 text-lg font-semibold text-zinc-400">
            No NBA games found for {date}
          </div>
        )}
        {!loading && gamesData.length > 0 && (
          <div className="flex flex-1 flex-col lg:flex-row min-h-0 min-w-0">
            {/* Game list */}
            <div className="w-full lg:w-1/2 lg:max-w-[50%] shrink-0 border-b lg:border-b-0 lg:border-r border-zinc-800 flex flex-col min-h-0 min-w-0">
              <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-2 sm:pb-3 shrink-0">
                <h2 className="text-lg font-semibold text-zinc-100">
                  Games for {date}
                </h2>
                <p className="text-xs text-zinc-500 mt-1">
                  Select a game to view the full breakdown.
                </p>
              </div>
              <ul className="flex-1 overflow-y-auto px-2 sm:px-4 pb-4 sm:pb-6 space-y-2 min-h-0">
                {gamesData.map((game, idx) => {
                  const isSelected = game.eventId === selectedEventId;
                  // Modification: Give the selected tile a non-transparent background in mobile view when mobileDetailOpen.
                  const selectedMobileBg = isSelected && mobileDetailOpen
                    ? "bg-zinc-900 border-cyan-500/60 ring-2 ring-cyan-600/20"
                    : "";
                  return (
                    <li key={game.eventId || idx}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedEventId(game.eventId);
                          if (isMobile()) setMobileDetailOpen(true);
                          if (isMobile()) setShowSidebar(false);
                        }}
                        className={`
                          w-full text-left rounded-xl px-2 sm:px-4 py-2 sm:py-3 flex items-center gap-2 sm:gap-3
                          border transition-colors
                          ${
                            isSelected
                              ? `bg-white/[0.03] border-cyan-500/50 ring-1 ring-cyan-500/30 ${selectedMobileBg}`
                              : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                          }
                        `}
                        style={
                          // Ensure that the background is NOT transparent if mobile + selected + mobileDetailOpen
                          isSelected && mobileDetailOpen
                            ? { backgroundColor: "#18181b" } // Tailwind bg-zinc-900
                            : undefined
                        }
                      >
                        <span className="flex items-center justify-center rounded-full bg-white/5 w-8 h-8 sm:w-10 sm:h-10 mr-1 overflow-hidden shrink-0">
                          <img
                            src={game.awayLogo}
                            alt=""
                            width={40}
                            height={40}
                            className="w-8 h-8 sm:w-10 sm:h-10 object-contain rounded-full"
                            loading="lazy"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = NBA_LOGO_FALLBACK;
                            }}
                          />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 sm:gap-2">
                            <span className="text-xs sm:text-sm font-bold text-zinc-100 truncate">
                              {game.awayAbbr}{" "}
                              <span className="text-zinc-500 font-normal">vs</span>{" "}
                              {game.homeAbbr}
                            </span>
                            <span
                              className={`
                                text-lg sm:text-2xl font-black tracking-tight shrink-0 select-none bg-clip-text text-transparent
                                bg-gradient-to-br ${GRADE_COLOR[game.grade] ?? "from-zinc-400 to-zinc-200"}
                              `}
                              style={getGradeShadowStyle(game.grade)}
                            >
                              {game.grade}
                            </span>
                          </div>
                          <div className="text-[10px] sm:text-[11px] text-zinc-500 mt-0.5">
                            Watchability {game.finalScore}/100 · {WATCH_STYLE_LABELS[watchStyle]}
                          </div>
                        </div>
                        <span className="flex items-center justify-center rounded-full bg-white/5 w-8 h-8 sm:w-10 sm:h-10 ml-1 overflow-hidden shrink-0">
                          <img
                            src={game.homeLogo}
                            alt=""
                            width={40}
                            height={40}
                            className="w-8 h-8 sm:w-10 sm:h-10 object-contain rounded-full"
                            loading="lazy"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = NBA_LOGO_FALLBACK;
                            }}
                          />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
            {/* Desktop detail: visible on large screens */}
            <div className="flex-1 min-w-0 min-h-0 overflow-y-auto p-3 sm:p-6 lg:p-8 hidden lg:block">
              {selectedGame ? (
                <div className="max-w-3xl mx-auto flex flex-col gap-4 sm:gap-6 pb-6 sm:pb-8">
                  <div className="w-full flex flex-col gap-2 sm:gap-0 sm:flex-row items-center justify-between border-b border-white/10 pb-6 mb-4 bg-transparent">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-zinc-500 mb-1">
                        Selected matchup
                      </p>
                      <h3 className="text-2xl font-bold text-zinc-100">
                        {selectedGame.awayAbbr}{" "}
                        <span className="text-zinc-500 font-normal">vs</span>{" "}
                        {selectedGame.homeAbbr}
                      </h3>
                    </div>
                    <div className="flex items-center justify-center gap-3 sm:gap-5 mt-2 sm:mt-0">
                      <span className="flex items-center justify-center rounded-full bg-white/5 w-[60px] sm:w-[72px] h-[60px] sm:h-[72px] overflow-hidden">
                        <img
                          src={selectedGame.awayLogo}
                          alt={selectedGame.awayAbbr}
                          width={72}
                          height={72}
                          className="w-[60px] sm:w-[72px] h-[60px] sm:h-[72px] object-contain rounded-full"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = NBA_LOGO_FALLBACK;
                          }}
                        />
                      </span>
                      <span
                        className={`text-4xl sm:text-6xl md:text-7xl font-black tracking-tight select-none bg-clip-text text-transparent 
                          bg-gradient-to-br ${GRADE_COLOR[selectedGame.grade] ?? "from-zinc-400 to-zinc-200"}`
                        }
                        style={getGradeShadowStyle(selectedGame.grade)}
                      >
                        {selectedGame.grade}
                      </span>
                      <span className="flex items-center justify-center rounded-full bg-white/5 w-[60px] sm:w-[72px] h-[60px] sm:h-[72px] overflow-hidden">
                        <img
                          src={selectedGame.homeLogo}
                          alt={selectedGame.homeAbbr}
                          width={72}
                          height={72}
                          className="w-[60px] sm:w-[72px] h-[60px] sm:h-[72px] object-contain rounded-full"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = NBA_LOGO_FALLBACK;
                          }}
                        />
                      </span>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-3 sm:p-4 backdrop-blur-xl shadow-xl mb-1">
                    <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 mb-4">
                      <span className="text-xs sm:text-sm font-semibold text-zinc-300">
                        Overall score:{" "}
                        <span className="text-white tabular-nums">
                          {selectedGame.finalScore}
                        </span>
                        <span className="text-zinc-500">/100</span>
                      </span>
                      <button
                        type="button"
                        className="rounded-lg px-2 py-1 sm:px-4 sm:py-2 bg-white/10 hover:bg-white/15 text-xs sm:text-sm font-semibold text-purple-200/90 border border-purple-600/40 transition backdrop-blur-sm"
                        onClick={() => setDetailShowScore((v) => !v)}
                      >
                        {detailShowScore ? "Hide final score" : "Show final score"}
                      </button>
                    </div>
                    {detailShowScore && (
                      <div className="mb-3 sm:mb-4 text-center sm:text-left text-lg sm:text-xl font-bold text-purple-300/95">
                        {typeof selectedGame.awayScore === "number" &&
                        typeof selectedGame.homeScore === "number" ? (
                          <span>
                            {selectedGame.awayAbbr}{" "}
                            <span className="font-black text-2xl sm:text-3xl tabular-nums">
                              {selectedGame.awayScore}
                            </span>
                            {" — "}
                            <span className="font-black text-2xl sm:text-3xl tabular-nums">
                              {selectedGame.homeScore}
                            </span>{" "}
                            {selectedGame.homeAbbr}
                            <span className="block text-xs sm:text-sm font-medium text-zinc-400 mt-2">
                              {selectedGame.awayScore === selectedGame.homeScore
                                ? "Tied"
                                : selectedGame.awayScore > selectedGame.homeScore
                                ? `${selectedGame.awayAbbr} won`
                                : `${selectedGame.homeAbbr} won`}
                            </span>
                          </span>
                        ) : (
                          <span className="text-zinc-400 text-xs sm:text-sm">
                            Score unavailable
                          </span>
                        )}
                      </div>
                    )}
                    <div>
                      <button
                        type="button"
                        className={`
                          text-xs sm:text-sm text-cyan-200/90 leading-relaxed border-t border-white/10 pt-2 sm:pt-4 transition
                          w-full text-left font-medium hover:text-cyan-100 focus:outline-none
                          ${statlineAvailable ? "cursor-pointer" : "cursor-default"}
                        `}
                        disabled={!statlineAvailable}
                        style={{ background: "none" }}
                        onClick={() => {
                          if (statlineAvailable)
                            setShowPlayerStatline((v) => !v);
                        }}
                        aria-expanded={showPlayerStatline}
                        aria-controls="player-statline-detail"
                        tabIndex={statlineAvailable ? 0 : -1}
                      >
                        <span>
                          {selectedGame.topPlayerMessage ||
                            "No top player line available."}
                          {statlineAvailable && (
                            <span className="ml-2 text-[11px] text-purple-300 underline">
                              {showPlayerStatline
                                ? "(hide statline)"
                                : "(show statline)"}
                            </span>
                          )}
                        </span>
                      </button>
                      {showPlayerStatline && statlineAvailable && (
                        <div
                          id="player-statline-detail"
                          className="pt-2 text-[13px] sm:text-[15px] text-zinc-200/90 font-semibold flex flex-wrap gap-6"
                        >
                          <div>
                            <span className="font-bold text-cyan-300">
                              {selectedGame.topPlayerStats?.displayName}
                            </span>
                            <span className="ml-2">
                              <span className="font-semibold text-purple-200">
                                {selectedGame.topPlayerStats?.pts}
                              </span>{" "}
                              pts
                              {", "}
                              <span className="font-semibold text-cyan-200">
                                {selectedGame.topPlayerStats?.reb}
                              </span>{" "}
                              reb
                              {", "}
                              <span className="font-semibold text-cyan-200">
                                {selectedGame.topPlayerStats?.ast}
                              </span>{" "}
                              ast
                              {", "}
                              <span className="font-semibold text-cyan-200">
                                {selectedGame.topPlayerStats?.blk}
                              </span>{" "}
                              blk
                              {", "}
                              <span className="font-semibold text-cyan-200">
                                {selectedGame.topPlayerStats?.stl}
                              </span>{" "}
                              stl
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-2 sm:mb-3">
                      Factor breakdown
                    </h4>
                    <SubscoreTable
                      rawMargin={selectedGame.rawMargin}
                      marginScore={selectedGame.marginSubscore}
                      rawLeadChanges={selectedGame.rawLeadChanges}
                      leadChangesScore={selectedGame.leadChangesSubscore}
                      starPowerBonus={selectedGame.starPowerBonus}
                    />
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-zinc-500 text-center px-4">
                  Select a game from the list to see details.
                </div>
              )}
            </div>

            {/* Mobile detail (bottom sheet, full-width) */}
            <div
              className={`
                fixed inset-x-0 bottom-0 z-50 flex items-end lg:hidden
                ${mobileDetailOpen ? "visible opacity-100" : "invisible opacity-0 pointer-events-none"}
                transition-all duration-300
              `}
              style={
                mobileDetailOpen
                  ? { pointerEvents: "auto" as React.CSSProperties["pointerEvents"] }
                  : {}
              }
              onClick={() => {
                setMobileDetailOpen(false);
              }}
              aria-modal="true"
              role="dialog"
            >
              <div
                className={`
                  w-full max-w-full h-[92vh] rounded-t-3xl bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/[0.06] to-[#111] flex flex-col items-center p-3 pt-7 pb-7 relative shadow-2xl
                  transition-transform duration-300
                  ${mobileDetailOpen ? "translate-y-0" : "translate-y-full"}
                `}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className="absolute right-4 top-4 z-10 lg:hidden p-2 rounded-full bg-black/40 hover:bg-black/60 text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMobileDetailOpen(false);
                  }}
                  style={{ display: mobileDetailOpen ? "block" : "none" }}
                  aria-label="Close detail"
                >
                  <svg
                    width="24"
                    height="24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
                {selectedGame ? (
                  <div className="w-full max-w-lg mx-auto flex flex-col gap-4 pb-0 animate-in fade-in slide-in-from-bottom-4 duration-400">
                    <div className="w-full flex flex-col items-center gap-4 border-b border-white/20 pb-5 mb-2">
                      <div className="flex gap-5 items-center">
                        <span className="flex items-center justify-center rounded-full bg-white/5 w-16 h-16 overflow-hidden">
                          <img
                            src={selectedGame.awayLogo}
                            alt={selectedGame.awayAbbr}
                            width={64}
                            height={64}
                            className="w-16 h-16 object-contain rounded-full"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src =
                                NBA_LOGO_FALLBACK;
                            }}
                          />
                        </span>
                        <span
                          className={`text-5xl font-black tracking-tight select-none bg-clip-text text-transparent 
                            bg-gradient-to-br ${
                              GRADE_COLOR[selectedGame.grade] ??
                              "from-zinc-400 to-zinc-200"
                            }`}
                          style={getGradeShadowStyle(selectedGame.grade)}
                        >
                          {selectedGame.grade}
                        </span>
                        <span className="flex items-center justify-center rounded-full bg-white/5 w-16 h-16 overflow-hidden">
                          <img
                            src={selectedGame.homeLogo}
                            alt={selectedGame.homeAbbr}
                            width={64}
                            height={64}
                            className="w-16 h-16 object-contain rounded-full"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src =
                                NBA_LOGO_FALLBACK;
                            }}
                          />
                        </span>
                      </div>
                      <div className="flex flex-col items-center mt-1">
                        <span className="text-base font-bold text-zinc-100">
                          {selectedGame.awayAbbr}{" "}
                          <span className="text-zinc-500 font-normal">vs</span>{" "}
                          {selectedGame.homeAbbr}
                        </span>
                        <span className="text-xs uppercase tracking-widest text-zinc-400 mt-0.5">
                          Game details
                        </span>
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-2 sm:p-4 backdrop-blur-xl shadow-xl mb-1">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <span className="text-xs font-semibold text-zinc-300">
                          Overall score:{" "}
                          <span className="text-white tabular-nums">
                            {selectedGame.finalScore}
                          </span>
                          <span className="text-zinc-500">/100</span>
                        </span>
                        <button
                          type="button"
                          className="rounded-lg px-3 py-1 bg-white/10 hover:bg-white/15 text-xs font-semibold text-purple-200/90 border border-purple-600/40 transition backdrop-blur-sm"
                          onClick={() => setDetailShowScore((v) => !v)}
                        >
                          {detailShowScore ? "Hide final score" : "Show final score"}
                        </button>
                      </div>
                      {detailShowScore && (
                        <div className="mb-2 text-center text-lg font-bold text-purple-300/95">
                          {typeof selectedGame.awayScore === "number" &&
                          typeof selectedGame.homeScore === "number" ? (
                            <span>
                              {selectedGame.awayAbbr}{" "}
                              <span className="font-black text-2xl tabular-nums">
                                {selectedGame.awayScore}
                              </span>
                              {" — "}
                              <span className="font-black text-2xl tabular-nums">
                                {selectedGame.homeScore}
                              </span>{" "}
                              {selectedGame.homeAbbr}
                              <span className="block text-xs font-medium text-zinc-400 mt-2">
                                {selectedGame.awayScore ===
                                selectedGame.homeScore
                                  ? "Tied"
                                  : selectedGame.awayScore >
                                    selectedGame.homeScore
                                  ? `${selectedGame.awayAbbr} won`
                                  : `${selectedGame.homeAbbr} won`}
                              </span>
                            </span>
                          ) : (
                            <span className="text-zinc-400 text-xs">
                              Score unavailable
                            </span>
                          )}
                        </div>
                      )}
                      <div>
                        <button
                          type="button"
                          className={`
                            text-xs text-cyan-200/90 leading-relaxed border-t border-white/10 pt-2 transition
                            w-full text-left font-medium hover:text-cyan-100 focus:outline-none
                            ${statlineAvailable ? "cursor-pointer" : "cursor-default"}
                          `}
                          disabled={!statlineAvailable}
                          style={{ background: "none" }}
                          onClick={() => {
                            if (statlineAvailable)
                              setShowPlayerStatline((v) => !v);
                          }}
                          aria-expanded={showPlayerStatline}
                          aria-controls="player-statline-detail"
                          tabIndex={statlineAvailable ? 0 : -1}
                        >
                          <span>
                            {selectedGame.topPlayerMessage ||
                              "No top player line available."}
                            {statlineAvailable && (
                              <span className="ml-2 text-[11px] text-purple-300 underline">
                                {showPlayerStatline
                                  ? "(hide statline)"
                                  : "(show statline)"}
                              </span>
                            )}
                          </span>
                        </button>
                        {showPlayerStatline && statlineAvailable && (
                          <div
                            id="player-statline-detail"
                            className="pt-2 text-[13px] text-zinc-200/90 font-semibold flex flex-wrap gap-4"
                          >
                            <div>
                              <span className="font-bold text-cyan-300">
                                {selectedGame.topPlayerStats?.displayName}
                              </span>
                              <span className="ml-2">
                                <span className="font-semibold text-purple-200">
                                  {selectedGame.topPlayerStats?.pts}
                                </span>{" "}
                                pts
                                {", "}
                                <span className="font-semibold text-cyan-200">
                                  {selectedGame.topPlayerStats?.reb}
                                </span>{" "}
                                reb
                                {", "}
                                <span className="font-semibold text-cyan-200">
                                  {selectedGame.topPlayerStats?.ast}
                                </span>{" "}
                                ast
                                {", "}
                                <span className="font-semibold text-cyan-200">
                                  {selectedGame.topPlayerStats?.blk}
                                </span>{" "}
                                blk
                                {", "}
                                <span className="font-semibold text-cyan-200">
                                  {selectedGame.topPlayerStats?.stl}
                                </span>{" "}
                                stl
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                        Factor breakdown
                      </h4>
                      <SubscoreTable
                        rawMargin={selectedGame.rawMargin}
                        marginScore={selectedGame.marginSubscore}
                        rawLeadChanges={selectedGame.rawLeadChanges}
                        leadChangesScore={selectedGame.leadChangesSubscore}
                        starPowerBonus={selectedGame.starPowerBonus}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-zinc-500 text-center px-4">
                    Select a game from the list to see details.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}