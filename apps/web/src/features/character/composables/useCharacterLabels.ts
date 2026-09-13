import { useLanguage } from "../../../shared/composables/useLanguage";
export function useCharacterLabels() {
  const { t } = useLanguage();
  const stats: Record<string, string> = {
    atk: "ATK",
    def: "DEF",
    hp: "HP",
    max_hp: "Max HP",
    crit_rate: "CRIT Rate",
    crit_dmg: "CRIT DMG",
    dmg_bonus: "DMG",
    elemental_dmg: "Elemental DMG",
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
    })[type] || type;
  const target = (value: string) =>
    ({
      self: t("เฉพาะตัวเอง", "Self only"),
      all_allies: t("ทั้งทีม", "All allies"),
      enemy: t("ศัตรู", "Enemy"),
      unknown: t("ยังไม่ทราบ", "Unknown"),
    })[value] || value;
  const formatValue = (e: {
    value: number | string | null;
    unit: string | null;
    per_stack: boolean;
  }) =>
    e.value == null
      ? "—"
      : `${e.value}${e.unit === "percent" || e.unit === "percent_of_stat" ? "%" : e.unit === "seconds" ? "s" : ""}${e.per_stack ? t(" / stack", " / stack") : ""}`;

  return { stats, effectLabel, target, formatValue };
}
