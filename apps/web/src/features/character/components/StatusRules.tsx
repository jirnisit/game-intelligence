import { defineComponent } from "vue";
import { useLanguage } from "../../../shared/composables/useLanguage";
import { useCharacterLabels } from "../composables/useCharacterLabels";
import type { StatusRule } from "../types/character";
interface Props { rules: StatusRule[] }
export default defineComponent<Props>((props) => {
  const { t } = useLanguage();
  const { awakeningLabel } = useCharacterLabels();
  function mechanics(rule: StatusRule): string[] {
    const m = rule.mechanics;
    const lines: string[] = [];
    const endings: Record<string, string> = {
      break_state_starts: t("ลบเมื่อเริ่ม Break", "Removed when Break starts"),
      break_state_ends: t("ลบเมื่อ Break จบ", "Removed when Break ends"),
      rift_gauge_zero: t("สิ้นสุดเมื่อ Rift Gauge หมด", "Ends when Rift Gauge reaches zero"),
    };
    if (typeof m.end_when === "string" && endings[m.end_when]) lines.push(endings[m.end_when]);
    if (m.clear_all_stacks) lines.push(t("เมื่อ stack เต็ม: ทำดาเมจแล้วล้างทั้งหมด", "At maximum stacks: deal damage and clear all stacks"));
    if (typeof m.remove_all_stacks_when_hit === "boolean") lines.push(m.remove_all_stacks_when_hit ? t("ถูกโจมตีแล้วเสียทุก stack", "Lose all stacks when hit") : t("ไม่เสีย stacks เมื่อถูกโจมตี", "Keep stacks when hit"));
    if (typeof m.gauge_drain_percent_per_second === "number") lines.push(t("เกจลด ", "Gauge drains ") + m.gauge_drain_percent_per_second + "% / s");
    if (typeof m.special_consumes_entire_dragons_wrath === "boolean") lines.push(m.special_consumes_entire_dragons_wrath ? t("สกิลพิเศษใช้เกจ Dragon’s Wrath ทั้งหมด", "Special Skill consumes all Dragon’s Wrath") : t("สกิลพิเศษไม่ใช้เกจ Dragon’s Wrath", "Special Skill does not consume Dragon’s Wrath"));
    if (m.allowed_skill_categories) lines.push(t("ใช้ได้เฉพาะโจมตีปกติและสกิลพิเศษ", "Only Normal Attacks and Special Skills are available"));
    if (typeof m.normal_attack_hit_count === "number") lines.push(t("โจมตีปกติ ", "Normal Attack: ") + m.normal_attack_hit_count + " hits");
    if (typeof m.special_cooldown_seconds === "number") lines.push(t("คูลดาวน์สกิลพิเศษ ", "Special Skill cooldown: ") + m.special_cooldown_seconds + "s");
    return lines;
  }
  return () => <div class="grid gap-2" t-data="status-rules">
    {props.rules.map(rule => <div key={rule.id} class="text-body-s bg-surface-container-lowest border border-outline-variant rounded-md p-3">
      <span class="text-label-m text-primary">{awakeningLabel(rule.awakening_from)}</span>
      <p>{rule.duration_kind === "timed" ? `${rule.duration_seconds}s` : rule.duration_kind === "unlimited" ? t("ไม่จำกัดเวลา", "Unlimited duration") : t("ระยะเวลายังไม่ทราบ", "Duration unknown")} · {rule.max_stacks === null ? t("เพดาน stack ยังไม่ทราบ", "Stack cap unknown") : `${rule.max_stacks} stacks`}</p>
      {rule.refresh_on_stack !== null && rule.duration_kind === "timed" ? <p>{rule.refresh_on_stack ? t("ได้ stack เพิ่ม → รีเฟรชเวลา", "Additional stacks refresh duration") : t("ได้ stack เพิ่ม → ไม่รีเฟรชเวลา", "Additional stacks do not refresh duration")}</p> : null}
      {mechanics(rule).map(line => <p key={line}>{line}</p>)}
    </div>)}
  </div>;
}, { props: ["rules"] });
