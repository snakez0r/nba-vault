import { NextRequest, NextResponse } from "next/server";
import { getScoreboard, getSummary } from "@/lib/espn";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  let date = searchParams.get("date") || "20251022"; // Defaulting to an early season date

  try {
    const scoreboard = await getScoreboard(date);
    const events = scoreboard?.events || [];
    
    if (events.length === 0) {
      return NextResponse.json({ error: "No games found on this date" });
    }

    // Just grab the very first game of the night
    const firstEvent = events[0];
    const eventId = firstEvent.id;
    const summary = await getSummary(eventId);

    // Return our "guesses" plus the raw ESPN JSON so we can hunt for it
    return NextResponse.json({
      message: "Dry run successful",
      gameName: firstEvent.name,
      our_scoreboard_guess: firstEvent?.competitions?.[0]?.leadChanges,
      our_summary_guess: summary?.header?.competitions?.[0]?.leadChanges,
      raw_scoreboard_event: firstEvent,
      raw_summary: summary
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}