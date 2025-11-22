import { z } from "zod";
import { publicProcedure } from "@/backend/trpc/create-context";

const inputSchema = z.object({
  sailingIds: z.array(z.string()),
  brand: z.enum(["royal", "celebrity"]),
  token: z.string().optional(),
});

const GRAPHQL_QUERY = `
query cruiseSearch_Cruises($cruiseSearchInput: CruiseSearchInput!) {
  cruiseSearch {
    cruises(input: $cruiseSearchInput) {
      totalCount
      edges {
        node {
          id
          itineraryCode
          sailDate
          ship {
            name
            shipCode
          }
          itinerary {
            days {
              arrivalDate
              dayOfWeek
              departureDate
              duration
              order
              ports {
                arrivalTime
                departureTime
                isOvernight
                name
                portCode
              }
            }
            nights
          }
          taxesAndFees {
            base {
              amount
              currencyCode
            }
            total {
              amount
              currencyCode
            }
          }
          price {
            interior {
              total {
                amount
                currencyCode
              }
            }
            oceanview {
              total {
                amount
                currencyCode
              }
            }
            balcony {
              total {
                amount
                currencyCode
              }
            }
            suite {
              total {
                amount
                currencyCode
              }
            }
          }
          bookingUrl
        }
      }
    }
  }
}
`;

export const itineraryEnrichProcedure = publicProcedure
  .input(inputSchema)
  .mutation(async ({ input }) => {
    const { sailingIds, brand, token } = input;

    const baseUrl =
      brand === "royal"
        ? "https://www.royalcaribbean.com"
        : "https://www.celebritycruises.com";

    const graphUrl = `${baseUrl}/graph`;

    console.log("[itinerary-enrich] Enriching", sailingIds.length, "sailings");

    const CHUNK_SIZE = 30;
    const results: any[] = [];

    for (let i = 0; i < sailingIds.length; i += CHUNK_SIZE) {
      const chunk = sailingIds.slice(i, i + CHUNK_SIZE);

      const variables = {
        cruiseSearchInput: {
          sailingIds: chunk,
        },
      };

      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }

        const response = await fetch(graphUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({
            query: GRAPHQL_QUERY,
            variables,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            "[itinerary-enrich] GraphQL error:",
            response.status,
            errorText
          );
          continue;
        }

        const result = await response.json();

        if (result.data?.cruiseSearch?.cruises?.edges) {
          results.push(...result.data.cruiseSearch.cruises.edges);
        }

        if (result.errors) {
          console.error("[itinerary-enrich] GraphQL errors:", result.errors);
        }
      } catch (error) {
        console.error("[itinerary-enrich] Error for chunk:", error);
      }
    }

    console.log(
      "[itinerary-enrich] Successfully enriched",
      results.length,
      "sailings"
    );

    return {
      success: true,
      data: results,
      enrichedAt: new Date().toISOString(),
    };
  });
