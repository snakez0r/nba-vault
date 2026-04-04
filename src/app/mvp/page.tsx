"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

// NBA player ID map for headshots (for top/obvious names missing headshots)
const nbaPlayerIdMap: Record<string, string> = {
  // ... (unchanged, omitted for brevity)
  "Monte Morris": "1628420",
  // Add further player IDs as more become featured in the Electric MVP list
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface PlayerStat {
  name: string;
  games: number;
  totalWatch: number;
  aPlusGames: number;
  masterclasses: number;
  totalPts: number;
  highestPts: number;
  avgWatch: number;
  avgPts: number;
  electricScore: number;
}

function getPlayerHeadshotUrls(name: string) {
  // ... (unchanged)
  if (!name) return [];
  const parts = name.trim().split(" ");
  if (parts.length < 2) return [];
  // Basketball Reference slug: [last][first2][01]
  const first = parts[0].replace(/[^a-zA-Z]/g, "").toLowerCase();
  const last = parts[parts.length - 1].replace(/[^a-zA-Z]/g, "").toLowerCase();
  const bbrefIdBase = `${last}${first.substring(0,2)}`;

  const bbrefHeadshots = Array.from({ length: 3 }).map(
    (_, i) => `https://www.basketball-reference.com/req/202106291/images/players/${bbrefIdBase}0${i + 1}.jpg`
  );

  // NBA CDN via playerId if available, else fallbacks.
  const nbaPlayerId = nbaPlayerIdMap[name];
  let nbaCdnUrls: string[] = [];
  if (nbaPlayerId) {
    nbaCdnUrls.push(`https://cdn.nba.com/headshots/nba/latest/260x190/${nbaPlayerId}.png`);
    nbaCdnUrls.push(`https://ak-static.cms.nba.com/wp-content/uploads/headshots/nba/latest/260x190/${nbaPlayerId}.png`);
  }

  // NBA CDN slug fallback
  const nbaCdnSlug = `${last.charAt(0).toUpperCase()}${last.slice(1)}_${first.charAt(0).toUpperCase()}${first.slice(1)}`;
  nbaCdnUrls.push(`https://cdn.nba.com/headshots/nba/latest/260x190/${nbaCdnSlug}.png`);
  nbaCdnUrls.push(`https://cdn.nba.com/headshots/nba/latest/260x190/${name.replace(/\./g, "").replace(/ /g, "_")}.png`);
  
  // Try both BBRef and all NBA CDN options (NBA playerId first, then others)
  return [...nbaCdnUrls, ...bbrefHeadshots];
}

function getInitials(name: string): string {
  // ... (unchanged)
  if (!name) return "";
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0][0] ? parts[0][0].toUpperCase() : "";
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function AvatarWithHeadshot({
  name,
  podium,
  size = 40,
  className = "",
}: {
  name: string;
  podium?: boolean;
  size?: number;
  className?: string;
}) {
  // ... (unchanged)
  const urls = getPlayerHeadshotUrls(name);
  const [imgUrlIdx, setImgUrlIdx] = useState(0);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgUrlIdx(0);
    setImgError(false);
    // eslint-disable-next-line
  }, [name]);

  if (!urls.length) {
    return (
      <div
        className={`rounded-full flex items-center justify-center font-bold text-sm border ${podium ? 'bg-amber-500 text-black border-amber-400' : 'bg-zinc-800 text-zinc-400 border-white/10'} ${className}`}
        style={{ width: size, height: size }}
      >
        {getInitials(name)}
      </div>
    );
  }

  if (imgError || imgUrlIdx >= urls.length) {
    return (
      <div
        className={`rounded-full flex items-center justify-center font-bold text-sm border ${podium ? 'bg-amber-500 text-black border-amber-400' : 'bg-zinc-800 text-zinc-400 border-white/10'} ${className}`}
        style={{ width: size, height: size }}
      >
        {getInitials(name)}
      </div>
    );
  }

  return (
    <img
      src={urls[imgUrlIdx]}
      alt={name}
      className={`object-cover rounded-full border ${podium ? 'bg-amber-500 border-amber-400' : 'bg-zinc-800 border-white/10'} ${className}`}
      width={size}
      height={size}
      onError={() => {
        if (imgUrlIdx + 1 < urls.length) {
          setImgUrlIdx(idx => idx + 1);
        } else {
          setImgError(true);
        }
      }}
      style={{ width: size, height: size, minWidth: size, minHeight: size, background: podium ? "#FFD700" : "#18181b"}}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  );
}

