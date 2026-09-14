import { useCharacterLabels } from "../composables/useCharacterLabels";
import { computed, defineComponent } from "vue";
import { RouterLink } from "vue-router";
import type { Character } from "../types/character";
import { useLanguage } from "../../../shared/composables/useLanguage";
interface Props {
  character: Character;
  game: string;
}

export default defineComponent<Props>(
  (props) => {
    const { t, label } = useLanguage();
    const { stats, target } = useCharacterLabels();
    const labels = computed(() => {
      const unique = new Map<string, { key: string; text: string; debuff: boolean }>();
      for (const [effects, debuff] of [[props.character.buffs, false], [props.character.debuffs ?? [], true]] as const) {
        for (const effect of effects) {
          const key = [debuff, effect.effect_type, effect.stat_code, effect.target, effect.element_code, effect.condition?.metric, effect.stat_code ? null : effect.status_id].join(":");
          const stat = effect.condition?.metric === "elemental_skill_gauge_auto_recovery"
            ? t("ฟื้นเกจสกิลธาตุอัตโนมัติ", "Elemental Gauge Auto Recovery")
            : (effect.stat_code && (stats[effect.stat_code] || effect.stat_code))
              || (effect.name ? label(effect.name) : t("เอฟเฟกต์", "Effect"));
          const name = effect.effect_type === "damage_taken_increase" ? t("DMG ที่ได้รับ", "DMG Taken")
            : effect.effect_type === "break_damage_taken_increase" ? t("Break DMG ที่ได้รับ", "Break DMG Taken")
            : effect.element_code ? `${effect.element_code.toUpperCase()} ${stat}` : stat;
          unique.set(key, { key, debuff, text: debuff ? name : `${name} - ${target(effect.target)}` });
        }
      }
      return [...unique.values()];
    });
    return () => (
      <RouterLink
        to={`/game/${encodeURIComponent(props.game)}/characters/${encodeURIComponent(props.character.id)}`}
        t-data="character-card"
        class="state-layer border border-outline-variant rounded-[14px] bg-surface-container p-5.5"
      >
        <div class="flex justify-between items-center">
          <span
            class={[
              "text-body-s p-[5px_10px] rounded-[5px] bg-surface-container-highest [&.light]:bg-secondary-container [&.light]:text-on-secondary-container [&.dark]:bg-tertiary-container [&.dark]:text-on-tertiary-container",
              props.character.element_code,
            ]}
          >
            {label(props.character.element_name)}
          </span>
          <span class="text-label-l-emphasized text-secondary">
            {props.character.rarity}
          </span>
        </div>
        <div
          class={[
            "character-monogram text-display-l h-37 flex items-center justify-center relative text-primary bg-radial from-primary/20 to-transparent m-[10px_0_24px] [&.light]:text-secondary [&.light]:bg-radial [&.light]:from-secondary/20 [&.light]:to-transparent [&.dark]:text-tertiary [&.dark]:bg-radial [&.dark]:from-tertiary/20 [&.dark]:to-transparent [&_span]:text-body-s [&_span]:absolute [&_span]:bottom-0 [&_span]:text-on-surface-variant max-[580px]:h-28.75",
            props.character.element_code,
          ]}
        >
          {props.character.name.en?.slice(0, 1)}
          <span>{"BREAKER"}</span>
        </div>
        <div class="flex justify-between items-center [&_h3]:text-title-l [&_>_span]:text-on-surface-variant">
          <h3 class="text-title-m-emphasized">{label(props.character.name)}</h3>
          <span>{"↗"}</span>
        </div>
        <p class="text-body-s text-on-surface-variant mt-1.5">
          {label(props.character.class_name)}
          {" · "}
          {label(props.character.race)}
        </p>
        <div class="flex flex-wrap gap-1.75 min-h-22 content-start p-[20px_0]">
          {labels.value.map(item => <span key={item.key} t-data={item.debuff ? "debuff-label" : "buff-label"}
            aria-label={`${item.debuff ? t("ดีบัฟ", "Debuff") : t("บัฟ", "Buff")}: ${item.text}`}
            class={["text-label-m inline-flex whitespace-nowrap px-2.5 py-1.5 rounded-md", item.debuff ? "bg-error-container text-on-error-container" : "bg-primary-container text-on-primary-container"]}>
            {item.text}
          </span>)}
          {!labels.value.length ? (
            <span class="text-body-s text-on-surface-variant">
              {t("ยังไม่มีบัฟหรือดีบัฟที่ยืนยัน", "No documented buffs or debuffs")}
            </span>
          ) : null}
        </div>
        <div class="text-label-s flex justify-between border-t border-outline-variant pt-3.75 text-on-surface-variant [&_span:last-child]:text-primary">
          <span>
            {props.character.has_hold
              ? t("มีท่ากดค้าง", "Hold action")
              : t("ดูสกิลและเงื่อนไข", "Skills & conditions")}
          </span>
          <span>
            {t("ดูรายละเอียด", "View details")}
            {" →"}
          </span>
        </div>
      </RouterLink>
    );
  },
  { name: "CharacterCard", props: ["character", "game"] },
);
