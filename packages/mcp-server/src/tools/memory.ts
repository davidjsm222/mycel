import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const memoryRoleSchema = z.enum(["fact", "note", "tool", "misc"]);
const memorySourceSchema = z.enum(["user", "agent", "system", "import"]);

const readInputSchema = z.object({
  target_agent_id: z
    .string()
    .uuid()
    .optional()
    .describe(
        "Whose memories to read. Omit to read this MCP agent’s own memories. " +
        "To read another agent’s memories under the same account, that agent’s owner must grant this agent via dashboard → Memory readers.",
    ),
  session_id: z
    .string()
    .uuid()
    .optional()
    .describe("If set, only memories linked to this session are returned."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(200)
    .optional()
    .default(50)
    .describe("Max rows (newest first)."),
});

const writeInputSchema = z.object({
  content: z.string().min(1).describe("Memory body (non-empty)."),
  session_id: z
    .string()
    .uuid()
    .optional()
    .describe(
      "Optional session to attach this memory to; must belong to your agent.",
    ),
  role: memoryRoleSchema.optional().default("fact").describe("fact | note | tool | misc"),
  source: memorySourceSchema
    .optional()
    .default("agent")
    .describe("user | agent | system | import"),
  facets: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Arbitrary JSON object for extra structure."),
});

export function registerMemoryTools(
  server: McpServer,
  supabase: SupabaseClient,
  getCallerAgentId: () => Promise<string>,
): void {
  server.registerTool(
    "read_memory",
    {
      title: "Read memory",
      description:
        "Fetch memory rows for an agent you may access (yourself, or another agent if the owner granted you in the web dashboard / memory_access). " +
        "Newest first.",
      inputSchema: readInputSchema,
      annotations: {
        title: "Read memory",
        readOnlyHint: true,
      },
    },
    async (input) => {
      try {
        const parsed = readInputSchema.parse(input);
        const callerId = await getCallerAgentId();
        const targetId = parsed.target_agent_id ?? callerId;

        if (targetId !== callerId) {
          const { data: allowed, error: denyErr } = await supabase.rpc(
            "can_read_agent_memories",
            {
              p_reader: callerId,
              p_memory_owner: targetId,
            },
          );
          if (denyErr) {
            return {
              content: [
                { type: "text", text: `Permission check failed: ${denyErr.message}` },
              ],
              isError: true,
            };
          }
          if (!allowed) {
            return {
              content: [
                {
                  type: "text",
                  text:
                    "Not allowed to read this agent’s memories (grant missing or not same account).",
                },
              ],
              isError: true,
            };
          }
        }

        let q = supabase
          .from("memories")
          .select(
            "id, agent_id, session_id, role, content, facets, source, created_at",
          )
          .eq("agent_id", targetId)
          .order("created_at", { ascending: false })
          .limit(parsed.limit);

        if (parsed.session_id) {
          q = q.eq("session_id", parsed.session_id);
        }

        const { data: rows, error } = await q;
        if (error) {
          return {
            content: [{ type: "text", text: error.message }],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { agent_id: targetId, count: rows?.length ?? 0, memories: rows },
                null,
                2,
              ),
            },
          ],
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [{ type: "text", text: msg }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "write_memory",
    {
      title: "Write memory",
      description:
        "Append a memory row for your agent (optionally tied to a session that belongs to you).",
      inputSchema: writeInputSchema,
      annotations: {
        title: "Write memory",
        destructiveHint: false,
        idempotentHint: false,
      },
    },
    async (input) => {
      try {
        const parsed = writeInputSchema.parse(input);
        const agentId = await getCallerAgentId();

        if (parsed.session_id) {
          const { data: sess, error: se } = await supabase
            .from("sessions")
            .select("id")
            .eq("id", parsed.session_id)
            .eq("agent_id", agentId)
            .maybeSingle();
          if (se) {
            return {
              content: [{ type: "text", text: se.message }],
              isError: true,
            };
          }
          if (!sess) {
            return {
              content: [
                {
                  type: "text",
                  text:
                    "session_id is not valid for this agent (wrong id or not owned by you).",
                },
              ],
              isError: true,
            };
          }
        }

        const { data: row, error } = await supabase
          .from("memories")
          .insert({
            agent_id: agentId,
            session_id: parsed.session_id ?? null,
            role: parsed.role,
            content: parsed.content.trim(),
            facets: parsed.facets ?? {},
            source: parsed.source,
          })
          .select("id, agent_id, session_id, role, content, source, created_at")
          .single();

        if (error) {
          return {
            content: [{ type: "text", text: error.message }],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ memory: row }, null, 2),
            },
          ],
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [{ type: "text", text: msg }],
          isError: true,
        };
      }
    },
  );
}
