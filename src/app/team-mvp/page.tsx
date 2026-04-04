"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

// ESPN logo key map, for appearances
const teamLogoMap: { [abbr: string]: string } = {
  ATL: "atl",
  BOS: "bos",
  BKN: "bkn",
  CHA: "cha",
  CHI: "chi",
  CLE: "cle",
  DAL: "dal",
  DEN: "den",
  DET: "det",
  GSW: "gs",
  HOU: "hou",
  IND: "ind",
  LAC: "lac",
  LAL: "lal",
  MEM: "mem",
  MIA: "mia",
  MIL: "mil",
  MIN: "min",
  NOP: "no",
  NYK: "ny",
  OKC: "okc",
  ORL: "orl",
  PHI: "phi",
  PHX: "phx",
  POR: "por",
  SAC: "sac",
  SAS: "sa",
  TOR: "tor",
  UTA: "utah",
  WAS: "wsh",
};

const teams = [
  { name: "Atlanta Hawks", abbr: "ATL" },
  { name: "Boston Celtics", abbr: "BOS" },
  { name: "Brooklyn Nets", abbr: "BKN" },
  { name: "Charlotte Hornets", abbr: "CHA" },
  { name: "Chicago Bulls", abbr: "CHI" },
  { name: "Cleveland Cavaliers", abbr: "CLE" },
  { name: "Dallas Mavericks", abbr: "DAL" },
  { name: "Denver Nuggets", abbr: "DEN" },
  { name: "Detroit Pistons", abbr: "DET" },
  { name: "Golden State Warriors", abbr: "GSW" },
  { name: "Houston Rockets", abbr: "HOU" },
  { name: "Indiana Pacers", abbr: "IND" },
  { name: "Los Angeles Clippers", abbr: "LAC" },
  { name: "Los Angeles Lakers", abbr: "LAL" },
  { name: "Memphis Grizzlies", abbr: "MEM" },
  { name: "Miami Heat", abbr: "MIA" },
  { name: "Milwaukee Bucks", abbr: "MIL" },
  { name: "Minnesota Timberwolves", abbr: "MIN" },
  { name: "New Orleans Pelicans", abbr: "NOP" },
  { name: "New York Knicks", abbr: "NYK" },
  { name: "Oklahoma City Thunder", abbr: "OKC" },
  { name: "Orlando Magic", abbr: "ORL" },
  { name: "Philadelphia 76ers", abbr: "PHI" },
  { name: "Phoenix Suns", abbr: "PHX" },
  { name: "Portland Trail Blazers", abbr: "POR" },
  { name: "Sacramento Kings", abbr: "SAC" },
  { name: "San Antonio Spurs", abbr: "SAS" },
  { name: "Toronto Raptors", abbr: "TOR" },
  { name: "Utah Jazz", abbr: "UTA" },
  { name: "Washington Wizards", abbr: "WAS" },
];

