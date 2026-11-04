import { Hono } from "hono";
import { listCategories } from "../repository";
import type { AppBindings } from "../types";

export function createCategoriesRouter(): Hono<AppBindings> {
  const router = new Hono<AppBindings>();

  router.get("/", async (c) => {
    const categories = await listCategories(c.env.DB);
    return c.json(
      categories.map((category) => ({
        id: category.id,
        name: category.name,
        color_code: category.color_code,
        sort_order: category.sort_order
      }))
    );
  });

  return router;
}
