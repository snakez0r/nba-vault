import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getScoreboard, getSummary } from "@/lib/espn";
import { calculateWatchability } from "@/lib/math";

// Create Supabase client (do not import from outside api folder)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Helper functions copied from frontend for bulletproof parsing:
function getCompetitors(summary: any) {
  return summary?.header?.competitions?.[0]?.competitors ?? [];
}

function getScoreForTeam(competitors: any[], side: "home" | "away") {
  const obj = competitors.find((c: any) => c.homeAway === side);
  // ESPN sometimes has these as numbers or strings
  let score = obj?.score;
  if (typeof score === "number") {
    // Already a number
    return Number.isFinite(score) ? score : null;
  } else if (typeof score === "string") {
    let n = parseInt(score, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function getTeamAbbr(competitors: any[], side: "home" | "away") {
  const obj = competitors.find((c: any) => c.homeAway === side);
  return obj?.team?.abbreviation ?? null;
}

function getMargin(summary: any) {
  // Use the same frontend logic: winner's score - loser's score (always positive)
  const competitors = getCompetitors(summary);
  const scores = competitors.map((c: any) => parseInt(c?.score, 10));
  if (
    Array.isArray(scores) &&
    scores.length === 2 &&
    scores.every((s) => Number.isFinite(s))
  ) {
    return Math.abs(scores[0] - scores[1]);
  }
  return 0;
}


/**
 * Extract the top player (by points) from summary, exactly replicating the frontend's approach.
 * - Traverse summary?.boxscore?.players || [] (these are team-level objects)
 * - For each team, extract statistic keys
 * - Find indices for PTS, REB, AST, BLK, STL
 * - For each athlete, extract stats at those indices, all integers (default 0)
 * - Find the athlete with the highest pts, return { pts, reb, ast, blk, stl, name }
 */
function getTopPlayer(summary: any) {
    let bestPts = -1;
    let found = { pts: 0, reb: 0, ast: 0, blk: 0, stl: 0, name: "Team Effort" };

    const playersArrays = summary?.boxscore?.players || [];

    for (const team of playersArrays) {
        const statsObj = team?.statistics?.[0] || {};
        const labels = statsObj.names || statsObj.labels || [];
        
        // Find exactly where each stat lives in the array
        const ptsIdx = labels.findIndex((l: string) => l.toUpperCase() === 'PTS');
        const rebIdx = labels.findIndex((l: string) => l.toUpperCase() === 'REB');
        const astIdx = labels.findIndex((l: string) => l.toUpperCase() === 'AST');
        const blkIdx = labels.findIndex((l: string) => l.toUpperCase() === 'BLK');
        const stlIdx = labels.findIndex((l: string) => l.toUpperCase() === 'STL');

        if (ptsIdx === -1) continue;

        const athletes = statsObj.athletes || [];
        for (const athleteObj of athletes) {
        const stats = athleteObj?.stats || [];
        const pts = parseInt(stats[ptsIdx] || '0', 10);

        if (pts > bestPts) {
            bestPts = pts;
            found = {
            pts,
            reb: rebIdx !== -1 ? parseInt(stats[rebIdx] || '0', 10) : 0,
            ast: astIdx !== -1 ? parseInt(stats[astIdx] || '0', 10) : 0,
            blk: blkIdx !== -1 ? parseInt(stats[blkIdx] || '0', 10) : 0,
            stl: stlIdx !== -1 ? parseInt(stats[stlIdx] || '0', 10) : 0,
            name: athleteObj?.athlete?.displayName || "Unknown"
            };
        }
        }
    }
    return found;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  let date = searchParams.get("date");
  if (!date) {
    return NextResponse.json(
      { error: "Missing 'date' parameter. Format: YYYYMMDD" },
      { status: 400 }
    );
  }

  try {
    // Fetch scoreboard for the date (expects YYYYMMDD)
    const scoreboard = await getScoreboard(date);
    const events = scoreboard?.events || [];

    let syncCount = 0;

    // For each game/event
    for (const event of events) {
      const eventId = event?.id;
      if (!eventId) continue;

      try {
        // Grab lead changes DIRECTLY from the scoreboard event!
        const leadChanges = event?.competitions?.[0]?.leadChanges || 0;

        // Fetch summary for this game (for the deep stats)
        const summary = await getSummary(eventId);

        // Parsing per frontend (mirror logic):
        const competitors = getCompetitors(summary);
        const homeScore = getScoreForTeam(competitors, "home");
        const awayScore = getScoreForTeam(competitors, "away");
        const margin = getMargin(summary);
        
        // Grab the top player using our fixed function
        const topPlayer = getTopPlayer(summary);
        const playerStats = topPlayer;

        // Calculate watchability
        const watchabilityData = calculateWatchability(
          margin,
          leadChanges,
          playerStats,
          "Balanced"
        );

        // Extract capped and uncapped star power
        const watchScore = watchabilityData?.finalScore ?? null;
        const starPower = watchabilityData?.starPowerBonus ?? null;

        // Compute the uncapped/raw player stat score - this is prior to applying the starPowerBonus max cap.
        // We'll store this in 'true_player_score'.
        // To follow frontend: recalculate the raw score separately (math.ts caps at 30 for starPowerBonus).
        // Try to extract from the raw output if available, else recompute here.

        // If your math.ts returns .rawPlayerScore or similar, prefer that.
        // Otherwise, recompute according to your starPowerBonus formula *without the cap*.

        // We'll attempt to recompute using the likely star power (raw, uncapped) formula:
        let truePlayerScore: number | null = null;
        try {
          // Most likely: (PTS * 1) + (REB * 1.2) + (AST * 1.5) + (STL * 3) + (BLK * 3), but should match your frontend/math.ts.
          // If math.ts exposes the formula, import and use it here!
          // For now, hardcode the presumed formula:
          if (playerStats && typeof playerStats.pts === "number") {
            truePlayerScore =
              (playerStats.pts || 0) * 1 +
              (playerStats.reb || 0) * 1.2 +
              (playerStats.ast || 0) * 1.5 +
              (playerStats.stl || 0) * 3.0 +
              (playerStats.blk || 0) * 3.0;
            // Allow potentially huge values
            truePlayerScore = Math.round(truePlayerScore);
          }
        } catch (e) {
          truePlayerScore = null;
        }

        // If margin==0 && leadChanges==0 && playerStats.pts==0, skip upsert (per frontend)
        if (
          margin === 0 &&
          leadChanges === 0 &&
          playerStats.pts === 0
        ) {
          console.log("Skipped game:", eventId, "Reason: All stats 0");
          continue;
        }

        // Convert YYYYMMDD to YYYY-MM-DD for Postgres
        const dbDate = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;

        const gameData = {
          id: eventId,
          date: dbDate,
          home_team: getTeamAbbr(competitors, "home"),
          away_team: getTeamAbbr(competitors, "away"),
          home_score: homeScore,
          away_score: awayScore,
          watchability_score: watchScore,
          margin,
          lead_changes: leadChanges,
          star_power: starPower, // <-- 0–30-capped value for watchability
          hype_score: starPower, // Optional: saving starPower here too just to populate the column
          true_player_score: truePlayerScore, // <-- save full uncapped value (can exceed 30!)
          watch_style: "Balanced", // Hardcoding this so the DB knows how we graded it
          top_player_name: playerStats.name,
          top_player_pts: playerStats.pts,
          summary_json: summary, // Optional: save full summary for reference
        };

        // Upsert into Supabase
        const { data, error } = await supabase
          .from("nba_games")
          .upsert(gameData, { onConflict: "id" });

        if (error) {
          console.error("SUPABASE ERROR:", error);
        } else {
          syncCount++;
        }
      } catch (err: any) {
        // Log error, continue to next event (robust loop)
        console.error(`[nba sync] Failed to process event ${eventId}:`, err?.message || err);
        continue;
      }
    }

    return NextResponse.json({
      message: "Sync complete",
      date,
      games_synced: syncCount,
      total_games: events.length,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}