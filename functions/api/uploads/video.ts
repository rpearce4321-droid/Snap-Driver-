import { badRequest, json, serverError } from "../_db";

const MAX_BYTES = 30 * 1024 * 1024;

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  const uploads = (env as any).UPLOADS;
  if (!uploads) {
    return serverError("Uploads storage is not configured.");
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return badRequest("Invalid form data.");
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return badRequest("File is required.");
  }

  if (!file.type || !file.type.startsWith("video/")) {
    return badRequest("Please upload a video file.");
  }

  if (file.size > MAX_BYTES) {
    return badRequest("Video is too large. Use a smaller file (<= 30MB).");
  }

  const filename = file.name || "video";
  const ext = filename.includes(".") ? filename.slice(filename.lastIndexOf(".")) : "";
  const key = `video_${Date.now()}_${crypto.randomUUID()}${ext}`;

  try {
    const body = await file.arrayBuffer();
    await uploads.put(key, body, {
      httpMetadata: {
        contentType: file.type || "application/octet-stream",
      },
    });
  } catch {
    return serverError("Failed to upload file.");
  }

  return json({ ok: true, key, url: `/api/uploads/${key}` });
};
