import { defineComponent } from "vue";
import { useLanguage } from "../../../shared/composables/useLanguage";

interface Props {
  title: string;
  awakening: number;
  onAwakeningChange: (value: number) => void;
}

export default defineComponent<Props>(
  (props) => {
    const { t } = useLanguage();
    return () => (
      <div class="flex justify-between gap-7.5 items-end mb-7.5 max-[580px]:block">
        <div>
          <p class="text-label-s-emphasized text-primary mb-3">
            {"BREAKER ARCHIVE / 01"}
          </p>
          <h1 class="text-display-s max-[580px]:text-headline-l">
            {props.title}
          </h1>
          <p class="text-body-m text-on-surface-variant mt-2">
            {t(
              "สำรวจสกิล บัฟ และเงื่อนไขการทำงาน ก่อนวางทีมของคุณ",
              "Explore skills, buffs and their conditions before building your team.",
            )}
          </p>
        </div>
        <label
          t-data="awakening-label"
          class="text-body-s min-w-50 grid gap-2 text-on-surface-variant max-[580px]:mt-4.5"
        >
          {t("ระดับ Awakening ที่ใช้ดูผล", "View effects at awakening")}
          <select
            value={props.awakening}
            onChange={(event) => {
              props.onAwakeningChange(
                Number((event.target as HTMLSelectElement).value),
              );
            }}
            aria-label="Awakening"
          >
            {[1, 2, 3, 4, 5, 6].map((level) => (
              <option key={level} value={level - 1}>
                {"Awakening "}
                {level - 1}
              </option>
            ))}
          </select>
        </label>
      </div>
    );
  },
  {
    name: "CharacterPageHeader",
    props: ["title", "awakening", "onAwakeningChange"],
  },
);
