import { z } from "zod";
import { publicProcedure } from "@/backend/trpc/create-context";

const inputSchema = z.object({
  token: z.string(),
  accountId: z.string(),
  loyaltyId: z.string(),
  brand: z.enum(["royal", "celebrity"]),
});

export const webOffersProcedure = publicProcedure
  .input(inputSchema)
  .mutation(async ({ input }) => {
    const { token, accountId, loyaltyId, brand } = input;

    const baseUrl =
      brand === "royal"
        ? "https://www.royalcaribbean.com"
        : "https://www.celebritycruises.com";

    const apiUrl = `${baseUrl}/api/casino/casino-offers/v1`;

    console.log("[web-offers] Fetching casino offers", {
      brand,
      accountId,
      loyaltyId,
    });

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "account-id": accountId,
        },
        body: JSON.stringify({
          loyaltyId,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[web-offers] API error:", response.status, errorText);
        throw new Error(
          `Failed to fetch offers: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();

      console.log(
        "[web-offers] Successfully fetched offers:",
        data?.offers?.length || 0
      );

      return {
        success: true,
        data,
        savedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error("[web-offers] Error:", error);
      throw new Error(
        error instanceof Error ? error.message : "Unknown error fetching offers"
      );
    }
  });
