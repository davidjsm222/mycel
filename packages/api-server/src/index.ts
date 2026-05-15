import { createServiceRoleClient, loadMycelEnv } from "@mycel/shared";
import cors from "@fastify/cors";
import Fastify from "fastify";

loadMycelEnv();

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

function parseBearerKey(
  authorization: string | undefined,
): { prefix: string; secret: string } | null {
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }
  const raw = authorization.slice("Bearer ".length).trim();
  const dot = raw.indexOf(".");
  if (dot < 1 || dot === raw.length - 1) {
    return null;
  }
  const prefix = raw.slice(0, dot);
  const secret = raw.slice(dot + 1);
  if (!secret) {
    return null;
  }
  return { prefix, secret };
}

async function main(): Promise<void> {
  const port = Number(process.env.PORT ?? "3000");
  const supabase = createServiceRoleClient();

  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });

  app.get("/health", async () => {
    return { status: "ok" };
  });

  app.get("/memories", async (request, reply) => {
    const parsed = parseBearerKey(request.headers.authorization);
    if (!parsed) {
      return reply.code(401).send({
        error:
          "Missing or invalid Authorization header. Expected: Authorization: Bearer <prefix>.<secret>",
      });
    }

    const { data: readerId, error: vErr } = await supabase.rpc(
      "verify_agent_api_key",
      { p_prefix: parsed.prefix, p_secret: parsed.secret },
    );
    if (vErr) {
      request.log.error(vErr, "verify_agent_api_key");
      return reply.code(500).send({ error: "Authentication failed" });
    }
    if (readerId == null) {
      return reply.code(401).send({ error: "Invalid API key" });
    }
    const readerAgentId = String(readerId);

    const q = request.query as Record<string, string | undefined>;
    const targetRaw = q.target_agent_id?.trim();
    const targetAgentId =
      targetRaw && targetRaw.length > 0 ? targetRaw : readerAgentId;

    if (targetRaw && !isUuid(targetAgentId)) {
      return reply.code(400).send({ error: "Invalid target_agent_id" });
    }

    if (targetAgentId !== readerAgentId) {
      const { data: allowed, error: cErr } = await supabase.rpc(
        "can_read_agent_memories",
        {
          p_reader: readerAgentId,
          p_memory_owner: targetAgentId,
        },
      );
      if (cErr) {
        request.log.error(cErr, "can_read_agent_memories");
        return reply.code(500).send({ error: "Permission check failed" });
      }
      if (!allowed) {
        return reply
          .code(403)
          .send({ error: "Not allowed to read this agent's memories" });
      }
    }

    let limit = 50;
    if (q.limit !== undefined && q.limit !== "") {
      const n = Number(q.limit);
      if (!Number.isFinite(n) || n < 1) {
        return reply.code(400).send({ error: "Invalid limit" });
      }
      limit = Math.min(200, Math.floor(n));
    }

    const { data: rows, error: mErr } = await supabase
      .from("memories")
      .select(
        "id, agent_id, session_id, role, content, facets, source, created_at",
      )
      .eq("agent_id", targetAgentId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (mErr) {
      request.log.error(mErr, "memories query");
      return reply.code(500).send({ error: mErr.message });
    }

    return rows ?? [];
  });

  await app.listen({ port, host: "0.0.0.0" });
  app.log.info(`Mycel API listening on http://0.0.0.0:${port}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
