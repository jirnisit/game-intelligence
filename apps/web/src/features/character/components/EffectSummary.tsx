import { computed, defineComponent } from "vue";
import type { Buff } from "../types/character";
import { useCharacterLabels } from "../composables/useCharacterLabels";
interface Props { entries: Buff[] }
export default defineComponent<Props>((props) => {
  const { stats, target, formatValue, awakeningLabel, conditionLabel } = useCharacterLabels();
  const values = computed(() => props.entries.filter((e,i,all) => i === 0 || all[i-1].value !== e.value || all[i-1].unit !== e.unit || all[i-1].per_stack !== e.per_stack));
  const recipients = computed(() => props.entries.filter((e,i,all) => i === 0 || all[i-1].target !== e.target));
  const prefix = (level: number) => level ? `${awakeningLabel(level)} → ` : "";
  return () => <div t-data="effect-summary" class="text-body-s">
    {values.value.map(e => <div key={e.id + e.awakening_from} t-data="effect-value">
      {e.awakening_from > 0 ? <span t-data="buff-awakening">{prefix(e.awakening_from)}</span> : null}
      {stats[e.stat_code] || ""} {e.value === null ? formatValue(e) : `+${formatValue(e)}`}
    </div>)}
    {recipients.value.map((e,i) => <div key={e.target + ":" + e.awakening_from} t-data="effect-recipient" class="text-label-s mt-1">{i > 0 ? prefix(e.awakening_from) : ""}{target(e.target)}</div>)}
    {conditionLabel(props.entries[0].condition) ? <div t-data="effect-condition" class="text-label-s mt-1">{conditionLabel(props.entries[0].condition)}</div> : null}
  </div>;
}, { props: ["entries"] });
