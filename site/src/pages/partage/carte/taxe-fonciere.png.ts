import type { APIRoute } from "astro";
import { renderTaxMap } from "../../../lib/carousel";
import { getPropertyTaxMap, getPropertyTaxSummary } from "../../../lib/data";

export const GET: APIRoute = async () =>
  new Response(await renderTaxMap(await getPropertyTaxMap(), await getPropertyTaxSummary()), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
