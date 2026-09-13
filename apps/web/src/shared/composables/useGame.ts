import { computed } from "vue";
import { useRoute } from "vue-router";
import { games } from "../../core/config/games";
export function useGame() {
  const route = useRoute();
  const gameId = computed(() => String(route.params.game || ""));
  const game = computed(() => games.find((item) => item.id === gameId.value));
  return { gameId, game };
}
