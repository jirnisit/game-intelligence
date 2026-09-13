import { createRouter, createWebHistory } from "vue-router";
import HomePage from "../../features/home/pages/HomePage";
import GameLayout from "../layouts/GameLayout";
import { games } from "../../core/config/games";
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "home",
      component: HomePage,
      meta: { title: "Kab Game" },
    },
    {
      path: "/game/:game",
      component: GameLayout,
      children: [
        {
          path: "",
          redirect: (to) => ({
            name: "characters",
            params: { game: to.params.game },
          }),
        },
        {
          path: "characters",
          name: "characters",
          component: () =>
            import("../../features/character/pages/CharactersPage"),
        },
        {
          path: "characters/:characterId",
          name: "character",
          component: () =>
            import("../../features/character/pages/CharacterPage"),
        },
        {
          path: "teams",
          name: "teams",
          component: () => import("../../features/teams/pages/TeamsPage"),
        },
        {
          path: "teams/:teamId",
          name: "team",
          component: () => import("../../features/teams/pages/TeamsPage"),
        },
      ],
    },
    {
      path: "/:pathMatch(.*)*",
      name: "not-found",
      component: () => import("../pages/NotFoundPage"),
      meta: { title: "404 | Kab Game" },
    },
  ],
  scrollBehavior: (_to, _from, savedPosition) => savedPosition || { top: 0 },
});
router.beforeEach((to) => {
  if (to.params.game && !games.some((game) => game.id === to.params.game)) {
    return {
      name: "not-found",
      params: { pathMatch: to.path.slice(1).split("/") },
      query: to.query,
      hash: to.hash,
    };
  }
});
router.afterEach((to) => {
  const game = games.find((game) => game.id === to.params.game);
  document.title = game
    ? `${game.name.en} | Kab Game`
    : String(to.meta.title || "Kab Game");
});
