import { z } from "zod";
import { publicProcedure } from "../../../create-context";
import * as fs from "fs/promises";
import * as path from "path";

export const addCasinoActivityProcedure = publicProcedure
  .input(
    z.object({
      ship: z.string(),
      points: z.number(),
      winnings: z.number(),
      date: z.string().optional(),
      notes: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const dataPath = path.join(process.cwd(), "DATA", "casino-activity.csv");
    
    const newEntry = {
      ship: input.ship,
      points: input.points,
      winnings: input.winnings,
      date: input.date || new Date().toISOString(),
      notes: input.notes || "",
      timestamp: new Date().toISOString(),
    };

    try {
      let existingData = "";
      try {
        existingData = await fs.readFile(dataPath, "utf-8");
      } catch (err) {
        existingData = "ship,points,winnings,date,notes,timestamp\n";
      }

      const csvLine = `"${newEntry.ship}",${newEntry.points},${newEntry.winnings},"${newEntry.date}","${newEntry.notes}","${newEntry.timestamp}"\n`;
      
      await fs.writeFile(dataPath, existingData + csvLine, "utf-8");

      return {
        success: true,
        entry: newEntry,
        message: `Added ${input.points} points for ${input.ship}`,
      };
    } catch (error) {
      console.error("Error adding casino activity:", error);
      throw new Error("Failed to add casino activity");
    }
  });
