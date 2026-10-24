import test from "node:test";
import assert from "node:assert";
import { parse, takeToken } from "../netlify/functions/plan.mjs";

test("parse: fenced JSON, drops invented principles, habit-only identity", () => {
  const out = parse('```json\n' + JSON.stringify({
    type: "deadline", title: "File taxes", reason: "fear", first_move: "open the folder",
    principles: ["Pre-mortem", "Quantum motivation"], identity: "I am...",
    steps: [{ text: "gather W2", minutes: 99 }], milestones: [{ text: "draft", when: "3 days before" }],
  }) + '\n```');
  assert.deepEqual(out.principles.map((p) => p.name), ["Pre-mortem"]);
  assert.equal(out.steps[0].minutes, 25);
  assert.equal(out.identity, "");
  assert.equal(out.milestones.length, 1);
  assert.throws(() => parse('{"type":"nope","steps":[1]}'));
});

test("takeToken: allows up to the limit, resets on a new day", async () => {
  const m = new Map();
  const store = { get: async (k) => m.get(k) ?? null, set: async (k, v) => void m.set(k, v) };
  assert.deepEqual([await takeToken(store, 2, "d1"), await takeToken(store, 2, "d1"), await takeToken(store, 2, "d1")], [true, true, false]);
  assert.equal(await takeToken(store, 2, "d2"), true);
});

import { contextBlock } from "../netlify/lib/context.mjs";
import { cleanTasks } from "../netlify/functions/user.mjs";

test("contextBlock: overload kicks in at 6 open tasks and quotes user text safely", () => {
  const task = (done) => ({ done, plan: { title: "T", type: "petty" } });
  const six = { name: 'Ra"hul', about: "", tasks: Array.from({ length: 6 }, () => task(false)) };
  assert.match(contextBlock(six), /OVERLOADED/);
  assert.match(contextBlock(six), /"Ra\\"hul"/);
  assert.doesNotMatch(contextBlock({ tasks: [task(false)] }), /OVERLOADED|busy/);
  assert.equal(contextBlock(null), "");
});

test("cleanTasks: rejects junk, keeps valid tasks", () => {
  const ok = { id: 1, i: 0, done: false, plan: { type: "habit", steps: [] } };
  assert.equal(cleanTasks([ok]).length, 1);
  assert.throws(() => cleanTasks([{ plan: { type: "evil", steps: [] } }]));
  assert.throws(() => cleanTasks(new Array(51).fill(ok)));
});
