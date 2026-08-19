/**
 * POST /api/export — { project } -> ZIP (application/zip) del Template Kit.
 */
import { ProjectAstSchema } from "@/lib/core/ast/types";
import { exportProjectZip } from "@/lib/compiler/export-zip";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const project = ProjectAstSchema.parse(body?.project);
    const bytes = await exportProjectZip(project);
    const fileName = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "kit"}-elementor-kit.zip`;
    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
}
