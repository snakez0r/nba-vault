"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface PlayerStat {
  name: string;
  games: number;
  totalWatch: number;
  aPlusGames: number;      // Games with watchability >= 80
  masterclasses: number;   // Games with 40+ points
  totalPts: number;
  highestPts: number;
  avgWatch: number;
  avgPts: number;
  electricScore: number;
}

// Helper to generate a cool avatar from initials
function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
}

export default function MVPIndexPage() {
  const [players, setPlayers] = useState<PlayerStat[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerStat | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAndAggregatePlayers() {
      // Fetch the columns we need from EVERY game
      const { data, error } = await supabase
        .from("nba_games")
        .select("top_player_name, top_player_pts, watchability_score");

      if (error || !data) {
        setLoading(false);
        return;
      }

      // 1. Group the data by player
      const playerMap: Record<string, any> = {};

      data.forEach((game) => {
        const name = game.top_player_name;
        // Skip ghost data or team efforts
        if (!name || name === "Team Effort" || name === "Unknown") return;

        if (!playerMap[name]) {
          playerMap[name] = {
            name,
            games: 0,
            totalWatch: 0,
            aPlusGames: 0,
            masterclasses: 0,
            totalPts: 0,
            highestPts: 0,
          };
        }

        playerMap[name].games += 1;
        playerMap[name].totalWatch += game.watchability_score || 0;
        playerMap[name].totalPts += game.top_player_pts || 0;

        if (game.watchability_score >= 80) playerMap[name].aPlusGames += 1;
        if (game.top_player_pts >= 40) playerMap[name].masterclasses += 1;
        if ((game.top_player_pts || 0) > playerMap[name].highestPts) {
          playerMap[name].highestPts = game.top_player_pts;
        }
      });

      // 2. Calculate averages and the "Electric Score"
      const rankedPlayers = Object.values(playerMap)
        // Filter out players who only randomly led one game to keep the data clean
        .filter((p) => p.games >= 3) 
        .map((p) => {
          const avgWatch = Math.round(p.totalWatch / p.games);
          const avgPts = Math.round(p.totalPts / p.games);
          
          // The Proprietary Formula: 
          // Average Watchability + Bonus points for carrying A+ games and dropping 40+
          const electricScore = avgWatch + (p.aPlusGames * 5) + (p.masterclasses * 5);

          return { ...p, avgWatch, avgPts, electricScore } as PlayerStat;
        })
        // 3. Sort by Electric Score
        .sort((a, b) => b.electricScore - a.electricScore);

      setPlayers(rankedPlayers);
      if (rankedPlayers.length > 0) setSelectedPlayer(rankedPlayers[0]);
      setLoading(false);
    }

    fetchAndAggregatePlayers();
  }, []);

  return (
    <div className="h-screen w-full bg-[#0a0a0a] text-zinc-200 font-sans flex overflow-hidden">
      
      {/* LEFT COLUMN: Player Rankings */}
      <div className="w-[45%] max-w-xl h-full border-r border-white/10 flex flex-col bg-[#0f0f0f]">
        <div className="p-6 border-b border-white/10 shrink-0 bg-black/20">
          <h1 className="text-3xl font-bold text-white tracking-tight">The Electric MVP</h1>
          <p className="text-sm text-zinc-400 mt-1">Ranking the league&apos;s most entertaining players.</p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3 relative">
          {loading && (
            <div className="absolute inset-0 bg-[#0f0f0f]/80 backdrop-blur-sm flex items-center justify-center z-10">
               <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loading && players.map((player, index) => {
            const isSelected = selectedPlayer?.name === player.name;
            const isPodium = index < 3;
            
            return (
              <button
                key={player.name}
                onClick={() => setSelectedPlayer(player)}
                className={`w-full text-left flex items-center gap-4 p-4 rounded-xl transition-all border ${
                  isSelected 
                    ? "bg-amber-500/10 border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.1)]" 
                    : "bg-white/[0.01] border-white/5 hover:bg-white/[0.03]"
                }`}
              >
                <div className={`w-6 text-center font-black text-lg ${isPodium ? 'text-amber-500' : 'text-zinc-600'}`}>
                  {index + 1}
                </div>

                {/* Avatar */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 border ${
                  isPodium ? 'bg-amber-500 text-black border-amber-400' : 'bg-zinc-800 text-zinc-400 border-white/10'
                }`}>
                  {getInitials(player.name)}
                </div>

                <div className="flex-1">
                  <div className={`font-bold ${isPodium ? 'text-white' : 'text-zinc-300'}`}>
                    {player.name}
                  </div>
                  <div className="text-xs text-zinc-500">
                    Led {player.games} games • Season High {player.highestPts} pts
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Index</div>
                  <div className={`text-xl font-black ${isPodium ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'text-white'}`}>
                    {player.electricScore}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* RIGHT COLUMN: Player Trophy Case */}
      <div className="w-[55%] flex-1 h-full p-12 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/[0.03] to-[#0a0a0a] flex flex-col items-center justify-center">
        {selectedPlayer ? (
          <div className="w-full max-w-lg space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* Header */}
            <div className="flex flex-col items-center text-center space-y-4 border-b border-white/10 pb-8">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 p-1 shadow-[0_0_30px_rgba(245,158,11,0.3)]">
                <div className="w-full h-full bg-black rounded-full flex items-center justify-center text-3xl font-black text-amber-500">
                  {getInitials(selectedPlayer.name)}
                </div>
              </div>
              <div>
                <h2 className="text-4xl font-black text-white tracking-tight">{selectedPlayer.name}</h2>
                <p className="text-amber-500 font-mono mt-2">Electric Index: {selectedPlayer.electricScore}</p>
              </div>
            </div>

            {/* Trophy Case Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 text-center hover:bg-white/[0.04] transition-colors">
                <div className="text-4xl mb-2">🍿</div>
                <div className="text-3xl font-bold text-white">{selectedPlayer.avgWatch}<span className="text-sm text-zinc-600">/100</span></div>
                <div className="text-xs text-zinc-500 uppercase tracking-widest mt-1">Avg Watchability</div>
              </div>

              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 text-center hover:bg-white/[0.04] transition-colors">
                <div className="text-4xl mb-2">🔥</div>
                <div className="text-3xl font-bold text-white">{selectedPlayer.aPlusGames}</div>
                <div className="text-xs text-zinc-500 uppercase tracking-widest mt-1">&quot;A+&quot; Tier Games</div>
              </div>

              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 text-center hover:bg-white/[0.04] transition-colors">
                <div className="text-4xl mb-2">👑</div>
                <div className="text-3xl font-bold text-white">{selectedPlayer.masterclasses}</div>
                <div className="text-xs text-zinc-500 uppercase tracking-widest mt-1">40+ Pt Games</div>
              </div>

              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 text-center hover:bg-white/[0.04] transition-colors">
                <div className="text-4xl mb-2">📈</div>
                <div className="text-3xl font-bold text-white">{selectedPlayer.highestPts}</div>
                <div className="text-xs text-zinc-500 uppercase tracking-widest mt-1">Season High (Pts)</div>
              </div>
            </div>

          </div>
        ) : (
          <div className="text-zinc-600 text-sm">Loading player data...</div>
        )}
      </div>

    </div>
  );
}