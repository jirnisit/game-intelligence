import type { Text } from "../../../core/types/text";
export type Buff = {
  element_code?: string | null;
  skill_id?: string | null;
  status_id?: string | null;
  awakening_level?: number | null;
  effect_type?: string;
  id: string;
  awakening_from: number;
  awakening_until: number | null;
  condition?: Record<string, unknown>;
  stat_code: string;
  target: string;
  value: number | string | null;
  unit: string | null;
  per_stack: boolean;
  name?: Text;
};
export type Character = {
  game_id: string;
  id: string;
  name: Text;
  class_name: Text;
  element_name: Text;
  rarity: string;
  element_code: string;
  class_code: string;
  race: Text;
  notes: Text;
  has_hold: boolean;
  buffs: Buff[];
  debuffs?: Buff[];
};
export type Effect = Buff & {
  required_statuses: {
    code: string;
    providers: {
      character_id: string;
      character_name: Text;
      skill_name: Text;
      description: Text;
      target: string;
      stacks: number | null;
      awakening_from: number;
      awakening_until: number | null;
    }[];
  }[];
  description: Text;
  effect_type: string;
  status_id: string | null;
  skill_id: string | null;
  awakening_name?: Text;
  status_name: Text;
  skill_name: Text;
  directly_granted: boolean;
  condition: Record<string, unknown>;
  scaling_stat: string | null;
  scaling_character_id: string | null;
  element_code: string | null;
  applications: {
    awakening_from: number;
    awakening_until: number | null;
    name: Text;
    description: Text;
    stacks: number | null;
    target: string;
  }[];
};
export type Detail = Character & {
  awakening: number;
  skills: {
    id: string;
    category: string;
    name: Text;
    description: Text;
    has_hold: boolean;
    cooldown_seconds: string | null;
  }[];
  effects: Effect[];
  effect_variants: Effect[];
  reaction_pairs: ReactionPair[];
  awakenings: {
    level: number;
    name: Text;
    description: Text;
    unlocked: boolean;
  }[];
  statuses: Status[];
};
export type StatusRule = {
  id: string;
  awakening_from: number;
  awakening_until: number | null;
  max_stacks: number | null;
  duration_kind: string;
  duration_seconds: number | string | null;
  refresh_on_stack: boolean | null;
  mechanics: Record<string, unknown>;
};
export type Status = {
  id: string;
  name: Text;
  description: Text;
  completeness: string;
  rule: StatusRule | null;
  rules: StatusRule[];
};
export type ReactionPair = {
  reaction_id: string;
  game_id: string;
  element_a: string;
  element_b: string;
  name?: Text;
  description?: Text;
};

export type Meta = {
  games: { id: string; name: Text }[];
  elements: { game_id: string; code: string; name: Text }[];
  classes: { game_id: string; code: string; name: Text }[];
  buffStats: string[];
  debuffStats?: string[];
  reactions?: { id: string; game_id: string; name: Text; pairs: ReactionPair[] }[];
};
