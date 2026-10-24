<script>
  // hang: sloth hanging from a branch (loading, empty states). Otherwise just the face (logo).
  let { hang = false, size = 32 } = $props();
</script>

{#snippet face()}
  <circle r="22" fill="var(--fur)" />
  <ellipse cy="-1" rx="17" ry="13" fill="var(--face)" />
  <ellipse cx="-8.5" cy="-2" rx="5" ry="8.5" transform="rotate(25 -8.5 -2)" fill="var(--fur-deep)" />
  <ellipse cx="8.5" cy="-2" rx="5" ry="8.5" transform="rotate(-25 8.5 -2)" fill="var(--fur-deep)" />
  <circle cx="-7.5" cy="-2" r="2.2" fill="var(--face)" /><circle cx="7.5" cy="-2" r="2.2" fill="var(--face)" />
  <circle cx="-7.5" cy="-2" r="1.1" fill="var(--fur-deep)" /><circle cx="7.5" cy="-2" r="1.1" fill="var(--fur-deep)" />
  <ellipse cy="4.5" rx="3.2" ry="2.3" fill="var(--fur-deep)" />
  <path d="M-4.5 8.5 Q0 12 4.5 8.5" fill="none" stroke="var(--fur-deep)" stroke-width="1.5" stroke-linecap="round" />
{/snippet}

{#if hang}
  <svg class="sway" width={size} height={size * 1.1} viewBox="0 0 120 132" role="img" aria-label="A sloth hanging from a branch">
    <rect x="0" y="6" width="120" height="9" rx="4.5" fill="var(--branch)" />
    <ellipse cx="18" cy="20" rx="9" ry="4.5" transform="rotate(35 18 20)" fill="var(--moss)" />
    <ellipse cx="104" cy="21" rx="9" ry="4.5" transform="rotate(-35 104 21)" fill="var(--moss)" />
    <path d="M36 12 Q36 44 46 62 M84 12 Q84 44 74 62" fill="none" stroke="var(--fur)" stroke-width="9" stroke-linecap="round" />
    <path d="M30 10 v8 M36 9 v9 M42 10 v8 M78 10 v8 M84 9 v9 M90 10 v8" stroke="var(--fur-deep)" stroke-width="2.4" stroke-linecap="round" />
    <ellipse cx="60" cy="68" rx="27" ry="24" fill="var(--fur)" />
    <g transform="translate(60 94)">{@render face()}</g>
  </svg>
{:else}
  <svg width={size} height={size} viewBox="-25 -25 50 50" role="img" aria-label="Autopilot sloth">{@render face()}</svg>
{/if}

<style>
  .sway { transform-origin: 50% 8%; animation: sway 2.6s ease-in-out infinite; overflow: visible; }
  @keyframes sway { 0%, 100% { transform: rotate(-6deg); } 50% { transform: rotate(6deg); } }
</style>
