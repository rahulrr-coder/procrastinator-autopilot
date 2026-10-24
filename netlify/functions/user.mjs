// /api/user: POST {name, about} creates a profile -> {id}; GET ?id loads it; PUT {id, name?, about?, tasks?} saves it.
// The random id lives in the visitor's browser and acts as their key. No passwords, nothing sensitive stored.
import { users } from "../lib/db.mjs";

export const config = { path: "/api/user", rateLimit: { windowLimit: 60, windowSize: 60, aggregateBy: ["ip", "domain"] } };

const ID = /^[0-9a-f-]{36}$/;
const TYPES = ["habit", "petty", "deadline"];
const text = (v, n) => String(v ?? "").trim().slice(0, n);

export function cleanTasks(tasks) {
  if (!Array.isArray(tasks) || tasks.length > 50) throw new Error("bad tasks");
  const out = tasks.map((t) => {
    if (!TYPES.includes(t?.plan?.type) || !Array.isArray(t.plan.steps)) throw new Error("bad task");
    return { id: Number(t.id), plan: t.plan, i: Math.max(0, Number(t.i) || 0), done: !!t.done, createdAt: Number(t.createdAt) || null, doneAt: Number(t.doneAt) || null };
  });
  if (JSON.stringify(out).length > 150_000) throw new Error("too big");
  return out;
}

export default async (req) => {
  try {
    const col = await users();
    if (!col) return Response.json({ error: "no database" }, { status: 503 });
    const url = new URL(req.url);

    if (req.method === "GET") {
      const id = url.searchParams.get("id") ?? "";
      const u = ID.test(id) && (await col.findOne({ _id: id }));
      return u ? Response.json({ name: u.name, about: u.about, tasks: u.tasks }) : Response.json({ error: "not found" }, { status: 404 });
    }

    const b = await req.json();
    if (req.method === "POST") {
      const id = crypto.randomUUID();
      await col.insertOne({ _id: id, name: text(b.name, 40), about: text(b.about, 300), tasks: [], createdAt: new Date(), seenAt: new Date() });
      return Response.json({ id });
    }

    if (req.method === "PUT") {
      if (!ID.test(b.id ?? "")) return Response.json({ error: "bad id" }, { status: 400 });
      const set = { seenAt: new Date() };
      if (b.name !== undefined) set.name = text(b.name, 40);
      if (b.about !== undefined) set.about = text(b.about, 300);
      if (b.tasks !== undefined) set.tasks = cleanTasks(b.tasks);
      const r = await col.updateOne({ _id: b.id }, { $set: set });
      return r.matchedCount ? Response.json({ ok: true }) : Response.json({ error: "not found" }, { status: 404 });
    }
    return new Response(null, { status: 405 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
};