export default function MVPIndexPage() {
  const [players, setPlayers] = useState<PlayerStat[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerStat | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAndAggregatePlayers() {
      const { data, error } = await supabase
        .from("nba_games")
        .select("top_player_name, top_player_pts, watchability_score");

      if (error || !data) {
        setLoading(false);
        return;
      }
      const playerMap: Record<string, any> = {};

      data.forEach((game) => {
        const name = game.top_player_name;
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

      const rankedPlayers = Object.values(playerMap)
        .filter((p) => p.games >= 3)
        .map((p) => {
          const avgWatch = Math.round(p.totalWatch / p.games);
          const avgPts = Math.round(p.totalPts / p.games);
          const electricScore = avgWatch + (p.aPlusGames * 5) + (p.masterclasses * 5);
          return { ...p, avgWatch, avgPts, electricScore } as PlayerStat;
        })
        .sort((a, b) => b.electricScore - a.electricScore);

      setPlayers(rankedPlayers);
      if (rankedPlayers.length > 0) setSelectedPlayer(rankedPlayers[0]);
      setLoading(false);
    }

    fetchAndAggregatePlayers();
  }, []);

  // Mobile friendly state: show overlay mode for selected player on small screens
  const [showPlayerModal, setShowPlayerModal] = useState(false);

  // Detect mobile viewport using window.matchMedia (optional enhancement)
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Use window.matchMedia to handle responsive logic (no SSR issue on useEffect)
    function onResize() {
      setIsMobile(window.innerWidth <= 768);
    }
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // When selecting a player on mobile, also trigger the modal
  function handleSelectPlayer(player: PlayerStat) {
    setSelectedPlayer(player);
    if (isMobile) {
      setShowPlayerModal(true);
    }
  }

  function PlayerTrophyCase({ player }: { player: PlayerStat }) {
    return (
      <div className="w-full max-w-lg space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Header */}
        <div className="flex flex-col items-center text-center space-y-4 border-b border-white/10 pb-8">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 p-1 shadow-[0_0_30px_rgba(245,158,11,0.3)]">
            <div className="w-full h-full flex items-center justify-center rounded-full bg-black overflow-hidden">
              <AvatarWithHeadshot
                name={player.name}
                size={88}
                podium={true}
                className="text-3xl font-black text-amber-500"
              />
            </div>
          </div>
          <div>
            <h2 className="text-4xl font-black text-white tracking-tight">{player.name}</h2>
            <p className="text-amber-500 font-mono mt-2">Electric Index: {player.electricScore}</p>
          </div>
        </div>
        {/* Trophy Case Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 text-center hover:bg-white/[0.04] transition-colors">
            <div className="text-4xl mb-2">🍿</div>
            <div className="text-3xl font-bold text-white">{player.avgWatch}<span className="text-sm text-zinc-600">/100</span></div>
            <div className="text-xs text-zinc-500 uppercase tracking-widest mt-1">Avg Watchability</div>
          </div>
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 text-center hover:bg-white/[0.04] transition-colors">
            <div className="text-4xl mb-2">🔥</div>
            <div className="text-3xl font-bold text-white">{player.aPlusGames}</div>
            <div className="text-xs text-zinc-500 uppercase tracking-widest mt-1">&quot;A+&quot; Tier Games</div>
          </div>
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 text-center hover:bg-white/[0.04] transition-colors">
            <div className="text-4xl mb-2">👑</div>
            <div className="text-3xl font-bold text-white">{player.masterclasses}</div>
            <div className="text-xs text-zinc-500 uppercase tracking-widest mt-1">40+ Pt Games</div>
          </div>
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 text-center hover:bg-white/[0.04] transition-colors">
            <div className="text-4xl mb-2">📈</div>
            <div className="text-3xl font-bold text-white">{player.highestPts}</div>
            <div className="text-xs text-zinc-500 uppercase tracking-widest mt-1">Season High (Pts)</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#0a0a0a] text-zinc-200 font-sans flex flex-col md:flex-row overflow-hidden">
      {/* LEFT COLUMN: Player Rankings */}
      <div className="w-full md:w-[45%] md:max-w-xl h-[56vh] md:h-full border-b md:border-b-0 md:border-r border-white/10 flex flex-col bg-[#0f0f0f]">
        <div className="p-4 md:p-6 border-b border-white/10 shrink-0 bg-black/20">
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">The Electric MVP</h1>
          <p className="text-xs md:text-sm text-zinc-400 mt-1">Ranking the league&apos;s most entertaining players.</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2 md:p-4 space-y-2 md:space-y-3 relative">
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
                onClick={() => handleSelectPlayer(player)}
                className={`w-full text-left flex items-center gap-2 md:gap-4 p-3 md:p-4 rounded-xl transition-all border ${
                  isSelected 
                    ? "bg-amber-500/10 border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.1)]" 
                    : "bg-white/[0.01] border-white/5 hover:bg-white/[0.03]"
                }`}
              >
                <div className={`w-6 text-center font-black text-base md:text-lg ${isPodium ? 'text-amber-500' : 'text-zinc-600'}`}>
                  {index + 1}
                </div>
                <AvatarWithHeadshot
                  name={player.name}
                  podium={isPodium}
                  size={36}
                  className="shrink-0"
                />
                <div className="flex-1">
                  <div className={`font-bold ${isPodium ? 'text-white' : 'text-zinc-300'} text-sm md:text-base`}>
                    {player.name}
                  </div>
                  <div className="text-[11px] md:text-xs text-zinc-500">
                    Led {player.games} games • Season High {player.highestPts} pts
                  </div>
                </div>
                <div className="text-right hidden xs:block">
                  <div className="text-[10px] md:text-xs uppercase tracking-wider text-zinc-500 mb-1">Index</div>
                  <div className={`text-lg md:text-xl font-black ${isPodium ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'text-white'}`}>
                    {player.electricScore}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      {/* RIGHT COLUMN: Player Trophy Case */}
      <div className="relative w-full md:w-[55%] flex-1 h-full p-4 md:p-12 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/[0.03] to-[#0a0a0a] flex flex-col items-center justify-center">
        {/* On mobile, show as modal overlay */}
        {isMobile ? (
          showPlayerModal && selectedPlayer ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in" onClick={() => setShowPlayerModal(false)}>
              <div
                className="bg-[#111] rounded-2xl max-w-sm w-[92vw] mx-auto min-h-[60vh] p-4 shadow-xl flex flex-col relative"
                onClick={e => e.stopPropagation()}
              >
                <button
                  className="absolute top-3 right-3 text-white text-2xl bg-black/30 rounded-full w-10 h-10 flex items-center justify-center hover:bg-black/50 transition"
                  aria-label="Close"
                  onClick={() => setShowPlayerModal(false)}
                >
                  ×
                </button>
                {selectedPlayer && <PlayerTrophyCase player={selectedPlayer} />}
              </div>
            </div>
          ) : (
            <div className="w-full text-center text-zinc-600 text-sm md:hidden p-6">Tap a player to view their details.</div>
          )
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            {selectedPlayer ? (
              <PlayerTrophyCase player={selectedPlayer} />
            ) : (
              <div className="text-zinc-600 text-sm">Loading player data...</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}