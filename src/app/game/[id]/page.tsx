"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

// --- HELPERS ---
const TEAM_ABBR_MAP: Record<string, string> = {
  GOL: "gsw", GS: "gsw", UTAH: "utah", UTA: "utah", BKN: "bkn", BRK: "bkn",
  PHX: "phx", PHO: "phx", NY: "nyk", NYK: "nyk", NO: "no", NOP: "no",
  SA: "sas", SAS: "sas", WSH: "wsh", WAS: "wsh",
};

function getESPNLogoUrl(abbr: string) {
  if (!abbr) return "https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/nba.png";
  const displayAbbr = TEAM_ABBR_MAP[abbr.toUpperCase()] || abbr;
  return `https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/${displayAbbr.toLowerCase()}.png`;
}

function getGrade(score: number) {
  if (score >= 90) return { letter: "A+", color: "text-emerald-400", shadow: "rgba(52, 211, 153, 0.6)" };
  if (score >= 80) return { letter: "A", color: "text-emerald-400", shadow: "rgba(52, 211, 153, 0.6)" };
  if (score >= 70) return { letter: "B", color: "text-blue-400", shadow: "rgba(96, 165, 250, 0.6)" };
  if (score >= 60) return { letter: "C", color: "text-yellow-400", shadow: "rgba(250, 204, 21, 0.6)" };
  if (score >= 50) return { letter: "D", color: "text-orange-400", shadow: "rgba(247, 240, 235, 0.6)" };
  return { letter: "F", color: "text-red-500", shadow: "rgba(239, 68, 68, 0.6)" };
}

