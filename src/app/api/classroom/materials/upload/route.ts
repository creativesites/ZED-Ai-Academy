import { NextRequest } from "next/server";
import { createClassroomMaterial } from "@/actions/classroom-materials";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const material = await createClassroomMaterial(formData);
    return Response.json({ material }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to upload learning material.";
    return Response.json({ error: message }, { status: 400 });
  }
}
