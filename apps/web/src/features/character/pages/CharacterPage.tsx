import { groupEffects } from "../utils/groupEffects";
import { computed, defineComponent, onUnmounted, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { useLanguage } from "../../../shared/composables/useLanguage";
import { useGame } from "../../../shared/composables/useGame";
import { useCharacterLabels } from "../composables/useCharacterLabels";
import CharacterPageHeader from "../components/CharacterPageHeader";
import CombatEffectCard from "../components/CombatEffectCard";
import StatusRules from "../components/StatusRules";
import type { Detail } from "../types/character";
import { getCharacter } from "../services/characters";
interface Props {}
export default defineComponent<Props>(() => {
  const { t, label } = useLanguage();
  const { awakeningLabel } = useCharacterLabels();
  const route = useRoute();
  const { gameId: game } = useGame();
  const detail = ref<Detail | null>(null), loading = ref(false), error = ref("");
  const selected = computed(() => typeof route.params.characterId === "string" ? route.params.characterId : "");
  let controller: AbortController | undefined;
  async function load() {
    controller?.abort();
    const request = new AbortController(); controller = request;
    detail.value = null; error.value = ""; loading.value = true;
    try { const result = await getCharacter(game.value, selected.value, 0, request.signal); if (!request.signal.aborted) detail.value = result; }
    catch (e) { if (!request.signal.aborted) error.value = String(e); }
    finally { if (!request.signal.aborted) loading.value = false; }
  }
  watch([selected, game], load, { immediate: true });
  onUnmounted(() => controller?.abort());
  const groups = computed(() => groupEffects(detail.value?.effect_variants ?? detail.value?.effects ?? []).map(entries => ({key: entries[0].id, entries})));
  function skillText(text: string) {
    const names = [...new Set((detail.value?.statuses ?? []).flatMap(status => [status.name.en, status.name.th]).filter((name): name is string => !!name))].sort((a,b)=>b.length-a.length);
    if (!names.length) return [{ text, status: false }];
    const escaped = names.map(name=>name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    return text.split(new RegExp("("+escaped.join("|")+")", "gu")).filter(Boolean).map(part=>({text:part,status:names.includes(part)}));
  }
  return () => <>
    <CharacterPageHeader title={t("รายละเอียดตัวละคร", "Character details")} />
    <RouterLink to={{name:"characters",params:{game:game.value}}} t-data="back-link" class="state-layer text-body-s inline-block text-primary mb-6">← {t("กลับไปตัวละครทั้งหมด", "Back to characters")}</RouterLink>
    {loading.value ? <p role="status" class="text-body-m p-6">{t("กำลังโหลดรายละเอียด…", "Loading character…")}</p> : error.value ? <div role="alert" class="bg-error-container text-on-error-container rounded-lg p-6">
      <h2 class="text-title-l">{error.value.includes("404") ? t("ไม่พบตัวละครนี้", "Character not found") : t("โหลดรายละเอียดไม่ได้", "Unable to load details")}</h2><button onClick={load}>{t("ลองใหม่", "Retry")}</button>
    </div> : detail.value ? <article class="grid grid-cols-[255px_1fr] gap-7 max-[900px]:grid-cols-1">
            <aside
              t-data="profile-panel"
              class="self-start bg-surface-container p-5.5 border border-outline-variant rounded-[14px] sticky top-5 [&_h2]:text-headline-s [&_>_p]:text-body-s [&_>_p]:text-on-surface-variant [&_>_p]:mt-2 [&_.note]:text-body-l [&_.note]:text-on-surface-variant max-[900px]:static max-[900px]:block max-[900px]:[&_.character-monogram]:h-25"
            >
              <div
                class={[
                  "character-monogram text-display-l h-37 flex items-center justify-center relative text-primary bg-radial from-primary/20 to-transparent m-[10px_0_24px] [&.light]:text-secondary [&.light]:bg-radial [&.light]:from-secondary/20 [&.light]:to-transparent [&.dark]:text-tertiary [&.dark]:bg-radial [&.dark]:from-tertiary/20 [&.dark]:to-transparent [&_span]:text-body-s [&_span]:absolute [&_span]:bottom-0 [&_span]:text-on-surface-variant max-[580px]:h-[115px]",
                  detail.value.element_code,
                ]}
              >
                {detail.value.name.en?.slice(0, 1)}
                <span>
                  {"BREAKER / "}
                  {detail.value.rarity}
                </span>
              </div>
              <h2 class="text-title-l">{label(detail.value.name)}</h2>
              <p>{detail.value.name.en}</p>
              <div class="[&_span]:text-body-s [&_span]:p-[5px_10px] [&_span]:rounded-[5px] [&_span]:bg-surface-container-highest flex gap-[7px] flex-wrap m-[20px_0]">
                <span>{label(detail.value.element_name)}</span>
                <span>{label(detail.value.class_name)}</span>
                <span>{label(detail.value.race)}</span>
              </div>
              <p class="note">{label(detail.value.notes)}</p>
            </aside>
      <div class="min-w-0 grid gap-8">
        <section>
          <h2 class="text-title-l">{t("บัฟและผลต่อการต่อสู้", "Buffs & combat effects")}</h2>
          <p class="text-body-m text-on-surface-variant mt-2">{t("แสดงค่าปกติและ Awakening พร้อมกัน ค่าแทนที่ไม่บวกรวมกับค่าเดิม", "Base and Awakening values are shown together. Replacement values do not add to the original.")}</p>
          <div class="grid grid-cols-2 gap-3 mt-4 max-[580px]:grid-cols-1">{groups.value.map(g => <CombatEffectCard key={g.key} entries={g.entries} game={game.value} />)}</div>
        </section>
        <section>
          <h2 class="text-title-l">{t("สกิลหลัก", "Skills")} · {detail.value.skills.length} / 6</h2>
          <div class="grid gap-3 mt-4">{detail.value.skills.map(skill => <section key={skill.id} class="border border-outline-variant rounded-lg bg-surface-container p-5">
            <h3 class="text-title-m-emphasized">{label(skill.name)}</h3>
            <div class="text-label-m text-on-surface-variant flex gap-3 my-2">
              {skill.has_hold ? <span t-data="hold-badge" class="bg-secondary-container text-on-secondary-container rounded px-2">{t("มีการกดค้าง", "HOLD")}</span> : null}
              {skill.cooldown_seconds !== null ? <span>{skill.cooldown_seconds}s CD</span> : null}
            </div>
            <p class="text-body-m whitespace-pre-line">{skillText(label(skill.description)).map((part,i) => part.status ? <mark key={i} class="bg-secondary-container text-on-secondary-container rounded px-0.5">{part.text}</mark> : part.text)}</p>
          </section>)}</div>
        </section>
        <section>
          <h2 class="text-title-l">Awakening</h2>
          <div class="grid grid-cols-2 gap-3 mt-4 max-[580px]:grid-cols-1">{detail.value.awakenings.map(a => <section key={a.level} t-data="awakening-description" class="bg-primary-container text-on-primary-container rounded-lg p-5">
            <span class="text-label-l-emphasized">{awakeningLabel(a.level)}</span><h3 class="text-title-m mt-2">{label(a.name)}</h3><p class="text-body-m mt-2 whitespace-pre-line">{label(a.description)}</p>
          </section>)}</div>
        </section>
        <section>
          <h2 class="text-title-l">{t("สถานะและกฎแต่ละระดับ", "Statuses and rules by awakening")}</h2>
          <div class="grid gap-4 mt-4">{detail.value.statuses.map(status => <section key={status.id} class="border border-outline-variant rounded-lg p-4">
            <h3 class="text-title-m">{label(status.name)}</h3>
            <p class="text-body-s my-2 whitespace-pre-line">{label(status.description)}</p>
            <StatusRules rules={status.rules ?? (status.rule ? [status.rule] : [])} />
            {status.completeness === "partial" ? <p class="text-body-s text-on-surface-variant mt-2">{t("ข้อมูลบางส่วนยังไม่ทราบ", "Some mechanics remain unknown")}</p> : null}
          </section>)}</div>
        </section>
        {detail.value.reaction_pairs?.length ? <section t-data="reaction-pairs">
          <h2 class="text-title-l">{t("คู่ธาตุสำหรับ Fusion", "Fusion element pairs")}</h2>
          {detail.value.reaction_pairs.map(pair => <div key={pair.element_a+pair.element_b} class="text-body-m mt-3">
            <p>{pair.element_a} ↔ {pair.element_b}</p><p>{pair.description ? label(pair.description) : ""}</p>
          </div>)}
          <p class="text-body-s text-on-surface-variant mt-2">{t("ใช้สกิลธาตุของ A → สลับไป B ที่เป็นธาตุคู่กัน → เกิด Reaction โดย B ไม่ต้องกดสกิลธาตุ", "Use A’s Elemental Skill → switch to B of the paired element → receive the Reaction. B does not need to cast an Elemental Skill.")}</p>
        </section> : null}
      </div>
    </article> : null}
  </>;
});
