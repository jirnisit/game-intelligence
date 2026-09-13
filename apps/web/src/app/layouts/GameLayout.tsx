import { defineComponent } from "vue";
import { RouterLink, RouterView, useRoute } from "vue-router";
import { useGame } from "../../shared/composables/useGame";
import { useLanguage } from "../../shared/composables/useLanguage";
interface Props {}

export default defineComponent<Props>(
  () => {
    const { t, label } = useLanguage();
    const route = useRoute();
    const { game, gameId } = useGame();
    return () => (
      <>
        <RouterLink
          to="/"
          t-data="back-link"
          class="state-layer text-body-s inline-block text-primary m-[0_0_24px]"
        >
          ← {t("เกมทั้งหมด", "All games")}
        </RouterLink>
        <div class="[&_img]:w-60 [&_img]:max-w-full [&_img]:h-25 [&_img]:object-contain [&_img]:[object-position:left_center]">
          <img src={game.value?.logo} alt={label(game.value?.name)} />
        </div>
        <nav
          t-data="section-nav"
          class="flex gap-6 m-[12px_0_32px] border-b border-outline-variant [&_a]:p-[0.5rem_0] [&_a[aria-current='page']]:text-primary [&_a[aria-current='page']]:[border-bottom:2px_solid_currentColor]"
          aria-label={t("เมนูเกม", "Game navigation")}
        >
          <RouterLink
            class="state-layer"
            to={{ name: "characters", params: { game: gameId.value } }}
            aria-current={!route.path.includes("/teams") ? "page" : undefined}
          >
            {t("ตัวละคร", "Characters")}
          </RouterLink>
          <RouterLink
            class="state-layer"
            to={{ name: "teams", params: { game: gameId.value } }}
            aria-current={route.path.includes("/teams") ? "page" : undefined}
          >
            {t("ทีม", "Teams")}
          </RouterLink>
        </nav>
        <RouterView key={gameId.value} />
      </>
    );
  },
  { name: "GameLayout" },
);
