// POST /api/plan {task, excuse?} -> structured plan from hosted Gemma. Key stays server-side.
// Any OpenAI-compatible endpoint works: SLOTH_API_KEY (required), SLOTH_BASE_URL, SLOTH_MODEL.
import { getStore } from "@netlify/blobs";
import { users } from "../lib/db.mjs";
import { contextBlock, load } from "../lib/context.mjs";

// 5 requests/min per visitor, enforced by Netlify before the function runs.
export const config = { path: "/api/plan", rateLimit: { windowLimit: 5, windowSize: 60, aggregateBy: ["ip", "domain"] } };

// Global daily cap (all visitors) so token spend is bounded. Override with the DAILY_LIMIT env var.
export async function takeToken(store, limit, day = new Date().toISOString().slice(0, 10)) {
  const n = Number(await store.get(day)) || 0;
  if (n >= limit) return false;
  await store.set(day, String(n + 1)); // ponytail: read-modify-write isn't atomic, may overshoot slightly under bursts
  return true;
}

// Fixed library: the model may only cite these, so it can't invent "science". `evidence` is shown in the UI.
export const PRINCIPLES = {
  "5 Second Rule": "Mel Robbins. Popular, little formal research.",
  "2-Minute Rule": "Clear / Allen. Practitioner heuristic.",
  "Implementation intentions": "Gollwitzer. Strong evidence (meta-analyses).",
  "Habit stacking": "Fogg / Clear. Practitioner method built on cue-based habit research.",
  "Temptation bundling": "Milkman et al. 2014. Supported by a field experiment.",
  "Fresh start effect": "Dai, Milkman & Riis 2014. Supported by several studies.",
  "Goal-gradient effect": "Hull 1932, Kivetz 2006. Well replicated.",
  "Commitment device": "Behavioral economics. Supported by field studies.",
  "Identity-based habits": "Clear. Practitioner framing.",
  "Pre-mortem": "Klein. Practitioner method with some support.",
  "Planning fallacy buffer": "Kahneman & Tversky. Planning fallacy is well documented.",
  "Reduce friction": "Clear's 'make it easy'. Practitioner method.",
};
const TYPES = ["habit", "petty", "deadline"];
const REASONS = ["overwhelmed", "boring", "fear", "no_urgency", "low_energy"];

const PROMPT = (task, excuse, ctx) => `You are a warm, funny, non-judgmental procrastination coach.
The user keeps putting this off: "${task}"
Their excuse: "${excuse || "none given, they just admit they are lazy"}"
${ctx}

1. Classify it: "habit" (recurring, builds identity), "petty" (small one-off chore), or "deadline" (important, time-bound).
2. Diagnose why they slack: one of ${REASONS.join(", ")}.
3. Attack it from that angle using ONLY these principles (cite by exact name, pick 2-4):
${Object.keys(PRINCIPLES).join("; ")}.
Guide: habit -> Identity-based habits, Habit stacking, 2-Minute Rule, Temptation bundling, Reduce friction.
petty -> 5 Second Rule, 2-Minute Rule, Reduce friction. deadline -> Implementation intentions, Planning fallacy buffer, Commitment device, Pre-mortem, Goal-gradient effect.

Reply with ONLY JSON, no prose:
{"type": "...", "title": "<3-6 words>", "reason": "...",
 "diagnosis": "<one kind sentence, speak to the user as 'you'>",
 "principles": ["<exact name>", ...],
 "first_move": "<physical action doable in 5 seconds>",
 "if_then": "If <everyday cue>, then I <first_move>.",
 "steps": [{"text": "<concrete action>", "minutes": <2-25>}],   // 3-5 steps, startable without thinking
 "reward": "<small immediate reward>",
 "identity": "<'I am someone who...' for habits, else empty string>",
 "priority_note": "<one honest sentence on whether to do this now, schedule it or defer it, only when the user context asks for it, else empty string>",
 "milestones": [{"text": "...", "when": "<e.g. '3 days before'>"}]   // deadline only, else []
}`;

export function parse(text) {
  const d = JSON.parse(text.match(/\{[\s\S]*\}/)[0]); // Gemma may wrap JSON in ```fences
  if (!TYPES.includes(d.type)) throw new Error("bad type");
  if (!Array.isArray(d.steps) || !d.steps.length) throw new Error("no steps");
  return {
    type: d.type,
    title: String(d.title),
    reason: REASONS.includes(d.reason) ? d.reason : "no_urgency",
    diagnosis: String(d.diagnosis ?? ""),
    principles: (d.principles ?? []).filter((n) => n in PRINCIPLES).map((name) => ({ name, evidence: PRINCIPLES[name] })),
    first_move: String(d.first_move),
    if_then: String(d.if_then ?? ""),
    steps: d.steps.map((s) => ({ text: String(s.text), minutes: Math.min(25, Math.max(2, Number(s.minutes) || 5)) })),
    reward: String(d.reward ?? ""),
    priority_note: String(d.priority_note ?? ""),
    identity: d.type === "habit" ? String(d.identity ?? "") : "",
    milestones: d.type === "deadline" ? (d.milestones ?? []).map((m) => ({ text: String(m.text), when: String(m.when ?? "") })) : [],
  };
}

export default async (req) => {
  try {
    const { task, excuse, id } = await req.json();
    if (!task?.trim()) return Response.json({ error: "Tell me what you're avoiding." }, { status: 400 });
    try {
      if (!(await takeToken(getStore("usage"), Number(process.env.DAILY_LIMIT ?? 400)))) {
        return Response.json({ error: "The sloth council is out of energy for today. Come back tomorrow!" }, { status: 429 });
      }
    } catch { /* blobs hiccup: fail open so the demo keeps working */ }
    let user = null;
    try { user = /^[0-9a-f-]{36}$/.test(id ?? "") ? await (await users())?.findOne({ _id: id }) : null; } catch { /* db down: plan without context */ }
    const base = process.env.SLOTH_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta/openai";
    const r = await fetch(base.replace(/\/$/, "") + "/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.SLOTH_API_KEY}` },
      body: JSON.stringify({
        model: process.env.SLOTH_MODEL ?? "gemma-3-27b-it",
        messages: [{ role: "user", content: PROMPT(task.trim().slice(0, 300), (excuse ?? "").trim().slice(0, 200), contextBlock(user)) }],
      }),
    });
    if (!r.ok) throw new Error(`model host said ${r.status}`);
    return Response.json({ ...parse((await r.json()).choices[0].message.content), load: user ? load(user.tasks).level : "light" });
  } catch (e) {
    // ponytail: no rate limit; add Netlify rate-limiting rule before sharing the public URL widely
    return Response.json({ error: e.message }, { status: 500 });
  }
};
