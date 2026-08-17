import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/accueil.tsx"),
  route("/jeu/:chansonId", "routes/jeu.tsx"),
] satisfies RouteConfig;
