import { next, waitUntil } from "@vercel/functions";
import { decideVisit, sendVisitEmail, seenCookie } from "./src/site/visit-alert.mjs";

type RequestContext = { waitUntil?: (promise: Promise<unknown>) => void };

export const config = {
  matcher: ["/((?!api/|icons/|_next/|.*\\.[a-zA-Z0-9]+$).*)"],
};

function keepAlive(context: RequestContext | undefined, task: Promise<unknown>) {
  if (typeof context?.waitUntil === "function") {
    context.waitUntil(task);
    return;
  }
  waitUntil(task);
}

export default function middleware(request: Request, context?: RequestContext) {
  const url = new URL(request.url);
  const decision = decideVisit({
    method: request.method,
    url,
    headers: request.headers,
    env: process.env.VERCEL_ENV,
    hasApiKey: Boolean(process.env.RESEND_API_KEY),
  });
  if (!decision.send) return next();

  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    keepAlive(
      context,
      sendVisitEmail(apiKey, decision.email).then((id) => {
        if (id) console.log(`visit-alert id=${id}`);
      }),
    );
  }

  return next({
    headers: {
      "set-cookie": seenCookie(),
    },
  });
}
