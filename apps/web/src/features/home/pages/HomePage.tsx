import { defineComponent } from "vue";
import { RouterLink } from "vue-router";
import { games } from "../../../core/config/games";
import { useLanguage } from "../../../shared/composables/useLanguage";
interface Props {}

export default defineComponent<Props>(
  () => {
    const { t, label } = useLanguage();
    return () => (
      <>
        <div class="flex justify-between gap-7.5 items-end mb-7.5 max-[580px]:block m-[24px_0_36px]">
          <div>
            <p class="text-label-s-emphasized text-primary mb-3">
              KAB GAME / HOME
            </p>
            <h1 class="text-display-s max-[580px]:text-headline-l">
              {t("เลือกเกมที่คุณเล่น", "Choose your game")}
            </h1>
            <p class="text-body-m text-on-surface-variant mt-2">
              {t(
                "ข้อมูลตัวละคร สกิล และทีม รวมไว้ในที่เดียว",
                "Characters, skills and teams, all in one place.",
              )}
            </p>
          </div>
        </div>
        <section
          class="grid grid-cols-2 gap-6 max-[580px]:grid-cols-1"
          aria-label={t("รายการเกม", "Games")}
        >
          {games.map((game) => (
            <RouterLink
              key={game.id}
              to={{ name: "characters", params: { game: game.id } }}
              t-data="game-card"
              class="state-layer overflow-hidden border border-outline-variant rounded-2xl bg-surface-container"
            >
              <div
                t-data="game-art"
                class="min-h-60 flex items-center justify-center p-8 bg-radial from-surface-container-highest to-surface-container-low [&_img]:w-full [&_img]:max-w-90 [&_img]:h-45 [&_img]:object-contain max-[580px]:min-h-50 max-[580px]:p-6"
              >
                <img src={game.logo} alt={label(game.name)} />
              </div>
              <div class="p-6">
                <h2 class="text-title-l">{label(game.name)}</h2>
                <p class="text-body-m text-on-surface-variant mt-2">
                  {label(game.description)}
                </p>
                <span class="text-body-m block mt-6 text-primary">
                  {t("ดูข้อมูลเกม", "Explore game")} →
                </span>
              </div>
            </RouterLink>
          ))}
        </section>
      </>
    );
  },
  { name: "HomePage" },
);
