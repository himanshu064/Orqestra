import { getCurrentUser, hasRole, PRIVILEGED_ROLES } from "@/auth/dal";
import { json } from "@/lib/http";
import { deleteDocument } from "@/services/documents";

export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (!hasRole(user, PRIVILEGED_ROLES)) {
    return json({ error: "You don't have permission to delete documents." }, 403);
  }
  const { id } = await params;
  await deleteDocument(user.organizationId, id);
  return new Response(null, { status: 204 });
}
