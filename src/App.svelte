<script>
  import { onMount } from "svelte";
  import { fly, fade } from "svelte/transition";
  import { quintOut } from "svelte/easing";
  import Sloth from "./Sloth.svelte";

  const TYPE = { habit: "Habit", petty: "Quick task", deadline: "Deadline" };
  const RANK = { deadline: 0, habit: 1, petty: 2 };
  const EXCUSES = ["It feels too big", "It's boring", "I'm scared I'll do it badly", "No urgency", "I'm tired"];
  const THINKING = ["Consulting the sloth council", "Finding the smallest possible first step", "Lowering the bar, on purpose", "Checking the research so you don't have to"];
  const COLORS = ["var(--accent)", "var(--brown)", "var(--moss)"];
  const enter = { y: 12, duration: 220, easing: quintOut };

  const LS = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const api = (method, body) => fetch("/api/user", { method, body: JSON.stringify(body) });
  const focusMe = (n) => n.focus();

  const saved = LS("autopilot.profile", null), savedId = LS("autopilot.id", null);
  let tasks = $state(LS("autopilot.tasks", []));
  let profile = $state(saved);
  let uid = $state(savedId);
  let form = $state({ name: saved?.name ?? "", about: saved?.about ?? "" });
  let task = $state(""), excuse = $state("");
  let busy = $state(false), error = $state(""), msg = $state(0);
  let view = $state(saved ? "home" : "welcome"); // welcome | home | plan | countdown | run | finish
  let current = $state(null), count = $state(5), sure = $state(false);
  let loaded = $state(!savedId), sync = $state("local"); // local | saving | saved
  let tick;

  const open = $derived(tasks.filter((t) => !t.done).sort((a, b) => RANK[a.plan.type] - RANK[b.plan.type] || b.createdAt - a.createdAt));
  const doneN = $derived(tasks.length - open.length);
  const level = $derived(open.length >= 6 ? "overloaded" : open.length >= 3 ? "busy" : "light");
  const focus = $derived(["countdown", "run", "finish"].includes(view));
  const streak = $derived.by(() => {
    const days = new Set(tasks.filter((t) => t.doneAt).map((t) => new Date(t.doneAt).toDateString()));
    const d = new Date(); let s = 0;
    if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1);
    while (days.has(d.toDateString())) { s++; d.setDate(d.getDate() - 1); }
    return s;
  });

  // first_move is step 0: tiny, physical, 5 seconds
  const steps = (t) => [{ text: t.plan.first_move, minutes: 0 }, ...t.plan.steps];
  const pct = (t) => (t.i / steps(t).length) * 100;
  const mins = (m) => (m ? `${m} min` : "5 sec");

  onMount(async () => {
    if (uid) {
      try {
        const r = await fetch(`/api/user?id=${uid}`);
        if (r.ok) {
          const s = await r.json();
          profile = { name: s.name, about: s.about }; form = { ...profile }; put("autopilot.profile", profile);
          if (s.tasks.length || !tasks.length) tasks = s.tasks; // cloud copy wins
          sync = "saved";
        } else if (r.status === 404) { uid = null; await register(); }
      } catch {}
    }
    loaded = true;
  });

  let timer;
  $effect(() => {
    const snap = JSON.stringify(tasks);
    put("autopilot.tasks", tasks);
    if (!uid || !loaded) return;
    sync = "saving"; clearTimeout(timer);
    timer = setTimeout(async () => {
      try { sync = (await api("PUT", { id: uid, tasks: JSON.parse(snap) })).ok ? "saved" : "local"; } catch { sync = "local"; }
    }, 700);
  });
  $effect(() => {
    if (!busy) return;
    const t = setInterval(() => (msg = (msg + 1) % THINKING.length), 2000);
    return () => clearInterval(t);
  });

  async function register() {
    try {
      const r = await api("POST", { name: profile?.name, about: profile?.about });
      if (r.ok) { uid = (await r.json()).id; put("autopilot.id", uid); }
    } catch {}
  }
  async function saveProfile() {
    profile = { name: form.name.trim(), about: form.about.trim() }; put("autopilot.profile", profile);
    if (uid) api("PUT", { id: uid, ...profile }).catch(() => {});
    else if (profile.name || profile.about) await register();
    view = "home";
  }
  function skip() { profile = { name: "", about: "" }; put("autopilot.profile", profile); view = "home"; }

  async function make() {
    busy = true; error = ""; msg = 0;
    try {
      const r = await fetch("/api/plan", { method: "POST", body: JSON.stringify({ task, excuse, id: uid }) });
      const d = await r.json().catch(() => ({ error: r.status === 429 ? "Easy there. Try again in a minute." : "The sloth council is napping. Try again." }));
      if (!r.ok) throw new Error(d.error);
      tasks.unshift({ id: Date.now(), plan: d, i: 0, done: false, createdAt: Date.now(), doneAt: null });
      current = tasks[0]; task = excuse = ""; view = "plan";
    } catch (e) { error = e.message; }
    busy = false;
  }

  function go() {
    view = "countdown"; count = 5;
    clearInterval(tick);
    tick = setInterval(() => { if (--count < 1) { clearInterval(tick); view = "run"; } }, 1000);
  }
  function cancel() { clearInterval(tick); view = "plan"; }
  function next() {
    if (++current.i >= steps(current).length) { current.done = true; current.doneAt = Date.now(); view = "finish"; }
  }
  const show = (t) => ((current = t), (sure = false), (view = "plan"));
  function remove() { tasks = tasks.filter((x) => x.id !== current.id); view = "home"; }
  const confetti = Array.from({ length: 28 }, (_, i) => ({
    x: Math.random() * 100, dx: (Math.random() - .5) * 160 + "px", r: Math.random() * 720 + "deg", d: Math.random() * .5, c: COLORS[i % 3],
  }));
