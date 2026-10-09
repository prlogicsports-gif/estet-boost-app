import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Baixa o código das telas antes do clique (links visíveis e toque/hover), para a troca ser instantânea.
    defaultPreload: "viewport",
    defaultPreloadStaleTime: 0,
  });

  return router;
};
