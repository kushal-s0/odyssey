import { z } from "zod";
import { BUSINESS_CATEGORIES } from "./business-categories.js";
export const mapPointSchema = z.object({
  lat: z.number().finite().min(-85).max(85),
  lon: z.number().finite().min(-180).max(180),
});
const category = z
  .string()
  .refine(
    (value) => BUSINESS_CATEGORIES.some(([key]) => key === value),
    "Choose a supported business category.",
  );
export const localContextSchema = z
  .object({
    place: mapPointSchema.extend({ name: z.string().trim().min(3).max(500) }),
    category,
    radius: z.number().int().min(500).max(5000),
    revision: z.number().int().nonnegative(),
  })
  .strict();
export const localObservationSchema = mapPointSchema
  .extend({
    name: z.string().trim().min(2).max(160),
    category,
    sourceUrl: z
      .string()
      .url()
      .max(1000)
      .refine((value) => {
        const u = new URL(value);
        return (
          ["http:", "https:"].includes(u.protocol) && !u.username && !u.password
        );
      }, "Use a public HTTP or HTTPS source link without credentials."),
    note: z.string().trim().min(10).max(1000),
    checked: z.boolean(),
  })
  .strict();
export function distanceMeters(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
) {
  const r = Math.PI / 180;
  const h =
    Math.sin(((a.lat - b.lat) * r) / 2) ** 2 +
    Math.cos(a.lat * r) *
      Math.cos(b.lat * r) *
      Math.sin(((a.lon - b.lon) * r) / 2) ** 2;
  return Math.round(
    6371000 *
      2 *
      Math.atan2(Math.sqrt(Math.min(1, h)), Math.sqrt(Math.max(0, 1 - h))),
  );
}
