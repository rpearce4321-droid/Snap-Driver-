import { json } from "./_db";

export const onRequestGet: PagesFunction = async () => {
  return json({ ok: true, status: "healthy", at: new Date().toISOString() });
};
