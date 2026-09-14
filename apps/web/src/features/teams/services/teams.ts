import { getJson } from '../../../core/api/client'
import type { Page } from '../../../core/types/pagination'
import type { Team } from '../types/team'

export async function getTeam(game: string, id: string, signal?: AbortSignal) {
  const detail = await getJson<Team>(`/api/teams/${encodeURIComponent(id)}`, signal)

  if (detail.game_id !== game) throw new Error('404')

  return detail
}

export const getTeams = (game: string, page: number, signal?: AbortSignal) =>
  getJson<Page<Team>>(`/api/teams?game=${encodeURIComponent(game)}&limit=24&offset=${page * 24}`, signal)
