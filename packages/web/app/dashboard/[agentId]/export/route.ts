import { NextResponse } from "next/server";

import {
  buildMemoryMarkdownExport,
  slugifyExportBasename,
} from "@/lib/memory-export-md";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: { agentId: string };
};

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const agentId = context.params.agentId?.trim();

  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  if (!agentId) {
    return new NextResponse("Bad request", {
      status: 400,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  const { data: agent, error: agentErr } = await supabase
    .from("agents")
    .select("id, display_name, api_key_prefix")
    .eq("id", agentId)
    .maybeSingle();

  if (agentErr || !agent) {
    return new NextResponse("Not found", {
      status: 404,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  const { data: memories, error: memErr } = await supabase
    .from("memories")
    .select("role, source, content, created_at")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: true })
    .limit(10_000);

  if (memErr) {
    return new NextResponse(memErr.message, {
      status: 500,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  const exportedIso = new Date().toISOString();

  const body = buildMemoryMarkdownExport(
    {
      id: agent.id,
      display_name: agent.display_name ?? "Agent",
      api_key_prefix: agent.api_key_prefix,
    },
    memories ?? [],
    exportedIso,
  );

  const slug = slugifyExportBasename(agent.display_name ?? "agent");
  const datePart = exportedIso.slice(0, 10).replace(/-/g, "");
  const filename = `mycel-${slug}-${datePart}-memories.md`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "private, no-store",
      /* ASCII-only filename avoids header encoding issues */
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
