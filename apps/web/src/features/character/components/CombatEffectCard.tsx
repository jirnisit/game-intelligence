import EffectSummary from "./EffectSummary";
import { defineComponent } from "vue";
import { RouterLink } from "vue-router";
import { useLanguage } from "../../../shared/composables/useLanguage";
import { useCharacterLabels } from "../composables/useCharacterLabels";
import type { Effect } from "../types/character";
interface Props { entries: Effect[]; game: string }
export default defineComponent<Props>((props) => {
  const { t, label } = useLanguage();
  const { stats, target, effectLabel, formatValue, awakeningLabel, conditionLabel } = useCharacterLabels();
  return () => <section t-data="combat-effect" class="text-body-s p-4 bg-surface-container border border-outline-variant rounded-lg">
    <h3 class="text-title-m-emphasized">{label(props.entries[0].status_name || props.entries[0].skill_name || props.entries[0].awakening_name)}</h3>
    <p class="text-on-surface-variant">{effectLabel(props.entries[0].effect_type)}</p>
    <EffectSummary entries={props.entries} />
    <details class="mt-3"><summary class="cursor-pointer text-primary">{t("รายละเอียดและวิธีได้รับ", "Details and acquisition")}</summary>
    <div class="grid gap-3 mt-3">
      {props.entries.map(e => <div key={e.id + ':' + e.awakening_from} t-data="effect-variant" class="border-t border-outline-variant pt-3">
        <span class="text-label-m text-primary" t-data="effect-awakening">{awakeningLabel(e.awakening_from)}</span>
        <p class="text-title-l text-primary">{stats[e.stat_code] || effectLabel(e.effect_type)} {formatValue(e)}{typeof e.condition.per_gauge_percent === "number" ? ` / ${e.condition.per_gauge_percent}% ${t("เกจ", "gauge")}` : ""}</p>
        {e.scaling_stat ? <p>{t("อิง", "Based on")} {stats[e.scaling_stat] || e.scaling_stat}{e.scaling_character_id ? ` (${e.scaling_character_id})` : ""}</p> : null}
        {e.element_code ? <p>{t("ธาตุ", "Element")}: {e.element_code}</p> : null}
        {conditionLabel(e.condition) ? <p class="mt-2" t-data="effect-condition">{conditionLabel(e.condition)}</p> : null}
        <p class="mt-2 whitespace-pre-line">{label(e.description)}</p>
        {!e.directly_granted ? <p class="text-on-surface-variant mt-2">{t("ยังไม่มีวิธีให้สถานะนี้โดยตรงที่ยืนยัน", "No documented direct application")}</p> : null}
        {e.applications.length ? <details class="mt-3"><summary class="cursor-pointer text-primary">{t("วิธีได้รับ", "How to obtain")}</summary>
          {e.applications.map((a, i) => <p key={i} class="mt-2 whitespace-pre-line"><b>{label(a.name)}</b> · {awakeningLabel(a.awakening_from)} · {target(a.target)}{a.stacks === null ? "" : ` · ${a.stacks} stacks`}<br />{label(a.description)}</p>)}
        </details> : null}
        {e.required_statuses.length ? <details class="mt-3"><summary class="cursor-pointer text-primary">{t("สถานะที่ต้องใช้และผู้ให้", "Required statuses and providers")}</summary>
          {e.required_statuses.map(required => <div key={required.code} class="mt-3">
            <b>{required.code}</b>
            {!required.providers.length ? <p>{t("ยังไม่มีผู้ให้ที่ยืนยัน", "No documented provider")}</p> : null}
            {required.providers.map((provider, i) => <p key={provider.character_id + i} class="mt-2">
              <RouterLink class="state-layer text-primary underline" to={`/game/${encodeURIComponent(props.game)}/characters/${encodeURIComponent(provider.character_id)}`}>{label(provider.character_name)}</RouterLink>
              {` · ${target(provider.target)} · ${awakeningLabel(provider.awakening_from)}`}
              {provider.stacks === null ? "" : ` · ${provider.stacks} stacks`}<br />{label(provider.description)}
            </p>)}
          </div>)}
          {e.condition.conditional_conversion ? <p class="mt-3">{t("ใช้ Sun และ Moon อย่างละ 1 stack บนผู้รับเดียวกันเพื่อสร้าง Eclipse; ห้ามนับ stacks ที่ใช้ไปซ้ำ", "Consumes 1 Sun and 1 Moon on the same recipient to create Eclipse; consumed stacks are no longer present.")}</p> : null}
        </details> : null}
      </div>)}
    </div>
    </details>
  </section>;
}, { props: ["entries", "game"] });
