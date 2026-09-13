import {
  computed,
  defineComponent,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from "vue";
import { useLanguage } from "../../../shared/composables/useLanguage";
import { useGame } from "../../../shared/composables/useGame";
import { useCharacterLabels } from "../composables/useCharacterLabels";
import CharacterPageHeader from "../components/CharacterPageHeader";
import CharacterCard from "../components/CharacterCard";
import type { Character, Meta } from "../types/character";
import { getCharacters, getCharacterMeta } from "../services/characters";
interface Props {}

export default defineComponent<Props>(
  () => {
    const { t, label } = useLanguage();
    const { stats } = useCharacterLabels();
    const q = ref(""),
      element = ref(""),
      classCode = ref(""),
      buff = ref(""),
      recipient = ref(""),
      hold = ref(false),
      awakening = ref(0),
      page = ref(0);
    const items = ref<Character[]>([]),
      total = ref(0),
      meta = ref<Meta>({ games: [], elements: [], classes: [], buffStats: [] });
    const loading = ref(false),
      error = ref("");
    const { gameId: game } = useGame();
    const visibleElements = computed(() =>
      meta.value.elements.filter(
        (e) => !game.value || e.game_id === game.value,
      ),
    );
    const visibleClasses = computed(() =>
      meta.value.classes.filter((e) => !game.value || e.game_id === game.value),
    );
    let listController: AbortController | undefined;
    let timer: ReturnType<typeof setTimeout>;
    async function loadList() {
      listController?.abort();
      const controller = new AbortController();
      listController = controller;
      loading.value = true;
      error.value = "";
      const params = new URLSearchParams({
        awakening: String(awakening.value),
        limit: "24",
        offset: String(page.value * 24),
      });
      for (const [key, value] of Object.entries({
        q: q.value,
        game: game.value,
        element: element.value,
        class: classCode.value,
        buff: buff.value,
        target: recipient.value,
        hold: hold.value ? "true" : "",
      }))
        if (value) params.set(key, value);
      try {
        const result = await getCharacters(params, controller.signal);
        if (!controller.signal.aborted) {
          items.value = result.items;
          total.value = result.total;
        }
      } catch (e) {
        if (!controller.signal.aborted) {
          items.value = [];
          error.value = String(e);
        }
      } finally {
        if (!controller.signal.aborted) loading.value = false;
      }
    }
    async function loadMeta() {
      try {
        meta.value = await getCharacterMeta();
      } catch {
        error.value = "metadata";
      }
    }
    function reset() {
      q.value = "";
      element.value = "";
      classCode.value = "";
      buff.value = "";
      recipient.value = "";
      hold.value = false;
    }
    watch(
      [q, game, element, classCode, buff, recipient, hold, awakening],
      () => {
        page.value = 0;
        clearTimeout(timer);
        timer = setTimeout(loadList, 200);
      },
    );
    watch(game, () => {
      element.value = "";
      classCode.value = "";
    });
    watch(page, loadList);
    onMounted(() => {
      loadMeta();
      loadList();
    });
    onUnmounted(() => {
      clearTimeout(timer);
      listController?.abort();
    });

    return () => (
      <>
        {" "}
        <CharacterPageHeader
          title={t("ค้นหาตัวละครที่ใช่", "Find your next teammate")}
          awakening={awakening.value}
          onAwakeningChange={(value) => {
            awakening.value = value;
          }}
        />
        <section
          aria-label={t("ตัวกรองตัวละคร", "Character filters")}
          t-data="filters"
          class="bg-surface-container border border-outline-variant rounded-[14px] p-5.5 grid grid-cols-[1.4fr_1.4fr_1fr] gap-4.5 [&_label]:text-body-s [&_label]:grid [&_label]:gap-1.75 [&_label]:text-on-surface-variant [&_.checkbox]:text-body-s [&_.checkbox]:flex [&_.checkbox]:gap-2.25 [&_.checkbox]:items-center max-[900px]:grid-cols-2 max-[580px]:p-4 max-[580px]:gap-3.5"
        >
          <label class="max-[580px]:col-span-full">
            {t("ค้นหาชื่อ", "Search name")}
            <input
              value={q.value}
              onInput={(event) => {
                q.value = (event.target as HTMLInputElement).value;
              }}
              type="search"
              placeholder={t("เช่น Mei, เฮเลน…", "Mei, Helen…")}
            ></input>
          </label>
          <label>
            {t("ธาตุ", "Element")}
            <select
              value={element.value}
              onChange={(event) => {
                element.value = (event.target as HTMLSelectElement).value;
              }}
            >
              <option value="">{t("ทุกธาตุ", "All elements")}</option>
              {visibleElements.value.map((e) => (
                <option key={e.game_id + e.code} value={e.code}>
                  {label(e.name)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("คลาส", "Class")}
            <select
              value={classCode.value}
              onChange={(event) => {
                classCode.value = (event.target as HTMLSelectElement).value;
              }}
            >
              <option value="">{t("ทุกคลาส", "All classes")}</option>
              {visibleClasses.value.map((c) => (
                <option key={c.game_id + c.code} value={c.code}>
                  {label(c.name)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("บัฟที่เพิ่ม", "Stat buff")}
            <select
              value={buff.value}
              onChange={(event) => {
                buff.value = (event.target as HTMLSelectElement).value;
              }}
              aria-label={t("บัฟที่เพิ่ม", "Stat buff")}
              t-data="buff-filter"
            >
              <option value="">{t("ทุกบัฟ", "Any buff")}</option>
              {meta.value.buffStats.map((s) => (
                <option key={s} value={s}>
                  {stats[s] || s}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("ผู้รับบัฟ", "Buff recipient")}
            <select
              value={recipient.value}
              onChange={(event) => {
                recipient.value = (event.target as HTMLSelectElement).value;
              }}
              aria-label={t("ผู้รับบัฟ", "Buff recipient")}
              t-data="target-filter"
            >
              <option value="">{t("ทั้งหมด", "Any recipient")}</option>
              <option value="self">{t("เฉพาะตัวเอง", "Self only")}</option>
              <option value="all_allies">
                {t("แจกทั้งทีม", "All allies")}
              </option>
            </select>
          </label>
          <div class="col-span-full flex justify-between border-t border-outline-variant pt-3.5 items-center">
            <label class="checkbox [&_input]:w-4 [&_input]:min-h-auto [&_input]:accent-primary">
              <input
                checked={hold.value}
                onChange={(event) => {
                  hold.value = (event.target as HTMLInputElement).checked;
                }}
                type="checkbox"
              ></input>
              {t("มีท่าที่ต้องกดค้าง", "Has a hold action")}
            </label>
            <button
              onClick={reset}
              t-data="text-button"
              class="text-body-s bg-transparent [border:0] text-primary"
            >
              {t("ล้างตัวกรอง", "Reset filters")}
            </button>
          </div>
        </section>
        <div class="flex items-center justify-between gap-5 m-[32px_0_18px] [&_h2_span]:text-label-m [&_h2_span]:bg-surface-container-high [&_h2_span]:rounded-md [&_h2_span]:p-[4px_8px] [&_h2_span]:ml-2 [&_p]:text-body-s [&_p]:text-on-surface-variant max-[580px]:items-start max-[580px]:[&_p]:max-w-40 max-[580px]:[&_p]:text-right">
          <h2 class="text-title-l">
            {t("ตัวละคร", "Characters")}{" "}
            <span>{loading.value ? "…" : total.value}</span>
          </h2>
          <p>
            {t(
              "บัฟที่มีวิธีได้รับยืนยันแล้ว • ยังต้องทำตามเงื่อนไขสกิล",
              "Documented buff sources • Skill conditions still apply",
            )}
          </p>
        </div>
        {error.value ? (
          <div
            role="alert"
            class="text-center bg-error-container border border-error border-dashed rounded-[14px] p-[50px_24px] text-on-error-container [&_p]:m-[15px_0_22px]"
          >
            <h2 class="text-title-l">
              {t("ยังโหลดข้อมูลไม่ได้", "Unable to load characters")}
            </h2>
            <p>
              {t(
                "ลองอีกครั้งเมื่อระบบข้อมูลพร้อม",
                "Please try again when the data service is available.",
              )}
            </p>
            <button
              onClick={() => {
                loadMeta();
                loadList();
              }}
            >
              {t("ลองใหม่", "Retry")}
            </button>
          </div>
        ) : loading.value ? (
          <div
            role="status"
            class="text-center bg-surface-container border border-outline-variant border-dashed rounded-[14px] p-[50px_24px] text-on-surface [&_p]:m-[15px_0_22px]"
          >
            {t("กำลังค้นหาตัวละคร…", "Loading characters…")}
          </div>
        ) : !items.value.length ? (
          <div class="text-center bg-surface-container border border-outline-variant border-dashed rounded-[14px] p-[50px_24px] text-on-surface [&_p]:m-[15px_0_22px]">
            <h2 class="text-title-l">
              {t("ไม่พบตัวละครตามเงื่อนไข", "No matching characters")}
            </h2>
            <p>
              {t(
                "ลองเปลี่ยนบัฟหรือผู้รับบัฟ หากยังไม่มีข้อมูล ให้เพิ่มข้อมูลตัวละครก่อน",
                "Try another buff or recipient. If the archive is empty, add character data first.",
              )}
            </p>
            <button onClick={reset}>{t("ล้างตัวกรอง", "Reset filters")}</button>
          </div>
        ) : (
          <section class="grid grid-cols-3 gap-5 max-[900px]:grid-cols-2 max-[580px]:grid-cols-1">
            {items.value.map((c) => (
              <CharacterCard key={c.id} character={c} game={game.value} />
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
        <p class="text-body-s text-on-surface-variant mt-6.25">
          {t(
            "ตัวกรองบัฟแยกจากการฟื้น HP และการเพิ่มดาเมจเฉพาะสกิล ส่วนบัฟที่ต้องผสมสถานะแสดงในหน้ารายละเอียด",
            "Stat buffs are separate from healing and skill damage bonuses. Conversion-dependent buffs appear in character details.",
          )}
        </p>
      </>
    );
  },
  { name: "CharactersPage" },
);
