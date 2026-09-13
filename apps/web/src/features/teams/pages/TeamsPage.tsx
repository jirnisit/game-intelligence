import { computed, onUnmounted, ref, watch } from "vue";
import type { Text } from "../../../core/types/text";
import type { Team } from "../types/team";
import { getTeam, getTeams } from "../services/teams";
import { useLanguage } from "../../../shared/composables/useLanguage";
import { useGame } from "../../../shared/composables/useGame";
import { defineComponent } from "vue";
import { RouterLink, useRoute } from "vue-router";
interface Props {}

export default defineComponent<Props>(
  () => {
    const { lang } = useLanguage();
    const route = useRoute();
    const { gameId: game } = useGame();
    const t = (th: string, en: string) => (lang.value === "th" ? th : en);
    const label = (value: Text) =>
      value[lang.value] || value.en || value.th || "";
    const id = computed(() =>
      typeof route.params.teamId === "string" ? route.params.teamId : "",
    );
    const items = ref<Team[]>([]),
      team = ref<Team | null>(null),
      loading = ref(false),
      error = ref(""),
      page = ref(0),
      total = ref(0);
    let controller: AbortController | undefined;
    async function load() {
      controller?.abort();
      const current = new AbortController();
      controller = current;
      loading.value = true;
      error.value = "";
      team.value = null;
      items.value = [];
      try {
        if (id.value) {
          const data = await getTeam(game.value, id.value, current.signal);
          if (!current.signal.aborted) team.value = data;
        } else {
          const data = await getTeams(game.value, page.value, current.signal);
          if (current.signal.aborted) return;
          items.value = data.items;
          total.value = data.total;
        }
      } catch (e) {
        if (!current.signal.aborted) error.value = String(e);
      } finally {
        if (!current.signal.aborted) loading.value = false;
      }
    }
    watch(
      id,
      () => {
        page.value = 0;
        load();
      },
      { immediate: true },
    );
    watch(page, load);
    onUnmounted(() => controller?.abort());

    return () => (
      <>
        {" "}
        <div class="flex justify-between gap-7.5 items-end mb-7.5 max-[580px]:block">
          <div>
            <p class="text-label-s-emphasized text-primary mb-3">
              {"TEAM ARCHIVE / 02"}
            </p>
            <h1 class="text-display-s max-[580px]:text-headline-l">
              {t("ทีมและลำดับการเล่น", "Teams & rotations")}
            </h1>
            <p class="text-body-m text-on-surface-variant mt-2">
              {t(
                "สมาชิกทีมและโน้ตการเล่นของคุณ",
                "Your team members and play notes",
              )}
            </p>
          </div>
        </div>
        {id.value ? (
          <RouterLink
            to={{ name: "teams", params: { game: game.value } }}
            t-data="back-link"
            class="state-layer text-body-s inline-block text-primary m-[0_0_24px]"
          >
            {"← "}
            {t("กลับไปรายการทีม", "Back to teams")}
          </RouterLink>
        ) : null}
        {loading.value ? (
          <div
            role="status"
            class="text-center bg-surface-container border border-outline-variant border-dashed rounded-[14px] p-[50px_24px] text-on-surface [&_p]:m-[15px_0_22px]"
          >
            {t("กำลังโหลดทีม…", "Loading teams…")}
          </div>
        ) : error.value ? (
          <div
            role="alert"
            class="text-center bg-error-container border border-error border-dashed rounded-[14px] p-[50px_24px] text-on-error-container [&_p]:m-[15px_0_22px]"
          >
            <h2 class="text-title-l">
              {error.value.includes("404")
                ? t("ไม่พบทีมนี้", "Team not found")
                : t("โหลดทีมไม่ได้", "Unable to load teams")}
            </h2>
            <button onClick={load}>{t("ลองใหม่", "Retry")}</button>
          </div>
        ) : team.value ? (
          <article class="text-body-l max-w-[1000px] rounded-[10px] border border-outline-variant bg-surface-container p-[clamp(20px,3vw,32px)] [&_h2]:text-headline-s [&_h3]:text-title-l [&_h3]:mb-3">
            <p class="text-label-s-emphasized text-primary mb-3">
              {label(team.value.game_name)}
            </p>
            <h2 class="text-title-l">{label(team.value.name)}</h2>
            <div
              t-data="team-members"
              class="flex flex-wrap gap-3 m-[1rem_0_1.5rem] [&_a]:text-body-l [&_a]:border [&_a]:border-outline-variant [&_a]:rounded-lg [&_a]:p-[0.5rem_0.75rem]"
            >
              {team.value.characters.map((member) => (
                <RouterLink
                  class="state-layer"
                  key={member.id}
                  to={`/game/${encodeURIComponent(game.value)}/characters/${encodeURIComponent(member.id)}`}
                >
                  {label(member.name)}
                  {" ↗"}
                </RouterLink>
              ))}
            </div>
            <h3 class="text-title-m-emphasized">
              {t("รายละเอียดและลำดับการเล่น", "Details & rotation")}
            </h3>
            <p
              t-data="team-description"
              class="whitespace-pre-wrap [overflow-wrap:anywhere]"
            >
              {label(team.value.description) ||
                t("ยังไม่มีรายละเอียด", "No details yet")}
            </p>
          </article>
        ) : (
          <>
            {!items.value.length ? (
              <div class="text-center bg-surface-container border border-outline-variant border-dashed rounded-[14px] p-[50px_24px] text-on-surface [&_p]:m-[15px_0_22px]">
                {t("ยังไม่มีทีม", "No teams yet")}
              </div>
            ) : (
              <section class="grid grid-cols-3 gap-5 max-[900px]:grid-cols-2 max-[580px]:grid-cols-1">
                {items.value.map((item) => (
                  <article
                    key={item.id}
                    t-data="team-card"
                    class="text-body-l rounded-[10px] border border-outline-variant bg-surface-container p-5"
                  >
                    <p class="text-label-s-emphasized text-primary mb-3">
                      {label(item.game_name)}
                    </p>
                    <h2 class="text-title-l">
                      <RouterLink
                        class="state-layer"
                        to={`/game/${encodeURIComponent(game.value)}/teams/${encodeURIComponent(item.id)}`}
                      >
                        {label(item.name)}
                        {" →"}
                      </RouterLink>
                    </h2>
                    <div
                      t-data="team-members"
                      class="flex flex-wrap gap-3 m-[1rem_0_1.5rem] [&_a]:text-body-l [&_a]:border [&_a]:border-outline-variant [&_a]:rounded-lg [&_a]:p-[0.5rem_0.75rem]"
                    >
                      {item.characters.map((member) => (
                        <RouterLink
                          class="state-layer"
                          key={member.id}
                          to={`/game/${encodeURIComponent(game.value)}/characters/${encodeURIComponent(member.id)}`}
                        >
                          {label(member.name)}
                          {" ↗"}
                        </RouterLink>
                      ))}
                    </div>
                    <p class="text-body-l [display:-webkit-box] [-webkit-line-clamp:3] [-webkit-box-orient:vertical] overflow-hidden whitespace-pre-wrap">
                      {label(item.description)}
                    </p>
                    <RouterLink
                      to={`/game/${encodeURIComponent(game.value)}/teams/${encodeURIComponent(item.id)}`}
                      t-data="back-link"
                      class="state-layer text-body-s inline-block text-primary m-[0_0_24px]"
                    >
                      {t("ดูรายละเอียด", "View details")}
                      {" →"}
                    </RouterLink>
                  </article>
                ))}
              </section>
            )}
            {total.value > 24 ? (
              <nav class="flex gap-5 items-center justify-center mt-5">
                <button
                  disabled={page.value === 0}
                  onClick={() => {
                    page.value--;
                  }}
                >
                  {t("ก่อนหน้า", "Previous")}
                </button>
                <span>{page.value + 1}</span>
                <button
                  disabled={(page.value + 1) * 24 >= total.value}
                  onClick={() => {
                    page.value++;
                  }}
                >
                  {t("ถัดไป", "Next")}
                </button>
              </nav>
            ) : null}
          </>
        )}{" "}
      </>
    );
  },
  { name: "TeamsPage" },
);
