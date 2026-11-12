import type { APIRoute } from "astro";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "../lib/mcp";

export const POST: APIRoute = async ({ request }) => {
  const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
  await createMcpServer().connect(transport);
  return transport.handleRequest(request);
};

const notAllowed: APIRoute = () => new Response(null, { status: 405, headers: { Allow: "POST" } });

export const GET = notAllowed;
export const DELETE = notAllowed;
