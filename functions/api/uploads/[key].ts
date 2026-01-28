import { badRequest } from "../_db";

export const onRequestGet: PagesFunction = async ({ params, env }) => {
  const uploads = (env as any).UPLOADS;
  if (!uploads) {
    return new Response("Uploads storage is not configured.", { status: 500 });
  }

  const keyParam = (params as any).key;
  const key = Array.isArray(keyParam) ? keyParam.join("/") : keyParam;
  if (!key || typeof key !== "string") {
    return badRequest("Missing key.");
  }

  const object = await uploads.get(key);
  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Cache-Control", "public, max-age=86400");
  return new Response(object.body, { headers });
};
