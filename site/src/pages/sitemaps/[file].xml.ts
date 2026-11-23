import type { APIRoute } from "astro";
import { getLargeCities, getSitemapPaths } from "../../lib/data";
import { PUBLIC_SECTORS } from "../../lib/flows";
import { METRIC_ITEMS } from "../../lib/large-cities";
import { sitemapResponse } from "../../lib/sitemap";

const PAGES = [
  ...Object.keys(import.meta.glob("../**/*.astro"))
    .map((file) => file.slice(2, -".astro".length).replace(/\/?index$/, "") || "/")
    .filter((path) => !path.includes("[") && path !== "/404" && path !== "/recherche"),
  ...PUBLIC_SECTORS.map((sector) => `/argent-public/${sector.slug}`),
];

export const GET: APIRoute = async ({ params }) => {
  if (params.file === "pages") {
    const { cities } = await getLargeCities(METRIC_ITEMS);
    return sitemapResponse("urlset", [
      ...PAGES,
      ...cities.map((city) => `/analyses/grandes-villes/${city.slug}`),
    ]);
  }
  const [, name = "", file = ""] = /^([a-z-]+)-(\d+)$/.exec(params.file ?? "") ?? [];
  const paths = await getSitemapPaths(name, Number(file));
  return paths.length ? sitemapResponse("urlset", paths) : new Response(null, { status: 404 });
};
