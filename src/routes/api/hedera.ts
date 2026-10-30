import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/hedera")({
  server: {
    handlers: {
      GET: async () => {
        const { readTape } = await import("@/lib/hedera.server");
        const tape = await readTape();
        return Response.json(tape);
      },
      POST: async ({ request }) => {
        const { submitLine } = await import("@/lib/hedera.server");
        const raw = await request.text();
        if (raw.length > 4000) {
          return Response.json({ ok: false, error: "Line is too long." }, { status: 400 });
        }
        let body: Record<string, unknown> = {};
        try {
          const parsed = JSON.parse(raw) as unknown;
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return Response.json({ ok: false, error: "Send a book line." }, { status: 400 });
          }
          body = parsed as Record<string, unknown>;
        } catch {
          return Response.json({ ok: false, error: "Send a book line." }, { status: 400 });
        }
        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
        try {
          const result = await submitLine(body, ip);
          const status = result.status;
          return Response.json(result, { status });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Testnet submit failed.";
          return Response.json({ ok: false, error: message }, { status: 502 });
        }
      },
    },
  },
});
