import { getJson } from "../../../core/api/client";
import type { Page } from "../../../core/types/pagination";
import type { Character, Detail, Meta } from "../types/character";
export const getCharacters = (params: URLSearchParams, signal?: AbortSignal) =>
  getJson<Page<Character>>(`/api/characters?${params}`, signal);
export async function getCharacter(
  game: string,
  id: string,
  awakening: number,
  signal?: AbortSignal,
) {
  const detail = await getJson<Detail>(
    `/api/characters/${encodeURIComponent(id)}?awakening=${awakening}`,
    signal,
  );
  if (detail.game_id !== game) throw new Error("404");
  return detail;
}
export const getCharacterMeta = () => getJson<Meta>("/api/characters/meta");
