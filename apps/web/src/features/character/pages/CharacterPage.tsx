import { computed, defineComponent, onUnmounted, ref, watch } from "vue";
import { useLanguage } from "../../../shared/composables/useLanguage";
import { useGame } from "../../../shared/composables/useGame";
import { useCharacterLabels } from "../composables/useCharacterLabels";
import CharacterPageHeader from "../components/CharacterPageHeader";
import { RouterLink, useRoute } from "vue-router";
import type { Text } from "../../../core/types/text";
import type { Detail, Effect } from "../types/character";
import { getCharacter } from "../services/characters";
interface Props {}

export default defineComponent<Props>(
  () => {
    const { t, label } = useLanguage();
    const { stats, effectLabel, target, formatValue } = useCharacterLabels();
    const awakening = ref(0);
    const detail = ref<Detail | null>(null),
      detailLoading = ref(false),
      detailError = ref("");
    const route = useRoute();
    const { gameId: game } = useGame();
    const selected = computed(() =>
      typeof route.params.characterId === "string"
        ? route.params.characterId
        : "",
    );
    let detailController: AbortController | undefined;
    async function loadDetail() {
      detailController?.abort();
      detail.value = null;
      detailError.value = "";
      if (!selected.value) {
        detailLoading.value = false;
        return;
      }
      const controller = new AbortController();
      detailController = controller;
      detailLoading.value = true;
      try {
        const result = await getCharacter(
          game.value,
          selected.value,
          awakening.value,
          controller.signal,
        );
        if (!controller.signal.aborted) detail.value = result;
      } catch (e) {
        if (!controller.signal.aborted) detailError.value = String(e);
      } finally {
        if (!controller.signal.aborted) detailLoading.value = false;
      }
    }
    watch([selected, game, awakening], loadDetail, { immediate: true });
    onUnmounted(() => detailController?.abort());
    const effectGroups = computed(() => {
      const groups = new Map<string, Effect & { entries: Effect[] }>();
      for (const effect of detail.value?.effects || []) {
        // Keep recipients and activation conditions distinct within the same status.
        const key = effect.status_id
          ? JSON.stringify([
              effect.status_id,
              effect.target,
              effect.condition,
              effect.directly_granted,
            ])
          : effect.id;
        const group = groups.get(key);
        if (group) group.entries.push(effect);
        else groups.set(key, { ...effect, entries: [effect] });
      }
      return [...groups.values()];
    });
    const ruleFor = (effect: Effect) =>
      detail.value?.statuses.find((status) => status.id === effect.status_id)
        ?.rule;
    function durationFor(effect: Effect) {
      const rule = ruleFor(effect);
      if (rule?.mechanics?.end_when === "rift_gauge_zero")
        return t("จน Rift Gauge หมด", "Until Rift Gauge reaches 0");
      if (rule?.duration_kind === "timed")
        return rule.duration_seconds + t(" วินาที", " seconds");
      if (rule?.duration_kind === "unlimited")
        return t("ไม่จำกัดเวลา", "Unlimited");
      return t("ยังไม่ระบุ", "Unknown");
    }
    function skillText(text: string) {
      const names = [
        ...new Set(
          (detail.value?.statuses || [])
            .flatMap((s) => [s.name.en])
            .filter((n): n is string => !!n),
        ),
      ].sort((a, b) => b.length - a.length);
      if (!names.length) return [{ text, status: false }];
      const escaped = names.map((n) =>
        n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      );
      return text
        .split(
          new RegExp(
            "(?<![\\p{L}\\p{N}_])(" +
              escaped.join("|") +
              ")(?![\\p{L}\\p{N}_])",
            "gu",
          ),
        )
        .filter(Boolean)
        .map((part) => ({ text: part, status: names.includes(part) }));
    }
    const conditionLabel = (e: Effect) => {
      const c = e.condition;
      const parts: string[] = [];
      if (c.section_name && e.skill_id)
        parts.push(label(c.section_name as Text));
      if (c.requires_statuses)
        parts.push(
          t(
            "ต้องมี Sun และ Moon เพื่อแปลงสถานะ",
            "Requires Sun and Moon conversion",
          ),
        );
      if (c.requires_status === "rift")
        parts.push(t("ขณะอยู่ใน Rift’s Power", "While in Rift’s Power"));
      if (c.inside_field)
        parts.push(
          t("อยู่ภายในสนาม ทุก 1 วินาที", "Inside the field, every second"),
        );
      if (c.trigger === "max_stacks_reached")
        parts.push(
          t(
            "เมื่อ stack เต็ม แล้วล้างทั้งหมด",
            "At maximum stacks, then clear all",
          ),
        );
      if (c.resource === "darkness")
        parts.push(
          t(
            "มี Darkness อย่างน้อย 2 stacks และใช้ทั้งหมด",
            "Have at least 2 Darkness stacks; consume all",
          ),
        );
      if (c.per_resource_consumed)
        parts.push(
          t("ต่อ Devotion ที่ใช้ 1 stack", "Per Devotion stack consumed"),
        );
      if (c.on_hits)
        parts.push(
          t("โจมตีปกติครั้งที่ 2 หรือ 4 โดน", "Normal hit 2 or 4 lands"),
        );
      if (c.excludes)
        parts.push(t("ยกเว้นการโจมตีพิเศษ", "Excludes special attacks"));
      return parts.join(" · ");
    };

    return () => (
      <>
        {" "}
        <CharacterPageHeader
          title={t("รายละเอียดตัวละคร", "Character details")}
          awakening={awakening.value}
          onAwakeningChange={(value) => {
            awakening.value = value;
          }}
        />
        <RouterLink
          to={{ name: "characters", params: { game: game.value } }}
          t-data="back-link"
          class="state-layer text-body-s inline-block text-primary m-[0_0_24px]"
        >
          {"← "}
          {t("กลับไปตัวละครทั้งหมด", "Back to characters")}
        </RouterLink>
        {detailLoading.value ? (
          <div
            role="status"
            class="text-center bg-surface-container border border-outline-variant border-dashed rounded-[14px] p-[50px_24px] text-on-surface [&_p]:m-[15px_0_22px]"
          >
            {t("กำลังโหลดรายละเอียด…", "Loading character…")}
          </div>
        ) : detailError.value ? (
          <div
            role="alert"
            class="text-center bg-error-container border border-error border-dashed rounded-[14px] p-[50px_24px] text-on-error-container [&_p]:m-[15px_0_22px]"
          >
            <h2 class="text-title-l">
              {detailError.value.includes("404")
                ? t("ไม่พบตัวละครนี้", "Character not found")
                : t("โหลดรายละเอียดไม่ได้", "Unable to load details")}
            </h2>
            <button onClick={loadDetail}>{t("ลองใหม่", "Retry")}</button>
          </div>
        ) : detail.value ? (
          <article class="grid grid-cols-[255px_1fr] gap-7.5 max-[900px]:grid-cols-1 max-[580px]:gap-6">
            <aside
              t-data="profile-panel"
              class="self-start bg-surface-container p-5.5 border border-outline-variant rounded-[14px] sticky top-5 [&_h2]:text-headline-s [&_>_p]:text-body-s [&_>_p]:text-on-surface-variant [&_>_p]:mt-2 [&_.note]:text-body-s [&_.note]:text-on-surface-variant max-[900px]:static max-[900px]:block max-[900px]:[&_.character-monogram]:h-25"
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
              <p class="note">
                {t(
                  "ค่าผลสกิลที่แสดงใช้ Awakening",
                  "Effects shown for Awakening",
                )}{" "}
                {awakening.value}
              </p>
              <p class="note">{label(detail.value.notes)}</p>
            </aside>
            <div class="min-w-0">
              <section class="mb-[35px]">
                <h2 class="text-title-l">
                  {t("บัฟและผลต่อการต่อสู้", "Buffs & combat effects")}
                </h2>
                <p class="text-body-m text-on-surface-variant mt-2">
                  {t(
                    "แยกผู้รับ ผลเฉพาะท่า และผลที่ต้องอาศัยสถานะอื่น",
                    "Recipients, skill-specific bonuses and conditional effects are shown separately.",
                  )}
                </p>
                <div class="grid grid-cols-2 gap-3 mt-4.5 max-[580px]:grid-cols-1">
                  {effectGroups.value.map((e) => (
                    <div
                      key={e.id}
                      class="text-body-s p-[17px] bg-surface-container border border-outline-variant rounded-[10px] [&_h3]:text-title-s [&_h3]:text-on-surface [&_strong]:text-title-l-emphasized [&_strong]:block [&_strong]:text-primary [&_strong]:m-[5px_0] [&_p]:text-on-surface-variant [&_.conditional]:text-body-s [&_.conditional]:text-secondary [&_.conditional]:mt-2.5 [&_.condition-text]:text-on-surface [&_.condition-text]:mt-2.5 [&_details]:border-t [&_details]:border-outline-variant [&_details]:mt-3 [&_details]:pt-2.5 [&_summary]:cursor-pointer [&_summary]:text-primary [&_details_p]:mt-2.5"
                    >
                      <div class="text-label-s flex justify-between gap-2 text-on-surface-variant mb-2.5">
                        <span>
                          {[
                            ...new Set(
                              e.entries.map((entry) =>
                                effectLabel(entry.effect_type),
                              ),
                            ),
                          ].join(" · ")}
                        </span>
                        <span class="text-primary">{target(e.target)}</span>
                      </div>
                      <h3 class="text-title-m-emphasized">
                        {label(e.status_name || e.skill_name)}
                      </h3>
                      {e.entries.map((entry) => (
                        <div
                          key={entry.id}
                          class="effect-value [&_strong]:text-title-l [&_strong]:block [&_strong]:text-primary [&_+_.effect-value]:mt-[0.75rem]"
                        >
                          <strong>{formatValue(entry)}</strong>
                          <p>
                            {stats[entry.stat_code] || t("ดาเมจ", "Damage")}
                            {entry.element_code ? (
                              <>
                                {" · "}
                                {entry.element_code}
                              </>
                            ) : null}
                            {entry.scaling_stat ? (
                              <>
                                {" · "}
                                {t("อิง", "Based on")}{" "}
                                {stats[entry.scaling_stat]}
                                {" ("}
                                {entry.scaling_character_id}
                                {")"}
                              </>
                            ) : null}
                          </p>
                        </div>
                      ))}
                      {e.status_id ? (
                        <div
                          t-data="buff-rules"
                          class="mt-3.5 p-3 bg-surface-container-lowest border border-outline-variant rounded-[7px] [&_dl]:grid [&_dl]:grid-cols-2 [&_dl]:gap-3 [&_dl]:m-0 [&_dt]:text-label-s [&_dt]:text-on-surface-variant [&_dd]:text-body-s-emphasized [&_dd]:m-[3px_0_0] [&_dd]:text-on-surface [&_p]:text-body-s [&_p]:mt-2"
                        >
                          <dl>
                            <div>
                              <dt>{t("ระยะเวลา", "Duration")}</dt>
                              <dd>{durationFor(e)}</dd>
                            </div>
                            <div>
                              <dt>{"Max Stack"}</dt>
                              <dd>
                                {ruleFor(e)?.max_stacks ??
                                  t("ยังไม่ระบุ", "Unknown")}
                              </dd>
                            </div>
                          </dl>
                          {ruleFor(e)?.refresh_on_stack === true ? (
                            <p>
                              {t(
                                "ได้ stack เพิ่ม → รีเซ็ตระยะเวลา",
                                "Additional stacks refresh duration",
                              )}
                            </p>
                          ) : ruleFor(e)?.duration_kind === "timed" &&
                            ruleFor(e)?.refresh_on_stack === false ? (
                            <p>
                              {t(
                                "ได้ stack เพิ่ม → ไม่รีเซ็ตเวลา",
                                "Additional stacks do not refresh duration",
                              )}
                            </p>
                          ) : ruleFor(e)?.duration_kind === "timed" ? (
                            <p>
                              {t(
                                "การรีเซ็ตเวลายังไม่ระบุ",
                                "Duration refresh unknown",
                              )}
                            </p>
                          ) : null}
                          {ruleFor(e)?.mechanics?.clear_all_stacks ? (
                            <p>
                              {t(
                                "เมื่อ stack เต็ม: ทำดาเมจแล้วล้าง stack ทั้งหมด",
                                "At maximum stacks: deal damage and clear all stacks",
                              )}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                      {!e.directly_granted ? (
                        <p class="conditional">
                          {e.required_statuses.length
                            ? t(
                                "เกิดจากการผสมสถานะ",
                                "Created by combining statuses",
                              )
                            : t(
                                "ยังไม่มีวิธีได้รับโดยตรงที่ยืนยัน",
                                "No documented direct grant",
                              )}
                        </p>
                      ) : null}
                      {conditionLabel(e) ? (
                        <p class="condition-text">{conditionLabel(e)}</p>
                      ) : null}
                      {e.required_statuses.length ? (
                        <div class="border-t border-outline-variant mt-3 pt-3 [&_>_div_>_b]:capitalize [&_>_div_>_b]:text-secondary">
                          {e.required_statuses.map((required) => (
                            <div key={required.code}>
                              <b>{required.code}</b>
                              {!required.providers.length ? (
                                <p>
                                  {t(
                                    "ยังไม่มีข้อมูลผู้ให้สถานะนี้",
                                    "No documented provider yet",
                                  )}
                                </p>
                              ) : null}
                              {required.providers.map((provider, i) => (
                                <div
                                  key={provider.character_id + i}
                                  class="m-[8px_0_14px] [&_a]:text-primary [&_a]:[text-decoration:underline] [&_a]:[text-underline-offset:3px] [&_span]:text-body-s [&_span]:block [&_span]:text-on-surface-variant [&_p]:text-body-s"
                                >
                                  <RouterLink
                                    class="state-layer"
                                    to={`/game/${encodeURIComponent(game.value)}/characters/${encodeURIComponent(provider.character_id)}`}
                                  >
                                    {label(provider.character_name)}
                                    {" ↗"}
                                  </RouterLink>
                                  <span>
                                    {target(provider.target)}
                                    {provider.stacks !== null ? (
                                      <>
                                        {" · "}
                                        {provider.stacks}
                                        {" stacks"}
                                      </>
                                    ) : null}
                                  </span>
                                  <p>{label(provider.description)}</p>
                                </div>
                              ))}
                            </div>
                          ))}
                          <p class="text-body-s mt-3">
                            {t(
                              "ใช้ Sun และ Moon อย่างละ 1 stack บนผู้รับคนเดียวกัน จึงเกิด Lunar Eclipse; สถานะเฉพาะตัวเองไม่ได้แจกให้เพื่อน",
                              "Consumes 1 Sun and 1 Moon on the same recipient to create Lunar Eclipse. Self-only statuses are not shared with allies.",
                            )}
                          </p>
                        </div>
                      ) : null}
                      {e.applications.length ? (
                        <details>
                          <summary>
                            {t("วิธีได้รับและเงื่อนไข", "How to obtain")}
                          </summary>
                          {e.applications.map((a, i) => (
                            <p key={i}>
                              <b>{label(a.name)}</b>
                              {" — "}
                              {label(a.description)}
                            </p>
                          ))}
                        </details>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>
              <section class="mb-[35px]">
                <h2 class="text-title-l">
                  {t("สกิลหลัก", "Skills")}{" "}
                  <span class="text-label-m bg-surface-container-high rounded-md p-[4px_8px] ml-2">
                    {detail.value.skills.length}
                    {" / 6"}
                  </span>
                </h2>
                <div class="mt-4.5 grid gap-3.5">
                  {detail.value.skills.map((skill) => (
                    <section
                      key={skill.id}
                      class="border border-outline-variant rounded-[10px] overflow-hidden bg-surface-container-lowest [&_>_h3]:text-title-s [&_>_h3]:p-[15px_20px] [&_>_h3]:bg-surface-container-high [&_>_h3]:text-on-surface"
                    >
                      <h3 class="text-title-m-emphasized">
                        {label(skill.name)}
                      </h3>
                      <div class="p-[18px_20px] [&_p]:text-body-s [&_p]:text-on-surface">
                        <div class="flex gap-3 items-center mb-2.5">
                          {skill.has_hold ? (
                            <span
                              t-data="hold-badge"
                              class="text-label-s text-on-secondary-container border border-outline-variant bg-secondary-container p-[3px_8px] rounded"
                            >
                              {t("มีการกดค้าง", "HOLD")}
                            </span>
                          ) : null}
                          {skill.cooldown_seconds !== null ? (
                            <span class="text-body-s text-on-surface-variant">
                              {skill.cooldown_seconds}
                              {"s CD"}
                            </span>
                          ) : null}
                        </div>
                        <p class="whitespace-pre-line [&_mark]:text-on-secondary-container [&_mark]:bg-secondary-container [&_mark]:rounded-[3px] [&_mark]:p-[0_2px]">
                          {skillText(label(skill.description)).map(
                            (part, i) => (
                              <>
                                {part.status ? (
                                  <mark>{part.text}</mark>
                                ) : (
                                  <>{part.text}</>
                                )}
                              </>
                            ),
                          )}
                        </p>
                      </div>
                    </section>
                  ))}
                </div>
              </section>
              <section class="mb-[35px]">
                <h2 class="text-title-l">{"Awakening"}</h2>
                <div class="grid grid-cols-2 gap-3.5 mt-4.5 max-[580px]:grid-cols-1">
                  {detail.value.awakenings.map((a) => (
                    <div
                      key={a.level}
                      class={[
                        "p-5 border border-outline-variant rounded-[10px] bg-primary-container text-on-primary-container [&.locked]:bg-surface-container [&.locked]:border-outline-variant [&.locked]:text-on-surface-variant [&_h3]:text-title-s [&_h3]:m-[14px_0] [&_p]:text-body-s",
                        { locked: !a.unlocked },
                      ]}
                    >
                      <span class="text-label-s-emphasized text-primary mb-3">
                        {"A"}
                        {a.level}
                        {" · "}
                        {a.unlocked
                          ? t("ปลดล็อกตามขั้นที่เลือก", "ACTIVE")
                          : t("ยังไม่ถึงขั้นที่เลือก", "LOCKED")}
                      </span>
                      <h3 class="text-title-m-emphasized">{label(a.name)}</h3>
                      <p>{label(a.description)}</p>
                    </div>
                  ))}
                </div>
              </section>
              <section class="mb-8.75">
                <h2 class="text-title-l">
                  {t("สถานะและระยะเวลา", "Statuses & duration")}
                </h2>
                <div class="mt-3.75 border border-outline-variant rounded-[10px] p-[0_15px] [&_>_div]:text-body-s [&_>_div]:flex [&_>_div]:flex-wrap [&_>_div]:gap-[10px_20px] [&_>_div]:p-[15px_0] [&_>_div]:border-b [&_>_div]:border-outline-variant [&_>_div:last-child]:[border:0] [&_strong]:min-w-[135px] [&_span]:text-on-surface-variant [&_small]:text-secondary">
                  {detail.value.statuses.map((s) => (
                    <div key={s.id}>
                      <strong>{label(s.name)}</strong>
                      <span>
                        {s.rule?.max_stacks
                          ? `${s.rule.max_stacks} stacks`
                          : t("จำนวน stack ยังไม่ระบุ", "Stack cap unknown")}
                      </span>
                      <span>
                        {s.rule?.duration_kind === "timed"
                          ? `${s.rule.duration_seconds}s`
                          : s.rule?.duration_kind === "unlimited"
                            ? t("ไม่จำกัดเวลา", "Unlimited")
                            : t("ระยะเวลายังไม่ระบุ", "Duration unknown")}
                      </span>
                      {s.completeness === "partial" ? (
                        <small>{t("ข้อมูลยังไม่ครบ", "Partial data")}</small>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </article>
        ) : null}
      </>
    );
  },
  { name: "CharacterPage" },
);