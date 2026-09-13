import { defineComponent } from "vue";
import { RouterLink } from "vue-router";
import { useLanguage } from "../../shared/composables/useLanguage";
interface Props {}

export default defineComponent<Props>(
  () => {
    const { t } = useLanguage();
    return () => (
      <section class="text-center bg-surface-container border border-outline-variant border-dashed rounded-[14px] p-[50px_24px] text-on-surface [&_p]:m-[15px_0_22px]">
        <h1 class="text-display-s max-[580px]:text-headline-l">404</h1>
        <p>{t("ไม่พบหน้าที่คุณต้องการ", "Page not found")}</p>
        <RouterLink
          to="/"
          t-data="back-link"
          class="state-layer text-body-s inline-block text-primary m-[0_0_24px]"
        >
          {t("กลับหน้าหลัก", "Back to home")} →
        </RouterLink>
      </section>
    );
  },
  { name: "NotFoundPage" },
);
