// How loaded is this person, and what should the model know about them?
export function load(tasks = []) {
  const open = tasks.filter((t) => !t.done);
  return { open, done: tasks.length - open.length, level: open.length >= 6 ? "overloaded" : open.length >= 3 ? "busy" : "light" };
}

export function contextBlock(user) {
  if (!user) return "";
  const { open, done, level } = load(user.tasks);
  const lines = [];
  if (user.name) lines.push(`The user's name is ${JSON.stringify(user.name)}. Use it once, warmly.`);
  if (user.about) lines.push(`What they told us about themselves: ${JSON.stringify(user.about)}. Adapt tone and step size to this.`);
  lines.push(`Their open tasks (${open.length}): ${JSON.stringify(open.slice(0, 8).map((t) => `${t.plan?.title} [${t.plan?.type}]`))}. Finished so far: ${done}.`);
  if (level === "overloaded")
    lines.push("They are OVERLOADED. Use at most 3 tiny steps, acknowledge the overload kindly in the diagnosis, and in priority_note say honestly whether to do this now, schedule it, or defer/drop it compared with their other open tasks.");
  else if (level === "busy")
    lines.push("They are fairly busy. Keep steps small and use priority_note to say how this ranks against their open tasks.");
  return lines.join("\n");
}
