"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const TEAM_ABBR_MAP: Record<string, string> = {
  GOL: "gsw", GS: "gsw", UTAH: "utah", UTA: "utah", BKN: "bkn", BRK: "bkn",
  PHX: "phx", PHO: "phx", NY: "nyk", NYK: "nyk", NO: "no", NOP: "no",
  SA: "sas", SAS: "sas", WSH: "wsh", WAS: "wsh",
};

function getESPNLogoUrl(abbr: string) {
  const displayAbbr = TEAM_ABBR_MAP[abbr.toUpperCase()] || abbr;
  return `https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/${displayAbbr.toLowerCase()}.png`;
}

interface TeamStat {
  abbr: string;
  games: number;
  avgWatch: number;
  avgScore: number;
  aPlusCount: number;
  style: string;
}

type SortKey = "avgWatch" | "aPlusCount" | "avgScore";

export default function TeamRankingsPage() {
  const [teams, setTeams] = useState<TeamStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("avgWatch");

  useEffect(() => {
    async function calculateTeamRankings() {
      const { data } = await supabase
        .from("nba_games")
        .select("away_team, home_team, away_score, home_score, watchability_score");

      if (!data) return;

      const stats: Record<string, any> = {};

      data.forEach(game => {
        [
          { abbr: game.away_team, score: game.away_score },
          { abbr: game.home_team, score: game.home_score }
        ].forEach(t => {
          if (!t.abbr) return;
          // Kick out All-Star / Exhibition teams
          const ignoreList = ['WORLD', 'USA', 'LEBRON', 'GIANNIS', 'DURANT', 'SHARP', 'PAU', 'EST', 'WST'];
          if (ignoreList.includes(t.abbr.toUpperCase()) || t.abbr.length > 3) return;

          if (!stats[t.abbr]) {
            stats[t.abbr] = { abbr: t.abbr, games: 0, totalWatch: 0, totalPts: 0, aPlus: 0 };
          }
          stats[t.abbr].games += 1;
          stats[t.abbr].totalWatch += game.watchability_score || 0;
          stats[t.abbr].totalPts += t.score || 0;
          if (game.watchability_score >= 90) stats[t.abbr].aPlus += 1;
        });
      });

      const teamsArr = Object.values(stats).map(s => {
        const avgWatch = Math.round(s.totalWatch / s.games);
        const avgScore = Math.round(s.totalPts / s.games);
        let style = "Balanced";
        if (avgScore > 118) style = "High Octane 🔥";
        if (avgScore < 108) style = "Gritty Defense 🛡️";

        return {
          abbr: s.abbr,
          games: s.games,
          avgWatch,
          avgScore,
          aPlusCount: s.aPlus,
          style
        };
      });

      setTeams(teamsArr);
      setLoading(false);
    }
    calculateTeamRankings();
  }, []);

  function getSortedTeams(ts: TeamStat[], key: SortKey): TeamStat[] {
    // Always sort descending for all keys
    return [...ts].sort((a, b) => b[key] - a[key]);
  }

  const sortedTeams = getSortedTeams(teams, sortKey);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8 pt-24">
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-4xl font-black italic uppercase tracking-tighter">The Watchability Standings</h1>
          <p className="text-zinc-500">Which teams are actually worth your time this season?</p>
        </div>

        <div className="flex gap-4 items-center mb-2">
          <span className="text-sm text-zinc-500 font-mono">Sort by:</span>
          <button
            onClick={() => setSortKey("avgWatch")}
            className={`px-3 py-1 text-sm rounded-md font-bold transition-colors ${
              sortKey === "avgWatch"
                ? "bg-amber-500/20 text-amber-400 border border-amber-400/60"
                : "bg-white/10 text-white hover:bg-white/20 border border-transparent"
            }`}
          >
            Watchability
          </button>
          <button
            onClick={() => setSortKey("aPlusCount")}
            className={`px-3 py-1 text-sm rounded-md font-bold transition-colors ${
              sortKey === "aPlusCount"
                ? "bg-emerald-400/30 text-emerald-300 border border-emerald-400/50"
                : "bg-white/10 text-white hover:bg-white/20 border border-transparent"
            }`}
          >
            A+ Games
          </button>
          <button
            onClick={() => setSortKey("avgScore")}
            className={`px-3 py-1 text-sm rounded-md font-bold transition-colors ${
              sortKey === "avgScore"
                ? "bg-indigo-400/20 text-indigo-300 border border-indigo-400/50"
                : "bg-white/10 text-white hover:bg-white/20 border border-transparent"
            }`}
          >
            PPG
          </button>
        </div>

        <div className="grid gap-4">
          {loading ? (
             <div className="animate-pulse text-zinc-500 font-mono">Calculating league vibes...</div>
          ) : (
            sortedTeams.map((team, i) => (
              <Link 
                href={`/team/${team.abbr.toLowerCase()}`}
                key={team.abbr}
                className="group flex items-center gap-6 bg-[#111] border border-white/5 p-4 rounded-2xl hover:bg-white/5 transition-all"
              >
                <div className="w-8 font-black text-zinc-700 group-hover:text-amber-500 transition-colors text-2xl">
                  {i + 1}
                </div>
                
                <img src={getESPNLogoUrl(team.abbr)} className="w-12 h-12" alt="" />
                
                <div className="flex-1">
                  <div className="font-bold text-xl">{team.abbr}</div>
                  <div className="text-xs text-zinc-500 uppercase tracking-widest">{team.style}</div>
                </div>

                <div className="grid grid-cols-3 gap-8 text-right pr-4">
                  <div>
                    <div className="text-[10px] text-zinc-600 uppercase font-bold">A+ Games</div>
                    <div className="font-mono text-emerald-400">{team.aPlusCount}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-zinc-600 uppercase font-bold">Avg PPG</div>
                    <div className="font-mono">{team.avgScore}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-zinc-600 uppercase font-bold text-amber-500">Watch Index</div>
                    <div className="font-black text-2xl text-white group-hover:text-amber-500 transition-colors">
                      {team.avgWatch}
                    </div>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}