# Procrastinator Autopilot

Admit what you keep avoiding. Autopilot classifies it, works out *why* you're slacking, and hands you a first move small enough to do in five seconds.

Built for the DEV Hacktoberfest open-source AI challenge, week 3 ("Slow and Steady").

## How it works

1. **Classify**: habit, quick task, or important deadline. Each is attacked differently (Atomic Habits-style identity and habit stacking, the 2-minute rule, backward milestones with a pre-mortem).
2. **Diagnose**: overwhelmed, bored, afraid, no urgency, or low energy.
3. **Plan**: a 5-second first move, an if-then trigger, small steps, and a reward.
4. **Do it**: a 5-4-3-2-1 countdown, then one step at a time. Nothing else on screen.
5. **Remember**: open tasks are kept in your profile (MongoDB). When you have 3+ open tasks the plans get smaller; at 6+ you get an honest "do this now, schedule it, or drop it".

The model may only cite a fixed list of named principles (`netlify/functions/plan.mjs`), and each is shown with an honest evidence note. Anything else it invents is dropped.

## Stack

Svelte 5 + Vite, Netlify Functions, MongoDB Atlas, any OpenAI-compatible model endpoint (built for open-weight Gemma).

## Run it

```bash
npm install
cp .env.example .env   # fill in values
npx netlify dev
npm test
```

| Variable | Purpose |
|---|---|
| `SLOTH_API_KEY` | key for the model host |
| `SLOTH_BASE_URL` | OpenAI-compatible base URL (default: Google AI Studio) |
| `SLOTH_MODEL` | model name (default: `gemma-3-27b-it`) |
| `MONGODB_URI`, `MONGODB_DB` | profiles and tasks; optional, the app runs local-only without it |
| `DAILY_LIMIT` | global daily cap on plan requests (default 400) |

Per-visitor limits (5 plans/minute) are set in the function config.

## Privacy

A profile is a random id stored in your browser, plus the name, notes, and tasks you enter. No password or email. The task text, name, and notes are sent to the model host to make a plan.
