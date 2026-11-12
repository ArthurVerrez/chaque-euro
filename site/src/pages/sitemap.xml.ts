import type { APIRoute } from "astro";
import { getSitemapFiles } from "../lib/data";
import { sitemapResponse } from "../lib/sitemap";

export const GET: APIRoute = async () =>
  sitemapResponse(
    "sitemapindex",
    ["pages", ...(await getSitemapFiles())].map((file) => `/sitemaps/${file}.xml`),
  );
