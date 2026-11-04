import type { APIRoute } from "astro";
import { getAddressConstituencies } from "../../../lib/data";

export const GET: APIRoute = async ({ params }) => {
  if (!params.insee || !/^[0-9][0-9AB][0-9]{3}$/.test(params.insee)) {
    return new Response(null, { status: 404 });
  }
  const data = await getAddressConstituencies(params.insee);
  if (!data.commune) return new Response(null, { status: 404 });
  return Response.json(data, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
};
