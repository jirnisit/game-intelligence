import { defineComponent } from "vue";
import { useLanguage } from "../../../shared/composables/useLanguage";
interface Props { title: string }
export default defineComponent<Props>((props) => {
  const { t } = useLanguage();
  return () => <header class="mb-7.5">
    <p class="text-label-s-emphasized text-primary mb-3">BREAKER ARCHIVE / 01</p>
    <h1 class="text-display-s max-[580px]:text-headline-l">{props.title}</h1>
    <p class="text-body-m text-on-surface-variant mt-2">{t("สำรวจค่าปกติและความสามารถที่ปลดล็อกด้วย Awakening", "Explore base effects and abilities unlocked through Awakening.")}</p>
  </header>;
}, { props: ["title"] });
