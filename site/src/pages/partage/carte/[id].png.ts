import type { APIRoute } from "astro";
import { TAX_SLIDES, renderTaxSlide } from "../../../lib/carousel";
import { getLargeCities, getPropertyTaxMap, getPropertyTaxSummary } from "../../../lib/data";

export const GET: APIRoute = async ({ params }) => {
  const [, index] = /^taxe-fonciere-(\d)$/.exec(params.id ?? "") ?? [];
  if (!index || Number(index) > TAX_SLIDES) return new Response(null, { status: 404 });
  const [map, summary, { cities }] = await Promise.all([
    getPropertyTaxMap(),
    getPropertyTaxSummary(),
    getLargeCities(["taxe_fonciere"]),
  ]);
  const png = await renderTaxSlide(Number(index), map, summary, cities);
  if (!png) return new Response(null, { status: 404 });
  return new Response(png, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
};
