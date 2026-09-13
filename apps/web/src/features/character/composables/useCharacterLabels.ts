import type { Text } from "../../../core/types/text";
import { useLanguage } from "../../../shared/composables/useLanguage";
export function useCharacterLabels() {
  const { t, label } = useLanguage();
  const stats: Record<string, string> = {
    atk: "ATK",
    def: "DEF",
    hp: "HP",
    max_hp: "Max HP",
    crit_rate: "CRIT Rate",
    crit_dmg: "CRIT DMG",
    dmg_bonus: "DMG",
    elemental_dmg: "Elemental DMG",
    elemental_res: "Element RES",
    break_gauge: "Break Gauge",
    ultimate_gauge: "Ultimate Gauge",
    rift_gauge: "Rift Gauge",
    cooldown: "Cooldown",
    stagger: "Stagger",
    down: "Down",
  };
  const effectLabel = (type: string) =>
    ({
      stat_increase: t("เพิ่มค่าสถานะ", "Stat buff"),
      stat_decrease: t("ลดค่าสถานะ", "Stat reduction"),
      heal: t("ฟื้น HP", "Healing"),
      damage_taken_increase: t("ศัตรูรับดาเมจเพิ่ม", "Enemy damage taken"),
      break_damage_taken_increase: t(
        "ศัตรูรับดาเมจเกจ Break เพิ่ม",
        "Enemy Break damage taken",
      ),
      skill_damage_increase: t("เพิ่มดาเมจเฉพาะสกิล", "Skill damage bonus"),
      damage: t("ดาเมจตามเงื่อนไข", "Triggered damage"),
      immunity: t("ป้องกันสถานะ", "Immunity"),
      cooldown_reduction: t("ลดคูลดาวน์", "Cooldown reduction"),
      gauge_recovery: t("ฟื้นเกจ", "Gauge recovery"),
    })[type] || t("เอฟเฟกต์", "Effect");
  const target = (value: string) =>
    ({
      self: t("เฉพาะตัวเอง", "Self only"),
      all_allies: t("ทั้งทีม", "All allies"),
      enemy: t("ศัตรู", "Enemy"),
      unknown: t("ยังไม่ทราบ", "Unknown"),
    })[value] || t("ยังไม่ทราบ", "Unknown");
  const awakeningLabel = (level: number) => level === 0 ? t("ปกติ", "Base") : `Awakening ${level}`;
  const formatValue = (e: {
    value: number | string | null;
    unit: string | null;
    per_stack: boolean;
  }) =>
    e.value == null
      ? "—"
      : `${e.value}${e.unit === "percent" || e.unit === "percent_of_stat" ? "%" : e.unit === "seconds" ? "s" : ""}${e.per_stack ? t(" / stack", " / stack") : ""}`;

  const conditionLabel = (c: Record<string, unknown> = {}) => {
    const parts: string[] = [];
    const names: Record<string,string> = { rift: "Rift’s Power", awakening: "Awakening", sharp_blade: "Sharp Blade", resonance: "Resonance", sun: "Sun", moon: "Moon", dragons_wrath: "Dragon’s Wrath", rookies_morale: "Rookie’s Morale", darkness: "Darkness", devotion: "Devotion" };
    const name = (v: unknown) => typeof v === "string" ? names[v] || "" : "";
    if (typeof c.section_name === "string") parts.push(c.section_name);
    else if (c.section_name && typeof c.section_name === "object") {
      const section = label(c.section_name as Text);
      if (section !== "—") parts.push(section);
    }
    if (name(c.requires_status)) parts.push(t("ขณะมี ", "While in ") + name(c.requires_status));
    if (name(c.excluded_status)) parts.push(t("ขณะไม่มี ", "Outside ") + name(c.excluded_status));
    if (Array.isArray(c.requires_statuses)) {
      const statuses = c.requires_statuses.map(name).filter(Boolean);
      if (statuses.length) parts.push((c.required_status_target === "enemy" ? t("ศัตรูต้องมี ", "Enemy requires ") : t("ต้องมี ", "Requires ")) + statuses.join(" + "));
    }
    if (c.target_state === "break" || c.requires_state === "break") parts.push(t("ศัตรูอยู่ใน Break", "Enemy in Break"));
    if (c.requires_button_hold) parts.push(t("ขณะกดปุ่มค้าง", "While holding the button"));
    if (c.requires_near_flag) parts.push(t("ศัตรูอยู่ใกล้ธง", "Enemy near the flag"));
    if (typeof c.flag_duration_seconds === "number") parts.push(`${c.flag_duration_seconds}s`);
    if (c.inside_field) parts.push(t("ภายในสนาม", "Inside the field"));
    if (typeof c.tick_seconds === "number") parts.push(t("ทุก ", "Every ") + c.tick_seconds + "s");
    if (c.trigger === "max_stacks_reached") parts.push(t("เมื่อ stack เต็ม", "At maximum stacks"));
    if (name(c.per_resource_consumed)) parts.push(t("ต่อ stack ที่ใช้ของ ", "Per consumed stack of ") + name(c.per_resource_consumed));
    if (name(c.resource)) parts.push(name(c.resource) + (typeof c.minimum === "number" ? ` ≥ ${c.minimum} stacks` : ""));
    if (c.consume_all) parts.push(t("ใช้ทั้งหมด", "Consume all"));
    if (c.per_stack_basis === "consumed_stacks") parts.push(t("ต่อ stack ที่ใช้ไป", "Per consumed stack"));
    if (c.per_stack_basis === "held_stacks") parts.push(t("ต่อ stack ที่มี", "Per held stack"));
    if (c.gauge_basis === "consumed" || c.gauge_basis === "held") parts.push(c.gauge_basis === "consumed" ? t("อิงเกจที่ใช้ไป", "Based on consumed gauge") : t("อิงเกจที่มี", "Based on held gauge"));
    if (c.consume_entire_gauge) parts.push(t("ใช้เกจทั้งหมด", "Consumes the entire gauge"));
    if (typeof c.per_gauge_percent_consumed === "number") parts.push(t("ต่อเกจที่ใช้ทุก ", "Per consumed ") + c.per_gauge_percent_consumed + t("%", "% gauge"));
    if (c.excludes === "special_attacks") parts.push(t("ยกเว้นการโจมตีพิเศษ", "Excludes special attacks"));
    if (Array.isArray(c.on_hits) && c.on_hits.every(v => typeof v === "number")) parts.push(t("โจมตีครั้งที่ ", "Hit ") + c.on_hits.join(", "));
    const events: Record<string,string> = { hit:t("เมื่อโจมตีโดน", "On hit"), each_hit:t("ทุก hit", "Each hit"), trigger_elemental_reaction:t("เมื่อเกิด Reaction", "When a Reaction occurs"), use_in_sync_with_enemy_attack:t("ใช้ตรงกับจังหวะโจมตีของศัตรู", "Use in sync with the enemy’s attack"), use_ultimate:t("เมื่อใช้อัลติเมต", "On Ultimate use") };
    if (typeof c.on === "string" && events[c.on]) parts.push(events[c.on]);
    return parts.join(" · ");
  };
  return { stats, effectLabel, target, formatValue, awakeningLabel, conditionLabel };
}