// --- SINGLETON SUPABASE CLIENT (to avoid Multiple GoTrueClient instances in browser) ---
let supabaseSingleton: ReturnType<typeof createClient> | null = null;
function getSupabaseClient() {
  if (!supabaseSingleton) {
    supabaseSingleton = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return supabaseSingleton;
}

// --- ESPN LEADER EXTRACTOR (Safe Parser for deeply nested JSON) ---
type StatType = "points" | "rebounds" | "assists";

type TeamLeadersStats = {
  [K in StatType]?: {
    shortName: string;
    value: string;
  };
};

function getESPNTeamLeaders(
  teamLeadersObj: any
): TeamLeadersStats {
  // teamLeadersObj (one element from espnData.leaders[]) is for a team
  const result: TeamLeadersStats = {};

  if (!teamLeadersObj || !Array.isArray(teamLeadersObj.leaders)) return result;

  const statTypes: StatType[] = ["points", "rebounds", "assists"];
  for (const statType of statTypes) {
    const cat = teamLeadersObj.leaders.find(
      (c: any) => c && typeof c.name === "string" && c.name.toLowerCase() === statType
    );
    // cat is a category object { name: 'points', leaders:[{athlete, displayValue}] }
    if (
      cat &&
      Array.isArray(cat.leaders) &&
      cat.leaders[0] &&
      typeof cat.leaders[0].displayValue === "string" &&
      cat.leaders[0].athlete &&
      typeof cat.leaders[0].athlete.shortName === "string"
    ) {
      result[statType] = {
        shortName: cat.leaders[0].athlete.shortName,
        value: cat.leaders[0].displayValue
      };
    }
  }
  return result;
}

export default function GameDetailPage() {
  const params = useParams();
  const [game, setGame] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [espnData, setEspnData] = useState<any>(null);

  // (Rest unchanged: isSpoiled state, supabase ref)
  const [isSpoiled, setIsSpoiled] = useState(true);
  const supabase = useRef<ReturnType<typeof createClient>>(getSupabaseClient()).current;

  useEffect(() => {
    async function fetchGame() {
      if (!params?.id) return;
      const { data } = await supabase
        .from("nba_games")
        .select("*")
        .eq("id", params.id)
        .single();

      if (data) setGame(data);
      setLoading(false);

      // Fetch ESPN live data after loading game info
      try {
        const resp = await fetch(
          `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${params.id}`
        );
        if (resp.ok) {
          const json = await resp.json();
          setEspnData(json);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error fetching ESPN summary", err);
      }
    }
    fetchGame();
    // es-lint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center text-zinc-500 space-y-4">
        <div className="text-2xl font-bold">Game Not Found</div>
        <Link href="/teams" className="text-amber-500 hover:underline">Return to Teams</Link>
      </div>
    );
  }

  const grade = getGrade(game.watchability_score || 0);

  function blurIfSpoiler(el: React.ReactNode) {
    return (
      <span
        className={
          isSpoiled
            ? ""
            : "blur-sm select-none pointer-events-none brightness-50 transition duration-300"
        }
        style={
          !isSpoiled
            ? {
                filter: "blur(8px) brightness(0.7)",
                userSelect: "none"
              }
            : undefined
        }
      >
        {el}
      </span>
    );
  }

  // ------- EXTRACT TEAM LEADER DATA -------
  // Find away/home leaders safely from new ESPN format (leaders is array of 2 team objects)
  let awayStats: TeamLeadersStats = {};
  let homeStats: TeamLeadersStats = {};
  if (
    espnData &&
    Array.isArray(espnData.leaders) &&
    espnData.leaders.length === 2
  ) {
    // Try to match using id if available, else fallback to index 0 = away, 1 = home
    const competitors = espnData?.competitions?.[0]?.competitors || [];
    let awayTeamId = competitors[0]?.id, homeTeamId = competitors[1]?.id;

    // Find which leaders obj matches away/home
    let team1 = espnData.leaders[0], team2 = espnData.leaders[1];
    let idxAway = 0, idxHome = 1;
    // Try to match by leader team's id if present for safety
    if (
      typeof awayTeamId === "string" &&
      typeof homeTeamId === "string" &&
      team1?.teamId &&
      team2?.teamId
    ) {
      if (team1.teamId === homeTeamId && team2.teamId === awayTeamId) {
        idxAway = 1; idxHome = 0;
      }
    }
    awayStats = getESPNTeamLeaders(espnData.leaders[idxAway]);
    homeStats = getESPNTeamLeaders(espnData.leaders[idxHome]);
  }

  // Data for displaying team names
  const awayAbbr = game.away_team;
  const homeAbbr = game.home_team;
  const awayFull = espnData?.competitions?.[0]?.competitors?.[0]?.team?.displayName || awayAbbr;
  const homeFull = espnData?.competitions?.[0]?.competitors?.[1]?.team?.displayName || homeAbbr;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8 pt-24 flex flex-col items-center font-sans">
      
      {/* HERO SCOREBOARD */}
      <div className="w-full max-w-4xl bg-[#111] border border-white/5 rounded-3xl p-8 md:p-12 shadow-2xl relative overflow-hidden flex flex-col items-center">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-amber-500/10 blur-[100px] pointer-events-none" />
        <div className="text-zinc-500 tracking-widest uppercase text-sm font-bold mb-8 z-10">
          {game.date}
        </div>
        <div className="flex w-full items-center justify-between z-10">
          {/* Away Team */}
          <Link href={`/team/${game.away_team.toLowerCase()}`} className="flex flex-col items-center gap-4 group">
            <img src={getESPNLogoUrl(game.away_team)} alt={game.away_team} className="w-24 h-24 md:w-32 md:h-32 group-hover:scale-110 transition-transform drop-shadow-xl" />
            <div className="text-4xl font-black text-zinc-300">{game.away_score}</div>
          </Link>
          {/* Center Info / Grade */}
          <div className="flex flex-col items-center gap-2">
            <div className="text-zinc-600 font-mono text-sm">FINAL</div>
            <div 
              className={`text-8xl font-black ${grade.color}`}
              style={{ textShadow: `0 0 40px ${grade.shadow}` }}
            >
              {grade.letter}
            </div>
            <div className="text-zinc-400 font-bold uppercase tracking-widest text-xs mt-2">
              Watchability: {game.watchability_score}
            </div>
          </div>
          {/* Home Team */}
          <Link href={`/team/${game.home_team.toLowerCase()}`} className="flex flex-col items-center gap-4 group">
            <img src={getESPNLogoUrl(game.home_team)} alt={game.home_team} className="w-24 h-24 md:w-32 md:h-32 group-hover:scale-110 transition-transform drop-shadow-xl" />
            <div className="text-4xl font-black text-zinc-300">{game.home_score}</div>
          </Link>
        </div>
      </div>

      {/* DETAILS GRID */}
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
        <div className="bg-[#111] border border-white/5 rounded-2xl p-6">
          <div className="text-xs text-zinc-500 uppercase font-bold tracking-widest mb-4">The Margins</div>
          <div className="flex justify-between items-center border-b border-white/5 pb-3 mb-3">
            <span className="text-zinc-300">Score Difference</span>
            <span className="font-mono text-amber-500">{game.margin} pts</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-zinc-300">Total Offense</span>
            <span className="font-mono text-amber-500">{(game.away_score || 0) + (game.home_score || 0)} pts</span>
          </div>
        </div>
        <div className="bg-[#111] border border-white/5 rounded-2xl p-6">
          <div className="text-xs text-zinc-500 uppercase font-bold tracking-widest mb-4">Top Performer</div>
          <div className="flex justify-between items-center border-b border-white/5 pb-3 mb-3">
            <span className="text-zinc-300 font-bold">{game.top_player_name || "Team Effort"}</span>
            <span className="font-mono text-amber-500">{game.top_player_pts || 0} pts</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-zinc-500 text-sm">True Player Score</span>
            <span className="font-mono text-zinc-400">{game.true_player_score || "N/A"}</span>
          </div>
        </div>
      </div>

      {/* TEAM LEADERS SECTION */}
      <div className="w-full max-w-4xl mt-10">
        <div className="text-lg font-bold text-white mb-4 tracking-tight">Team Leaders</div>
        {espnData ? (
          <div className="grid md:grid-cols-2 gap-4">
            {/* Away Team */}
            <div className="bg-[#18181a] border border-white/10 rounded-2xl p-6 flex flex-col gap-4">
              <div className="flex items-center gap-3 mb-2">
                <img src={getESPNLogoUrl(awayAbbr)} className="w-10 h-10 rounded-full" alt={awayAbbr}/>
                <div className="text-lg font-semibold">{blurIfSpoiler(awayFull)}</div>
              </div>
              <div className="flex flex-col gap-3">
                {/* Points */}
                <div className="flex items-center gap-3">
                  <span className="w-20 text-zinc-400 font-semibold">Points</span>
                  {awayStats.points ? (
                    blurIfSpoiler(
                      <>
                        <span className="font-bold text-white">{awayStats.points.value}</span>
                        <span className="ml-2 text-zinc-400 font-mono">({awayStats.points.shortName})</span>
                      </>
                    )
                  ) : (
                    <span className="text-zinc-600 ml-3">--</span>
                  )}
                </div>
                {/* Rebounds */}
                <div className="flex items-center gap-3">
                  <span className="w-20 text-zinc-400 font-semibold">Rebounds</span>
                  {awayStats.rebounds ? (
                    blurIfSpoiler(
                      <>
                        <span className="font-bold text-white">{awayStats.rebounds.value}</span>
                        <span className="ml-2 text-zinc-400 font-mono">({awayStats.rebounds.shortName})</span>
                      </>
                    )
                  ) : (
                    <span className="text-zinc-600 ml-3">--</span>
                  )}
                </div>
                {/* Assists */}
                <div className="flex items-center gap-3">
                  <span className="w-20 text-zinc-400 font-semibold">Assists</span>
                  {awayStats.assists ? (
                    blurIfSpoiler(
                      <>
                        <span className="font-bold text-white">{awayStats.assists.value}</span>
                        <span className="ml-2 text-zinc-400 font-mono">({awayStats.assists.shortName})</span>
                      </>
                    )
                  ) : (
                    <span className="text-zinc-600 ml-3">--</span>
                  )}
                </div>
              </div>
            </div>
            {/* Home Team */}
            <div className="bg-[#18181a] border border-white/10 rounded-2xl p-6 flex flex-col gap-4">
              <div className="flex items-center gap-3 mb-2">
                <img src={getESPNLogoUrl(homeAbbr)} className="w-10 h-10 rounded-full" alt={homeAbbr}/>
                <div className="text-lg font-semibold">{blurIfSpoiler(homeFull)}</div>
              </div>
              <div className="flex flex-col gap-3">
                {/* Points */}
                <div className="flex items-center gap-3">
                  <span className="w-20 text-zinc-400 font-semibold">Points</span>
                  {homeStats.points ? (
                    blurIfSpoiler(
                      <>
                        <span className="font-bold text-white">{homeStats.points.value}</span>
                        <span className="ml-2 text-zinc-400 font-mono">({homeStats.points.shortName})</span>
                      </>
                    )
                  ) : (
                    <span className="text-zinc-600 ml-3">--</span>
                  )}
                </div>
                {/* Rebounds */}
                <div className="flex items-center gap-3">
                  <span className="w-20 text-zinc-400 font-semibold">Rebounds</span>
                  {homeStats.rebounds ? (
                    blurIfSpoiler(
                      <>
                        <span className="font-bold text-white">{homeStats.rebounds.value}</span>
                        <span className="ml-2 text-zinc-400 font-mono">({homeStats.rebounds.shortName})</span>
                      </>
                    )
                  ) : (
                    <span className="text-zinc-600 ml-3">--</span>
                  )}
                </div>
                {/* Assists */}
                <div className="flex items-center gap-3">
                  <span className="w-20 text-zinc-400 font-semibold">Assists</span>
                  {homeStats.assists ? (
                    blurIfSpoiler(
                      <>
                        <span className="font-bold text-white">{homeStats.assists.value}</span>
                        <span className="ml-2 text-zinc-400 font-mono">({homeStats.assists.shortName})</span>
                      </>
                    )
                  ) : (
                    <span className="text-zinc-600 ml-3">--</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-zinc-500 py-8">Loading leaders from ESPN&hellip;</div>
        )}
      </div>
    </div>
  );
}