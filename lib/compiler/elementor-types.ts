/**
 * =============================================================================
 *  PILAR 5 (a) — Esquema propietario de Elementor (schemas Zod)
 * =============================================================================
 *
 * ⚠️ PROVISIONAL: la estructura sigue el formato de export PÚBLICO y estable de
 * Elementor (elType/settings/elements, widgetType, __globals__). Las CLAVES
 * exactas de `settings` por widget deben validarse contra FIXTURES reales
 * (Regla: nunca inventar el JSON de Elementor). Por eso `settings` se tipa
 * permisivo (record) y sólo se valida la ESTRUCTURA.
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

/** Documento de página/plantilla exportable por Elementor. */
export const ElementorDocumentSchema = z.object({
  version: z.string(),
  title: z.string(),
  type: z.string(), // "page" | "section" | "container" | "loop-item" | "header" | "footer" | "archive" | "popup" ...
  content: z.array(ElementorElementSchema),
  // Elementor exporta `[]` cuando no hay ajustes de página, u objeto si los hay.
  page_settings: z.union([ElementorSettingsSchema, z.array(z.unknown())]).default([]),
});
export type ElementorDocument = z.infer<typeof ElementorDocumentSchema>;

/** Color del sistema dentro del Kit. */
export const KitSystemColorSchema = z.object({
  _id: z.string(),
  title: z.string(),
  color: z.string(),
});

/** Tipografía del sistema dentro del Kit. */
export const KitSystemTypographySchema = z.object({
  _id: z.string(),
  title: z.string(),
  typography_typography: z.literal("custom"),
  typography_font_family: z.string().optional(),
  typography_font_weight: z.string().optional(),
  typography_font_size: z
    .object({ unit: z.string(), size: z.number(), sizes: z.array(z.number()).optional() })
    .optional(),
  typography_line_height: z
    .object({ unit: z.string(), size: z.number(), sizes: z.array(z.number()).optional() })
    .optional(),
  typography_letter_spacing: z
    .object({ unit: z.string(), size: z.number(), sizes: z.array(z.number()).optional() })
    .optional(),
});

/** Kit global (ajustes del sitio). PROVISIONAL — validar con fixture real. */
export const ElementorKitSchema = z.object({
  version: z.string(),
  title: z.string(),
  type: z.literal("kit"),
  settings: z.object({
    system_colors: z.array(KitSystemColorSchema).default([]),
    custom_colors: z.array(KitSystemColorSchema).default([]),
    system_typography: z.array(KitSystemTypographySchema).default([]),
    custom_typography: z.array(KitSystemTypographySchema).default([]),
  }),
});
export type ElementorKit = z.infer<typeof ElementorKitSchema>;

/** Entrada de plantilla en el manifest. */
export const ManifestTemplateSchema = z.object({
  id: z.string(),
  title: z.string(),
  doc_type: z.string(),
  name: z.string(),
});

/** manifest.json del Template Kit. PROVISIONAL. */
export const ElementorManifestSchema = z.object({
  name: z.string(),
  title: z.string(),
  version: z.string(),
  elementor_version: z.string(),
  templates: z.record(z.string(), ManifestTemplateSchema).default({}),
  content: z.record(z.string(), z.unknown()).default({}),
});
export type ElementorManifest = z.infer<typeof ElementorManifestSchema>;
