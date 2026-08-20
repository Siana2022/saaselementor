/**
 * =============================================================================
 *  PILAR 5 (a) — Esquema propietario de Elementor (schemas Zod)
 * =============================================================================
 *
 * Estructura AFINADA contra fixtures reales:
 *   - fixtures/pages/*.json      → export STANDALONE de plantilla
 *                                  {content, page_settings, version, title, type}
 *   - fixtures/kit/site-settings.json / manifest.json / content|templates
 *                                → Website Kit (import/export kit)
 *
 * Dentro de un Website Kit los documentos usan el shape {content, settings,
 * metadata} y sus title/type viven en el manifest.
 * =============================================================================
 */

import { z } from "zod";

export const ElementorSettingsSchema = z.record(z.string(), z.unknown());
export type ElementorSettings = z.infer<typeof ElementorSettingsSchema>;

export interface ElementorElement {
  id: string;
  elType: "container" | "widget" | "section" | "column";
  settings: ElementorSettings;
  elements: ElementorElement[];
  widgetType?: string;
  isInner?: boolean;
}

export const ElementorElementSchema: z.ZodType<ElementorElement> = z.lazy(() =>
  z.object({
    id: z.string(),
    elType: z.enum(["container", "widget", "section", "column"]),
    settings: ElementorSettingsSchema.default({}),
    elements: z.array(ElementorElementSchema).default([]),
    widgetType: z.string().optional(),
    isInner: z.boolean().optional(),
  }),
);

/** Documento STANDALONE (export de una sola plantilla). */
export const ElementorDocumentSchema = z.object({
  version: z.string(),
  title: z.string(),
  type: z.string(),
  content: z.array(ElementorElementSchema),
  // Elementor exporta `[]` cuando no hay ajustes, u objeto si los hay.
  page_settings: z.union([ElementorSettingsSchema, z.array(z.unknown())]).default([]),
});
export type ElementorDocument = z.infer<typeof ElementorDocumentSchema>;

/** Documento INTERNO de un Website Kit: {content, settings, metadata}. */
export const KitDocumentSchema = z.object({
  content: z.array(ElementorElementSchema),
  settings: z.union([ElementorSettingsSchema, z.array(z.unknown())]).default([]),
  metadata: z.array(z.unknown()).default([]),
});
export type KitDocument = z.infer<typeof KitDocumentSchema>;

/* -------------------------------------------------------------------------- */
/*  Kit / Site Settings                                                       */
/* -------------------------------------------------------------------------- */

export const KitColorSchema = z.object({
  _id: z.string(),
  title: z.string(),
  color: z.string(),
});
export type KitColor = z.infer<typeof KitColorSchema>;

const CssLenSchema = z
  .object({ unit: z.string(), size: z.number(), sizes: z.array(z.number()).optional() })
  .catchall(z.unknown());

/** Tipografía del Kit. `.catchall` permite variantes responsive (real). */
export const KitTypographySchema = z
  .object({
    _id: z.string(),
    title: z.string(),
    typography_typography: z.literal("custom"),
    typography_font_family: z.string().optional(),
    typography_font_weight: z.string().optional(),
    typography_font_size: CssLenSchema.optional(),
    typography_line_height: CssLenSchema.optional(),
    typography_letter_spacing: CssLenSchema.optional(),
  })
  .catchall(z.unknown());
export type KitTypography = z.infer<typeof KitTypographySchema>;

/** site-settings.json — el Kit global real de un Website Kit. */
export const SiteSettingsSchema = z.object({
  content: z.array(z.unknown()).default([]),
  settings: z
    .object({
      system_colors: z.array(KitColorSchema).default([]),
      custom_colors: z.array(KitColorSchema).default([]),
      system_typography: z.array(KitTypographySchema).default([]),
      custom_typography: z.array(KitTypographySchema).default([]),
    })
    .catchall(z.unknown()),
  metadata: z.array(z.unknown()).default([]),
  theme: z.unknown().optional(),
  // En site-settings, `experiments` es un objeto de flags (no un array).
  experiments: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).default([]),
});
export type SiteSettings = z.infer<typeof SiteSettingsSchema>;

/* -------------------------------------------------------------------------- */
/*  Manifest                                                                  */
/* -------------------------------------------------------------------------- */

export const ManifestTemplateSchema = z
  .object({
    title: z.string(),
    doc_type: z.string(),
    thumbnail: z.union([z.string(), z.boolean()]).optional(),
  })
  .catchall(z.unknown());

/** manifest.json real de un Website Kit. */
export const ManifestSchema = z
  .object({
    name: z.string(),
    title: z.string(),
    description: z.string().nullable().optional(),
    author: z.string().optional(),
    version: z.string(),
    elementor_version: z.string(),
    created: z.string().optional(),
    thumbnail: z.union([z.string(), z.boolean()]).optional(),
    site: z.string().optional(),
    theme: z.unknown().optional(),
    experiments: z.array(z.unknown()).default([]),
    "site-settings": z.record(z.string(), z.boolean()).default({}),
    plugins: z.array(z.unknown()).default([]),
    templates: z.record(z.string(), ManifestTemplateSchema).default({}),
    taxonomies: z.record(z.string(), z.unknown()).default({}),
    content: z.record(z.string(), z.unknown()).default({}),
  })
  .catchall(z.unknown());
export type Manifest = z.infer<typeof ManifestSchema>;
