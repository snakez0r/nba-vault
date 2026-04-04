/**
 * Fetch the NBA scoreboard JSON from ESPN for the given date string.
 * @param dateString - The date in YYYYMMDD format (e.g., "20240412")
 * @returns The parsed JSON data from ESPN's NBA scoreboard endpoint.
 */
export async function getScoreboard(dateString: string): Promise<any> {
    const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${encodeURIComponent(dateString)}`;
    try {
      // Added { cache: "no-store" } to prevent Next.js from serving stale data
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Failed to fetch scoreboard: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      return data;
    } catch (error: any) {
      throw new Error(`getScoreboard error: ${error.message || error}`);
    }
  }
  
  /**
   * Fetch the NBA summary JSON from ESPN for a specific game/event ID.
   * @param gameId - The ESPN event/game ID (string)
   * @returns The parsed JSON data from ESPN's NBA summary endpoint.
   */
  export async function getSummary(gameId: string): Promise<any> {
    const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${encodeURIComponent(gameId)}`;
    try {
      // Added { cache: "no-store" } here as well
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Failed to fetch summary: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      return data;
    } catch (error: any) {
      throw new Error(`getSummary error: ${error.message || error}`);
    }
  }
  
  /**
   * Recursively search deeply nested objects/arrays for a key and return its value.
   * Returns the first value found for the targetKey.
   * @param obj - The object or array to search
   * @param targetKey - The key to look for
   * @returns The value matched, or undefined if none is found
   */
  export function findKeyRecursive(obj: any, targetKey: string): any | undefined {
    if (typeof obj !== "object" || obj === null) return undefined;
  
    if (Array.isArray(obj)) {
      for (const item of obj) {
        const value = findKeyRecursive(item, targetKey);
        if (typeof value !== "undefined") {
          return value;
        }
      }
    } else {
      for (const key of Object.keys(obj)) {
        if (key === targetKey) {
          return obj[key];
        }
        const value = findKeyRecursive(obj[key], targetKey);
        if (typeof value !== "undefined") {
          return value;
        }
      }
    }
    return undefined;
  }