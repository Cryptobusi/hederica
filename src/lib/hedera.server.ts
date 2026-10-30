import config from "./hedera-testnet.json";

const MIRROR = "https://testnet.mirrornode.hedera.com";
const KINDS = new Set(["post", "update", "hold", "refuse", "settle", "trial", "fill", "seat", "latch"]);
const hits = new Map<string, number[]>();

export type HederaConfig = {
  network: "testnet";
  operatorId: string;
  operatorKey: string;
  topicId: string;
};

export function hederaConfig(): HederaConfig {
  return {
    network: "testnet",
    operatorId: process.env.HEDERA_OPERATOR_ID || config.operatorId || "",
    operatorKey: process.env.HEDERA_OPERATOR_KEY || config.operatorKey || "",
    topicId: process.env.HEDERA_TOPIC_ID || config.topicId || "",
  };
}

export function hederaReady(cfg = hederaConfig()): boolean {
  return Boolean(cfg.operatorId && cfg.operatorKey && cfg.topicId);
}

function clip(value: unknown, max = 180): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function allow(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((at) => now - at < 60_000);
  if (recent.length >= 30) {
    hits.set(ip, recent);
    return false;
  }
  recent.push(now);
  hits.set(ip, recent);
  return true;
}

export async function readTape(limit = 15) {
  const cfg = hederaConfig();
  if (!cfg.topicId) {
    return {
      ok: true,
      ready: false,
      network: cfg.network,
      topicId: "",
      messages: [] as { sequence: number; at: string; text: string }[],
      error: "No testnet topic is configured.",
    };
  }
  const url = `${MIRROR}/api/v1/topics/${cfg.topicId}/messages?limit=${limit}&order=desc`;
  const response = await fetch(url);
  if (!response.ok) {
    return {
      ok: false,
      ready: hederaReady(cfg),
      network: cfg.network,
      topicId: cfg.topicId,
      messages: [],
      error: "Mirror node did not return the topic.",
    };
  }
  const body = (await response.json()) as {
    messages?: { sequence_number: number; consensus_timestamp: string; message: string }[];
  };
  const messages = (body.messages ?? []).map((row) => ({
    sequence: row.sequence_number,
    at: row.consensus_timestamp,
    text: Buffer.from(row.message, "base64").toString("utf8"),
  }));
  return { ok: true, ready: hederaReady(cfg), network: cfg.network, topicId: cfg.topicId, messages };
}

export async function submitLine(input: Record<string, unknown>, ip: string) {
  const cfg = hederaConfig();
  if (!hederaReady(cfg)) {
    return {
      ok: false,
      status: 503,
      error: "Testnet operator is not funded on this copy yet.",
    };
  }
  if (!allow(ip)) {
    return { ok: false, status: 429, error: "Too many testnet lines. Wait a minute." };
  }
  const kind = clip(input.kind, 24);
  if (!KINDS.has(kind)) {
    return { ok: false, status: 400, error: "That line is not a book event." };
  }
  const message = JSON.stringify({
    v: 1,
    net: "testnet",
    kind,
    title: clip(input.title),
    want: clip(input.want),
    side: clip(input.side, 16),
    by: clip(input.by, 40),
    handle: clip(input.handle, 40),
    category: clip(input.category, 40),
    settlement: clip(input.settlement, 24),
    note: clip(input.note, 280),
    at: Date.now(),
  });
  if (Buffer.byteLength(message) > 1024) {
    return { ok: false, status: 400, error: "The line is longer than one consensus message." };
  }

  const sdk = await import("@hashgraph/sdk");
  const client = sdk.Client.forTestnet();
  client.setOperator(sdk.AccountId.fromString(cfg.operatorId), sdk.PrivateKey.fromString(cfg.operatorKey));
  try {
    const tx = await new sdk.TopicMessageSubmitTransaction()
      .setTopicId(sdk.TopicId.fromString(cfg.topicId))
      .setMessage(message)
      .execute(client);
    const receipt = await tx.getReceipt(client);
    return {
      ok: true,
      status: 200,
      network: "testnet",
      topicId: cfg.topicId,
      sequenceNumber: receipt.topicSequenceNumber?.toString() ?? null,
      transactionId: tx.transactionId.toString(),
    };
  } finally {
    client.close();
  }
}
