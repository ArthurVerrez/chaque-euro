import type { APIRoute } from "astro";
import { getManifest } from "../../lib/data";

export const GET: APIRoute = async () =>
  Response.json(await getManifest(), {
    headers: { "Cache-Control": "public, max-age=300, s-maxage=3600" },
  });
