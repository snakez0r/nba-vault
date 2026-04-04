"use client";

import Link from "next/link";

// For this example, use ESPN team logos (public CDN).
// Logo URLs use format: https://a.espncdn.com/i/teamlogos/nba/500/[teamLogoSlug].png
// Note: ESPN logos often use slightly different abbreviations than common NBA abbreviations.
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
  GSW: "gs",      // ESPN uses "gs" for Golden State
  HOU: "hou",
  IND: "ind",
  LAC: "lac",
  LAL: "lal",
  MEM: "mem",
  MIA: "mia",
  MIL: "mil",
  MIN: "min",
  NOP: "no",      // New Orleans
  NYK: "ny",      // ESPN uses "ny" for New York
  OKC: "okc",
  ORL: "orl",
  PHI: "phi",
  PHX: "phx",
  POR: "por",
  SAC: "sac",
  SAS: "sa",      // ESPN uses "sa" for San Antonio
  TOR: "tor",
  UTA: "utah",    // ESPN uses "utah" for Utah Jazz
  WAS: "wsh",     // ESPN uses "wsh" for Washington
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
  { name: "Golden State Warriors", abbr: "GS" },    // ESPN uses "gs"
  { name: "Houston Rockets", abbr: "HOU" },
  { name: "Indiana Pacers", abbr: "IND" },
  { name: "Los Angeles Clippers", abbr: "LAC" },
  { name: "Los Angeles Lakers", abbr: "LAL" },
  { name: "Memphis Grizzlies", abbr: "MEM" },
  { name: "Miami Heat", abbr: "MIA" },
  { name: "Milwaukee Bucks", abbr: "MIL" },
  { name: "Minnesota Timberwolves", abbr: "MIN" },
  { name: "New Orleans Pelicans", abbr: "NO" },     // ESPN uses "no"
  { name: "New York Knicks", abbr: "NY" },          // ESPN uses "ny"
  { name: "Oklahoma City Thunder", abbr: "OKC" },
  { name: "Orlando Magic", abbr: "ORL" },
  { name: "Philadelphia 76ers", abbr: "PHI" },
  { name: "Phoenix Suns", abbr: "PHX" },
  { name: "Portland Trail Blazers", abbr: "POR" },
  { name: "Sacramento Kings", abbr: "SAC" },
  { name: "San Antonio Spurs", abbr: "SA" },        // ESPN uses "sa"
  { name: "Toronto Raptors", abbr: "TOR" },
  { name: "Utah Jazz", abbr: "UTAH" },              // ESPN uses "utah"
  { name: "Washington Wizards", abbr: "WSH" },      // ESPN uses "wsh"
];

function getTeamLogoUrl(abbr: string) {
  const key = teamLogoMap[abbr] || abbr.toLowerCase();
  return `https://a.espncdn.com/i/teamlogos/nba/500/${key}.png`;
}

export default function TeamSelectPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-200 flex flex-col items-center py-20">
      <h1 className="text-4xl font-black mb-2 text-white">NBA Teams</h1>
      <p className="text-zinc-400 mb-8 text-center max-w-md">
        Select a team to explore their games and players.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 w-full max-w-4xl">
        {teams.map((team) => (
          <Link
            key={team.abbr}
            href={`/team/${team.abbr}`}
            className="group bg-white/[0.04] border border-white/10 hover:bg-amber-500/10 hover:border-amber-400/30 rounded-xl px-6 py-5 flex items-center gap-4 transition-colors shadow-md"
          >
            <div className="w-12 h-12 rounded-full bg-black/80 flex items-center justify-center border border-white/10 overflow-hidden group-hover:bg-amber-500 transition-colors">
              <img
                src={getTeamLogoUrl(team.abbr)}
                alt={`${team.name} logo`}
                className="w-10 h-10 object-contain"
                loading="lazy"
              />
            </div>
            <div>
              <div className="font-bold text-white text-lg group-hover:text-amber-400 transition-colors">
                {team.name}
              </div>
              <div className="text-xs text-zinc-500 font-mono mt-0.5">{team.abbr}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}