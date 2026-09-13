import type { Buff } from "../types/character";

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,stable(v)])));
  return JSON.stringify(value);
}

// Recipients may change at awakening; distinct sources and conditions must not merge.
export function groupEffects<T extends Buff>(effects: T[]): T[][] {
  const groups = new Map<string, T[]>();
  for (const effect of effects) {
    const key = stable([effect.awakening_level != null ? `awakening:${effect.awakening_level}` : effect.status_id || effect.skill_id || effect.id, effect.effect_type,
      effect.stat_code, effect.unit, effect.per_stack, effect.condition ?? {}]);
    const entries = groups.get(key) ?? [];
    entries.push(effect);
    groups.set(key, entries);
  }
  return [...groups.values()].map(entries => entries.sort((a,b)=>a.awakening_from-b.awakening_from));
}
