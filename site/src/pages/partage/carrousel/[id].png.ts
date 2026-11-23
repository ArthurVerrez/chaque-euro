import type { APIRoute } from "astro";
import { renderCitySlide } from "../../../lib/carousel";
import { getLargeCities } from "../../../lib/data";
import { METRIC_ITEMS } from "../../../lib/large-cities";

export const GET: APIRoute = async ({ params }) => {
  const [, slug, index] = /^(.+)-(\d)$/.exec(params.id ?? "") ?? [];
  const { cities } = await getLargeCities(METRIC_ITEMS);
  const city = cities.find((entry) => entry.slug === slug);
  const png = city ? await renderCitySlide(cities, city, Number(index)) : null;
  if (!png) return new Response(null, { status: 404 });
  return new Response(png, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
};