</script>

<main>
  {#if !focus}
    <div class="bar">
      <button class="mark" onclick={() => (view = profile ? "home" : "welcome")} aria-label="Home"><Sloth size={34} />autopilot</button>
      {#if profile}
        <div class="who">
          {#if uid}<span class="sync" aria-live="polite">{sync === "saving" ? "Saving" : sync === "saved" ? "Saved" : ""}</span>{/if}
          <button class="avatar" onclick={() => { form = { ...profile }; view = "welcome"; }} aria-label="Edit your profile">{(profile.name || "?")[0].toUpperCase()}</button>
        </div>
      {/if}
    </div>
  {/if}

  {#if view === "welcome"}
    <section class="cols" in:fly={enter}>
      <div class="col">
        <h1>{profile ? "Your details" : "Let's get acquainted."}</h1>
        <p class="lede">Two details so plans fit you. Stored privately in your own profile. No password, no email.</p>
        <Sloth hang size={150} />
      </div>
      <form class="col side" onsubmit={(e) => { e.preventDefault(); saveProfile(); }}>
        <div class="field">
          <label class="label" for="name">What should we call you?</label>
          <input id="name" bind:value={form.name} maxlength="40" autocomplete="given-name" placeholder="Alex" />
        </div>
        <div class="field">
          <label class="label" for="about">Anything that makes starting hard? <span class="small">Optional</span></label>
          <textarea id="about" bind:value={form.about} maxlength="300" placeholder="I freeze on big projects. I study better at night."></textarea>
        </div>
        <button class="btn">{profile ? "Save" : "Continue"}</button>
        <div class="center"><button type="button" class="quiet" onclick={profile ? () => (view = "home") : skip}>{profile ? "Back" : "Skip for now"}</button></div>
      </form>
    </section>

  {:else if view === "home"}
    <section class="cols" in:fly={enter}>
      <div class="col">
        <h1>What are you avoiding{profile?.name ? `, ${profile.name}` : ""}?</h1>
        <p class="lede">Say it plainly. We'll make the first move small enough to do right now.</p>

        {#if busy}
          <div class="thinking" role="status" aria-label="Making your plan">
            <Sloth hang size={170} />
            {#key msg}<p in:fade={{ duration: 200 }}>{THINKING[msg]}</p>{/key}
          </div>
        {:else}
          <form onsubmit={(e) => { e.preventDefault(); make(); }}>
            <div class="field">
              <label class="label" for="task">The thing</label>
              <textarea id="task" class="big-input" bind:value={task} placeholder="File my taxes. Go to the gym. Reply to that email." required maxlength="300"></textarea>
            </div>
            {#if task.trim()}
              <div class="field" in:fly={{ y: 8, duration: 200, easing: quintOut }}>
                <span class="label">Why haven't you? <span class="small">Optional</span></span>
                <div class="chips">
                  {#each EXCUSES as e}<button type="button" class="chip" class:on={excuse === e} onclick={() => (excuse = excuse === e ? "" : e)}>{e}</button>{/each}
                </div>
              </div>
            {/if}
            <button class="btn" disabled={!task.trim()}>Make it easy</button>
            {#if error}<p class="err" role="alert">{error}</p>{/if}
          </form>
        {/if}
      </div>

      <div class="col side">
        {#if tasks.length}
          <p class="summary">{open.length} open · {doneN} done{streak ? ` · ${streak} day streak` : ""}</p>
        {/if}

        {#if open.length && level !== "light"}
          <div class="notice" in:fade>
            <p>{level === "overloaded" ? `${open.length} open is more than anyone holds in their head. Finish one, or let one go.` : `${open.length} open. Pick one and ignore the rest until it's done.`}</p>
            <button class="btn" onclick={() => show(open[0])}>Start with “{open[0].plan.title}”</button>
          </div>
        {/if}

        {#if open.length}
          <ul class="list">
            {#each open as t, n (t.id)}
              <li><button class="row" onclick={() => show(t)}>
                <b>{#if n === 0 && level !== "light"}<span class="start">Start here</span>{/if}{t.plan.title}</b>
                <span class="meta">{TYPE[t.plan.type]} · {t.i ? `Step ${t.i + 1} of ${steps(t).length}` : "Not started"}</span>
                <span class="go">{t.i ? "Resume" : "Open"}</span>
                {#if t.i}<span class="track"><i style="width:{pct(t)}%"></i></span>{/if}
              </button></li>
            {/each}
          </ul>
        {:else}
          <div class="empty">
            <Sloth hang size={120} />
            <p>{tasks.length ? "All clear. Take the win." : "Nothing here yet. Start with whatever you've been quietly dreading the longest."}</p>
          </div>
        {/if}
      </div>
    </section>

  {:else if view === "plan"}
    <section class="plan" in:fly={enter}>
      <button class="quiet back" onclick={() => (view = "home")}>← Back</button>
      <div class="cols">
        <div class="col">
          <p class="eyebrow">{TYPE[current.plan.type]}</p>
          <h2>{current.plan.title}</h2>
          <p>{current.plan.diagnosis}</p>
          {#if current.plan.priority_note}<div class="notice"><p class="eyebrow">Where this fits</p><p>{current.plan.priority_note}</p></div>{/if}
          {#if current.plan.identity}<p class="quote">“{current.plan.identity}”</p>{/if}

          <div class="sec"><p class="eyebrow">Your trigger</p><p>{current.plan.if_then}</p></div>
          <div class="sec"><p class="eyebrow">Afterwards</p><p>{current.plan.reward}</p></div>

          <details>
            <summary>Why this works</summary>
            {#each current.plan.principles as p}<p class="principle"><b>{p.name}</b>{p.evidence}</p>{/each}
          </details>
        </div>

        <div class="col side">
          <p class="eyebrow">The plan</p>
          <ol class="steps">
            <li class="first"><span>{current.plan.first_move}</span><span class="t">5 sec</span></li>
            {#each current.plan.steps as s}<li><span>{s.text}</span><span class="t">{mins(s.minutes)}</span></li>{/each}
          </ol>

          {#if current.plan.milestones.length}
            <div class="sec"><p class="eyebrow">Milestones</p>
              <ol class="steps">{#each current.plan.milestones as m}<li><span>{m.text}</span><span class="t">{m.when}</span></li>{/each}</ol>
            </div>
          {/if}

          <div class="cta">
            <button class="btn" onclick={go}>{current.i ? "Pick up where I left off" : "Start, it takes 5 seconds"}</button>
            <div class="center">
              {#if sure}<button class="quiet danger" onclick={remove}>Yes, remove it</button>{:else}<button class="quiet" onclick={() => (sure = true)}>Remove task</button>{/if}
            </div>
          </div>
        </div>
      </div>
    </section>

  {:else if view === "countdown"}
    <section class="focus center" in:fade={{ duration: 200 }}>
      <div class="ring">
        <svg viewBox="0 0 230 230" aria-hidden="true"><circle class="bg" cx="115" cy="115" r="110" />{#key count}<circle class="fg" cx="115" cy="115" r="110" />{/key}</svg>
        {#key count}<span class="num" role="timer" aria-live="assertive">{count}</span>{/key}
      </div>
      <p class="lede" style="margin:0 auto">Move before your brain argues.</p>
      <div><button class="quiet" onclick={cancel}>Not yet</button></div>
    </section>

  {:else if view === "run"}
    <section class="focus" in:fade={{ duration: 200 }}>
      <div class="seg" aria-hidden="true">{#each steps(current) as _, n}<i class:d={n < current.i} class:now={n === current.i}></i>{/each}</div>
      {#key current.i}
        <div in:fly={{ y: 14, duration: 240, easing: quintOut }}>
          <p class="eyebrow">Step {current.i + 1} of {steps(current).length} · {mins(steps(current)[current.i].minutes)}</p>
          <p class="now-step">{steps(current)[current.i].text}</p>
        </div>
      {/key}
      <div class="foot">
        <button class="btn" onclick={next} use:focusMe>Done</button>
        <div class="center"><button class="quiet" onclick={() => (view = "home")}>Pause, it'll be here</button></div>
      </div>
    </section>

  {:else if view === "finish"}
    <div class="confetti" aria-hidden="true">
      {#each confetti as c}<i style="left:{c.x}%; --dx:{c.dx}; --r:{c.r}; --c:{c.c}; animation-delay:{c.d}s"></i>{/each}
    </div>
    <section class="focus" in:fade={{ duration: 300 }}>
      <div class="finish-sloth"><Sloth size={96} /></div>
      <p class="eyebrow">Finished</p>
      <h1>You did the thing.</h1>
      <p class="lede">{current.plan.title} is off your mind.{current.plan.reward ? ` Now: ${current.plan.reward}` : ""}</p>
      <button class="btn" onclick={() => (view = "home")}>What's next</button>
    </section>
  {/if}
</main>
