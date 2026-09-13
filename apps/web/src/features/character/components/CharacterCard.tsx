import { defineComponent } from "vue";
import { RouterLink } from "vue-router";
import type { Character } from "../types/character";
import { useLanguage } from "../../../shared/composables/useLanguage";
import { useCharacterLabels } from "../composables/useCharacterLabels";
interface Props {
  character: Character;
  game: string;
}

export default defineComponent<Props>(
  (props) => {
    const { t, label } = useLanguage();
    const { stats, target, formatValue } = useCharacterLabels();
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
          {props.character.buffs.map((b) => (
            <span
              key={b.id}
              class="text-body-s bg-primary-container text-on-primary-container p-[7px_9px] rounded-md [&_small]:text-label-s [&_small]:block [&_small]:text-on-primary-container [&_small]:mt-0.75"
            >
              {stats[b.stat_code]}
              {" +"}
              {formatValue(b)} <small>{target(b.target)}</small>
            </span>
          ))}
          {!props.character.buffs.length ? (
            <span class="text-body-s text-on-surface-variant">
              {t("ยังไม่มีบัฟค่าสถานะที่ยืนยัน", "No documented stat buffs")}
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
