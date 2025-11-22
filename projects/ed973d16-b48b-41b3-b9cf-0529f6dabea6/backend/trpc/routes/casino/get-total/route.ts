import { publicProcedure } from "../../../create-context";
import * as fs from "fs/promises";
import * as path from "path";

export const getCasinoTotalProcedure = publicProcedure.query(async () => {
  const dataPath = path.join(process.cwd(), "DATA", "casino-activity.csv");

  try {
    const data = await fs.readFile(dataPath, "utf-8");
    const lines = data.split("\n").filter((line) => line.trim() && !line.startsWith("ship"));
    
    let totalPoints = 0;
    let totalWinnings = 0;
    const activities: Array<{
      ship: string;
      points: number;
      winnings: number;
      date: string;
    }> = [];

    for (const line of lines) {
      const match = line.match(/"([^"]+)",(\d+),([\d.]+),"([^"]+)"/);
      if (match) {
        const [, ship, points, winnings, date] = match;
        const pointsNum = parseInt(points, 10);
        const winningsNum = parseFloat(winnings);
        
        totalPoints += pointsNum;
        totalWinnings += winningsNum;
        
        activities.push({
          ship,
          points: pointsNum,
          winnings: winningsNum,
          date,
        });
      }
    }

    return {
      totalPoints,
      totalWinnings,
      activities,
    };
  } catch (error) {
    return {
      totalPoints: 0,
      totalWinnings: 0,
      activities: [],
    };
  }
});