function getTeamLogoUrl(abbr: string) {
  const key =
    teamLogoMap[abbr] ||
    teamLogoMap[
      abbr
        .replace("GSW", "GS")
        .replace("NOP", "NO")
        .replace("NYK", "NY")
        .replace("SAS", "SA")
        .replace("UTA", "UTAH")
        .replace("WAS", "WSH")
    ] ||
    abbr.toLowerCase();
  return `https://a.espncdn.com/i/teamlogos/nba/500/${key}.png`;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface TeamStat {
  abbr: string;
  name: string;
  games: number;
  totalWatch: number;
  aPlusGames: number;
  masterclasses: number;
  totalPts: number;
  highestPts: number;
  avgWatch: number | string;
  avgPts: number | string;
  electricScore: number | string;
}

export default function TeamMVPIndexPage() {
  const [teamsStats, setTeamsStats] = useState<TeamStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAndAggregateTeams() {
      // Fetch all games from the database
      const { data: games, error } = await supabase
        .from("nba_games")
        .select(
          "home_team_abbr, away_team_abbr, home_team_name, away_team_name, home_team_score, away_team_score, watchability_score, top_player_pts"
        );

      if (error || !games) {
        setTeamsStats([]);
        setLoading(false);
        return;
      }

      // For each team, aggregate stats
      const teamMap: Record<string, Omit<TeamStat, "avgWatch" | "avgPts" | "electricScore"> & { allWatch: number[], allPts: number[] }> = {};

      games.forEach((game: any) => {
        [
          {
            abbr: game.home_team_abbr,
            name: game.home_team_name,
            score: game.home_team_score,
          },
          {
            abbr: game.away_team_abbr,
            name: game.away_team_name,
            score: game.away_team_score,
          },
        ].forEach((teamSlot) => {
          if (!teamSlot.abbr || !teamSlot.name) return;
          if (!teamMap[teamSlot.abbr]) {
            teamMap[teamSlot.abbr] = {
              abbr: teamSlot.abbr,
              name: teamSlot.name,
              games: 0,
              totalWatch: 0,
              aPlusGames: 0,
              masterclasses: 0,
              totalPts: 0,
              highestPts: 0,
              allWatch: [],
              allPts: [],
            };
          }
          teamMap[teamSlot.abbr].games += 1;
          const watchScore = typeof game.watchability_score === "number" ? game.watchability_score : 0;
          const pts = typeof teamSlot.score === "number" ? teamSlot.score : 0;

          teamMap[teamSlot.abbr].totalWatch += watchScore;
          teamMap[teamSlot.abbr].allWatch.push(watchScore);
          teamMap[teamSlot.abbr].totalPts += pts;
          teamMap[teamSlot.abbr].allPts.push(pts);

          // 80+ watchability
          if (watchScore >= 80) {
            teamMap[teamSlot.abbr].aPlusGames += 1;
          }
          // 40+ pt night by anyone (even not their player)
          if ((game.top_player_pts || 0) >= 40) {
            teamMap[teamSlot.abbr].masterclasses += 1;
          }
          // Highest single-game points
          if (pts > teamMap[teamSlot.abbr].highestPts) {
            teamMap[teamSlot.abbr].highestPts = pts;
          }
        });
      });

      // Combine with all teams list for always showing all franchises
      const allTeamsWithStats: TeamStat[] = teams.map((team) => {
        const s = teamMap[team.abbr];
        if (s && s.games > 0) {
          const avgWatch = Math.round(s.totalWatch / s.games);
          const avgPts = Math.round(s.totalPts / s.games);
          const electricScore = avgWatch + s.aPlusGames * 5 + s.masterclasses * 4;
          return {
            abbr: team.abbr,
            name: team.name,
            games: s.games,
            totalWatch: s.totalWatch,
            aPlusGames: s.aPlusGames,
            masterclasses: s.masterclasses,
            totalPts: s.totalPts,
            highestPts: s.highestPts,
            avgWatch,
            avgPts,
            electricScore,
          }
        } else {
          // Fallback: no data for this team
          return {
            abbr: team.abbr,
            name: team.name,
            games: 0,
            totalWatch: 0,
            aPlusGames: 0,
            masterclasses: 0,
            totalPts: 0,
            highestPts: 0,
            avgWatch: "--",
            avgPts: "--",
            electricScore: "--",
          }
        }
      });

      // Sort electric teams by score, others below
      allTeamsWithStats.sort((a, b) => {
        if (typeof a.electricScore === "string" && typeof b.electricScore === "string") return 0;
        if (typeof a.electricScore === "string") return 1;
        if (typeof b.electricScore === "string") return -1;
        return (b.electricScore as number) - (a.electricScore as number);
      });

      setTeamsStats(allTeamsWithStats);
      setLoading(false);
    }

    fetchAndAggregateTeams();
  }, []);

  // Top team with actual stats (not "--")
  const firstRealTeam = teamsStats.find((x) => typeof x.electricScore === "number") as TeamStat | undefined;
  const currentTeam = firstRealTeam || null;

  return (
    <div className="h-screen w-full bg-[#0a0a0a] text-zinc-200 font-sans flex overflow-hidden">
      {/* LEFT COLUMN: Team List + Rankings */}
      <div className="w-[45%] max-w-xl h-full border-r border-white/10 flex flex-col bg-[#0f0f0f]">
        <div className="p-6 border-b border-white/10 shrink-0 bg-black/20">
          <h1 className="text-3xl font-bold text-white tracking-tight">The Electric Team Index</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Ranking teams by entertainment value: watchability, high-scoring games, and more.
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 relative">
          {loading && (
            <div className="absolute inset-0 bg-[#0f0f0f]/80 backdrop-blur-sm flex items-center justify-center z-10">
              <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {!loading &&
            teamsStats.map((team, index) => {
              const isPodium =
                typeof team.electricScore === "number" && index < 3;
              const isTop =
                typeof team.electricScore === "number" && index === 0;

              return (
                <div
                  key={team.abbr}
                  className={`w-full text-left flex items-center gap-4 p-4 rounded-xl transition-all border ${
                    isTop
                      ? "bg-amber-500/10 border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.1)]"
                      : isPodium
                        ? "bg-white/5 border-amber-200/10"
                        : "bg-white/[0.01] border-white/5"
                  }`}
                >
                  <div
                    className={`w-6 text-center font-black text-lg ${
                      isPodium ? "text-amber-500" : "text-zinc-600"
                    }`}
                  >
                    {index + 1}
                  </div>
                  {/* Team avatar */}
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 border overflow-hidden ${
                      isPodium
                        ? "bg-amber-500 border-amber-400"
                        : "bg-zinc-800 border-white/10"
                    }`}
                  >
                    <img
                      src={getTeamLogoUrl(team.abbr)}
                      alt={`${team.name} logo`}
                      className={`w-8 h-8 object-contain ${
                        isPodium
                          ? "drop-shadow-[0_0_10px_rgba(245,158,11,0.7)]"
                          : ""
                      }`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className={`font-bold truncate ${
                        isPodium ? "text-white" : "text-zinc-300"
                      }`}
                    >
                      {team.name}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {team.games && team.games > 0
                        ? `${team.games} game${team.games !== 1 ? "s" : ""} • High: ${team.highestPts} pts`
                        : "—"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">
                      Index
                    </div>
                    <div
                      className={`text-xl font-black ${
                        isPodium
                          ? "text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                          : "text-white"
                      }`}
                    >
                      {team.electricScore !== undefined
                        ? team.electricScore
                        : "--"}
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
      {/* RIGHT COLUMN: Team Trophy Case */}
      <div className="w-[55%] flex-1 h-full p-12 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/[0.03] to-[#0a0a0a] flex flex-col items-center justify-center">
        {currentTeam ? (
          <div className="w-full max-w-lg space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col items-center text-center space-y-4 border-b border-white/10 pb-8">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 p-1 shadow-[0_0_30px_rgba(245,158,11,0.3)] flex items-center justify-center">
                <img
                  src={getTeamLogoUrl(currentTeam.abbr)}
                  alt={`${currentTeam.name} logo`}
                  className="w-20 h-20 rounded-full object-contain bg-black"
                />
              </div>
              <div>
                <h2 className="text-4xl font-black text-white tracking-tight">
                  {currentTeam.name}
                </h2>
                <p className="text-amber-500 font-mono mt-2">
                  Electric Index: {currentTeam.electricScore}
                </p>
              </div>
            </div>
            {/* Trophy Case */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 text-center hover:bg-white/[0.04] transition-colors">
                <div className="text-4xl mb-2">🍿</div>
                <div className="text-3xl font-bold text-white">
                  {currentTeam.avgWatch}
                  <span className="text-sm text-zinc-600">/100</span>
                </div>
                <div className="text-xs text-zinc-500 uppercase tracking-widest mt-1">
                  Avg Watchability
                </div>
              </div>
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 text-center hover:bg-white/[0.04] transition-colors">
                <div className="text-4xl mb-2">🔥</div>
                <div className="text-3xl font-bold text-white">{currentTeam.aPlusGames}</div>
                <div className="text-xs text-zinc-500 uppercase tracking-widest mt-1">
                  A+ Games
                </div>
              </div>
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 text-center hover:bg-white/[0.04] transition-colors">
                <div className="text-4xl mb-2">👑</div>
                <div className="text-3xl font-bold text-white">{currentTeam.masterclasses}</div>
                <div className="text-xs text-zinc-500 uppercase tracking-widest mt-1">
                  40+ Pt Performances (all games)
                </div>
              </div>
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 text-center hover:bg-white/[0.04] transition-colors">
                <div className="text-4xl mb-2">🏀</div>
                <div className="text-3xl font-bold text-white">{currentTeam.avgPts}</div>
                <div className="text-xs text-zinc-500 uppercase tracking-widest mt-1">
                  Avg Team Score
                </div>
              </div>
            </div>
            <div className="text-center pt-2">
              <span className="text-xs text-zinc-500">
                Based on regular season + play-in games.
              </span>
            </div>
          </div>
        ) : (
          <div className="text-zinc-400 text-center">
            No team data available.
          </div>
        )}
      </div>
    </div>
  );
}