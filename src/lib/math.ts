// --- Type Definitions ---
export interface PlayerStats {
  pts: number;
  reb: number;
  ast: number;
  blk: number;
  stl: number;
  name: string;
}

export interface WatchabilityResult {
  finalScore: number;
  grade: string;
  marginSubscore: number;
  leadChangesSubscore: number;
  starPowerBonus: number;
  topPlayerMessage: string;
}

// --- Helper: Hype Score Function ---
export function calculateHypeScore(stats: PlayerStats): number {
  return (
    stats.pts +
    1.2 * stats.reb +
    1.5 * stats.ast +
    3 * stats.blk +
    3 * stats.stl
  );
}

// --- Subscore: Margin Function (exponential decay) ---
function marginToScore(margin: number): number {
  if (margin <= 2) {
    return 100;
  } else if (margin <= 5) {
    return 90;
  } else if (margin <= 10) {
    return 70;
  } else if (margin <= 15) {
    // Decay rapidly from 70 to 20 between margin 11 and 15
    // (e.g., linear for simplicity in this window)
    return 70 - ((margin - 10) / 5) * 50; // 11=>60, ..., 15=>20
  } else {
    // Over 15, drop sharply toward zero using exponential decay
    // 20 margin ≈ ~7.6
    const decay = Math.exp(-0.41 * (margin - 15));
    return Math.max(0, 20 * decay);
  }
}

// --- Subscore: Lead Changes ---
function leadChangesToScore(leadChanges: number): number {
  if (leadChanges >= 15) {
    return 100;
  }
  return Math.max(0, (leadChanges / 15) * 100);
}

// --- Helper: Get Letter Grade ---
function getGrade(score: number): string {
  if      (score >= 96) return "A+";
  else if (score >= 90) return "A";
  else if (score >= 80) return "B";
  else if (score >= 70) return "C";
  else return "F";
}

// --- Helper: Star Power Bonus ---
function getStarPowerBonus(stats: PlayerStats): { bonus: number; message: string } {
  const hype = calculateHypeScore(stats);
  // Pts threshold checked first per spec
  if (stats.pts >= 60 || hype > 80) {
    return {
      bonus: 50,
      message: `🔥 ${stats.name} with all-time performance! (Hype Score: ${Math.round(hype)})`
    };
  } else if (stats.pts >= 40 || hype > 60) {
    return {
      bonus: 30,
      message: `⭐ ${stats.name} with a huge night! (Hype Score: ${Math.round(hype)})`
    };
  }
  return {
    bonus: 0,
    message: `Top player: ${stats.name} (Hype Score: ${Math.round(hype)})`
  };
}

// --- Main Watchability Calculator ---
export function calculateWatchability(
  margin: number,
  leadChanges: number,
  topPlayer: PlayerStats,
  watchStyle: "Balanced" | "Clutch Thriller" | "Superstar Show"
): WatchabilityResult {
  const marginSubscore = marginToScore(margin);
  const leadChangesSubscore = leadChangesToScore(leadChanges);

  let weightMargin = 0.75;
  let weightLead = 0.25;
  let starPowerMultiplier = 1;

  switch (watchStyle) {
    case "Balanced":
      weightMargin = 0.75;
      weightLead = 0.25;
      break;
    case "Clutch Thriller":
      weightMargin = 0.9;
      weightLead = 0.1;
      break;
    case "Superstar Show":
      weightMargin = 0.75;
      weightLead = 0.25;
      starPowerMultiplier = 2;
      break;
  }

  const { bonus: rawStarBonus, message: topPlayerMessage } = getStarPowerBonus(topPlayer);
  const starPowerBonus = rawStarBonus * starPowerMultiplier;

  const aggregate =
    marginSubscore * weightMargin +
    leadChangesSubscore * weightLead +
    starPowerBonus;

  const finalScore = Math.min(Math.round(aggregate), 100);
  const grade = getGrade(finalScore);

  return {
    finalScore,
    grade,
    marginSubscore: Math.round(marginSubscore),
    leadChangesSubscore: Math.round(leadChangesSubscore),
    starPowerBonus,
    topPlayerMessage
  };
}