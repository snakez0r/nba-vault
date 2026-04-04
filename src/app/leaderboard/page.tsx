"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

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
  if (score >= 50) return { letter: "D", color: "text-orange-400", shadow: "rgba(251, 146, 60, 0.6)" };
  return { letter: "F", color: "text-red-500", shadow: "rgba(239, 68, 68, 0.6)" };
}

function getGameTags(game: any) {
  const tags = [];
  const totalPoints = (game.home_score || 0) + (game.away_score || 0);
  
  if (game.margin <= 3) {
    tags.push({ text: "Nail-Biter 😬", style: "bg-orange-500/10 text-orange-400 border-orange-500/20" });
  }
  if (totalPoints > 240) {
    tags.push({ text: "Shootout 🔥", style: "bg-red-500/10 text-red-400 border-red-500/20" });
  } else if (totalPoints < 200 && totalPoints > 0) {
    tags.push({ text: "Defensive Grind 🛡️", style: "bg-blue-500/10 text-blue-400 border-blue-500/20" });
  }
  if (game.top_player_pts >= 40) {
    tags.push({ text: "Masterclass 👑", style: "bg-purple-500/10 text-purple-400 border-purple-500/20" });
  }
  if (game.margin >= 15) {
    tags.push({ text: "Blowout 💤", style: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" });
  }
  
  return tags;
}

const FILTERS = ["Nail-Biter 😬", "Shootout 🔥", "Defensive Grind 🛡️", "Masterclass 👑", "Blowout 💤"];

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function LeaderboardPage() {
  const [games, setGames] = useState<any[]>([]);
  const [selectedGame, setSelectedGame] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Date & Filter State
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Helper to set quick date presets
  const setDatePreset = (days: number | null) => {
    if (days === null) {
      setStartDate("");
      setEndDate("");
      return;
    }
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    
    setEndDate(end.toISOString().split('T')[0]);
    setStartDate(start.toISOString().split('T')[0]);
  };

  useEffect(() => {
    async function fetchGames() {
      setLoading(true);
      
      // Build dynamic query
      let query = supabase
        .from("nba_games")
        .select("id, date, away_team, home_team, away_score, home_score, margin, top_player_name, top_player_pts, watchability_score")
        .order("watchability_score", { ascending: false })
        .order("top_player_pts", { ascending: false })
        .limit(100);

      // Apply date filters if they exist
      if (startDate) query = query.gte("date", startDate);
      if (endDate) query = query.lte("date", endDate);

      const { data } = await query;

      if (data && data.length > 0) {
        setGames(data);
        setSelectedGame(data[0]);
      } else {
        setGames([]);
        setSelectedGame(null);
      }
      setLoading(false);
    }
    
    fetchGames();
  }, [startDate, endDate]); // Re-run query whenever dates change!

  const selectedGrade = selectedGame ? getGrade(selectedGame.watchability_score || 0) : null;

  const filteredGames = games.filter(game => {
    if (!activeFilter) return true;
    return getGameTags(game).some(t => t.text === activeFilter);
  });

  return (
    <div className="h-screen w-full bg-[#0a0a0a] text-zinc-200 font-sans flex overflow-hidden">
      
      {/* LEFT COLUMN: Scrollable List */}
      <div className="w-[50%] max-w-2xl h-full border-r border-white/10 flex flex-col bg-[#0f0f0f]">
        <div className="p-6 border-b border-white/10 shrink-0 bg-black/20 space-y-5">
          
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Game Vault</h1>
            <p className="text-sm text-zinc-400 mt-1">Discover the best matchups</p>
          </div>

          {/* DATE PICKER BAR */}
          <div className="flex flex-wrap items-center gap-3 bg-white/[0.02] p-3 rounded-xl border border-white/5">
            <div className="flex gap-2">
              <button 
                onClick={() => setDatePreset(null)} 
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${!startDate ? "bg-white text-black" : "bg-white/10 text-zinc-400 hover:bg-white/20"}`}
              >
                All Season
              </button>
              <button 
                onClick={() => setDatePreset(7)} 
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${startDate && new Date(endDate).getTime() - new Date(startDate).getTime() <= 7 * 24 * 60 * 60 * 1000 ? "bg-white text-black" : "bg-white/10 text-zinc-400 hover:bg-white/20"}`}
              >
                Last 7 Days
              </button>
              <button 
                onClick={() => setDatePreset(30)} 
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${startDate && new Date(endDate).getTime() - new Date(startDate).getTime() > 7 * 24 * 60 * 60 * 1000 ? "bg-white text-black" : "bg-white/10 text-zinc-400 hover:bg-white/20"}`}
              >
                Last 30 Days
              </button>
            </div>
            
            <div className="w-px h-6 bg-white/20 mx-1 hidden sm:block"></div>
            
            <div className="flex items-center gap-2">
              <input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-black/50 border border-white/10 rounded-md px-2 py-1.5 text-xs text-white focus:outline-none focus:border-white/30"
              />
              <span className="text-zinc-500 text-xs">to</span>
              <input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-black/50 border border-white/10 rounded-md px-2 py-1.5 text-xs text-white focus:outline-none focus:border-white/30"
              />
            </div>
          </div>

          {/* VIBE FILTER BAR */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setActiveFilter(null)}
              className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                activeFilter === null ? "bg-white text-black" : "bg-white/5 text-zinc-400 hover:bg-white/10"
              }`}
            >
              All Vibes
            </button>
            {FILTERS.map(f => (
              <button
                key={f}
                onClick={() => setActiveFilter(f === activeFilter ? null : f)}
                className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                  activeFilter === f ? "bg-blue-500 text-white shadow-[0_0_10px_rgba(59,130,246,0.4)]" : "bg-white/5 text-zinc-400 hover:bg-white/10"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3 relative">
          {loading && (
            <div className="absolute inset-0 bg-[#0f0f0f]/80 backdrop-blur-sm flex items-center justify-center z-10">
               <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          
          {!loading && filteredGames.length === 0 && (
             <div className="text-center text-zinc-500 p-8 border border-white/5 rounded-xl border-dashed">
               No games found for this period. Try adjusting your filters.
             </div>
          )}

          {!loading && filteredGames.map((game, index) => {
            const grade = getGrade(game.watchability_score || 0);
            const isSelected = selectedGame?.id === game.id;
            const tags = getGameTags(game);
            
            return (
              <button
                key={game.id}
                onClick={() => setSelectedGame(game)}
                className={`w-full text-left flex items-center gap-4 p-4 rounded-xl transition-all border ${
                  isSelected 
                    ? "bg-white/[0.05] border-white/20 shadow-[0_0_20px_rgba(255,255,255,0.05)]" 
                    : "bg-white/[0.01] border-white/5 hover:bg-white/[0.03]"
                }`}
              >
                <div className={`w-6 text-center font-bold ${index < 10 && !activeFilter ? 'text-amber-500' : 'text-zinc-600'}`}>
                  {index + 1}
                </div>

                <div className="flex items-center gap-2 w-32 shrink-0">
                  <div className="flex -space-x-3">
                    <img src={getESPNLogoUrl(game.away_team)} alt={game.away_team} className="w-8 h-8 rounded-full bg-black border border-white/10 relative z-10" />
                    <img src={getESPNLogoUrl(game.home_team)} alt={game.home_team} className="w-8 h-8 rounded-full bg-black border border-white/10 relative z-0" />
                  </div>
                  <div className="font-bold text-white text-sm whitespace-nowrap">
                    {game.away_team} <span className="text-zinc-600 font-normal text-xs">vs</span> {game.home_team}
                  </div>
                </div>

                <div className="flex-1 text-xs text-zinc-500 truncate pl-2 flex flex-col gap-1">
                  <div>{game.date} • {game.margin}pt diff</div>
                  <div className="flex gap-1.5">
                    {tags.map((tag, i) => {
                      const emoji = tag.text.split(' ').pop();
                      return <span key={i} title={tag.text} className="text-[14px]">{emoji}</span>
                    })}
                  </div>
                </div>

                <div 
                  className={`text-2xl font-black shrink-0 w-10 text-right ${grade.color}`}
                  style={{ textShadow: isSelected ? `0 0 15px ${grade.shadow}` : 'none' }}
                >
                  {grade.letter}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* RIGHT COLUMN: Sticky Detail View */}
      <div className="w-[50%] flex-1 h-full p-12 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/[0.03] to-[#0a0a0a] flex flex-col items-center justify-center">
        {selectedGame && selectedGrade ? (
          <div className="w-full max-w-xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-8">
              <div className="flex items-center gap-6">
                <img src={getESPNLogoUrl(selectedGame.away_team)} alt="Away" className="w-20 h-20 rounded-full bg-white/5 p-2 border border-white/10" />
                <div className="text-zinc-500 font-bold text-2xl">VS</div>
                <img src={getESPNLogoUrl(selectedGame.home_team)} alt="Home" className="w-20 h-20 rounded-full bg-white/5 p-2 border border-white/10" />
              </div>
              <div 
                className={`text-8xl font-black ${selectedGrade.color}`}
                style={{ textShadow: `0 0 40px ${selectedGrade.shadow}` }}
              >
                {selectedGrade.letter}
              </div>
            </div>

            {/* Final Score Plate */}
            <div className="bg-black/40 border border-white/5 rounded-2xl p-6 text-center shadow-inner flex flex-col items-center gap-4">
              <div className="flex justify-center items-end gap-6 w-full">
                <div className="text-4xl font-bold text-white">{selectedGame.away_score}</div>
                <div className="text-zinc-600 font-mono text-sm mb-2">FINAL</div>
                <div className="text-4xl font-bold text-white">{selectedGame.home_score}</div>
              </div>
              
              <div className="flex flex-wrap justify-center gap-2">
                {getGameTags(selectedGame).map((tag, i) => (
                  <span key={i} className={`px-3 py-1 rounded-full text-xs font-bold border ${tag.style}`}>
                    {tag.text}
                  </span>
                ))}
              </div>
            </div>

            {/* Factor Breakdown (Cleaned Up) */}
            <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 backdrop-blur-xl space-y-6">
              <h3 className="text-xs font-bold tracking-widest text-zinc-500 uppercase">Watchability Factors</h3>
              
              <div className="space-y-4">
                
                <div className="flex justify-between items-center border-b border-white/5 pb-4">
                  <div>
                    <div className="text-sm font-bold text-white">Score Margin</div>
                    <div className="text-xs text-zinc-500">Closeness of final result</div>
                  </div>
                  <div className="font-mono text-emerald-400">{selectedGame.margin} pts</div>
                </div>

                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-sm font-bold text-white">Top Performer</div>
                    <div className="text-xs text-zinc-500">Highest individual output</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-blue-400">{selectedGame.top_player_name || 'Team Effort'}</div>
                    <div className="text-xs text-zinc-500">{selectedGame.top_player_pts || 0} pts</div>
                  </div>
                </div>

              </div>
            </div>

          </div>
        ) : (
          <div className="text-zinc-600 text-sm">Select a game to view details</div>
        )}
      </div>

    </div>
  );
}