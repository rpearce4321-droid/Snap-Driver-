const DEFAULT_MAX_BYTES = 6 * 1024 * 1024;
const DEFAULT_MAX_VIDEO_BYTES = 30 * 1024 * 1024;
const DEFAULT_MAX_VIDEO_SECONDS = 45;

export async function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) reject(new Error("Failed to read file."));
      else resolve(result);
    };
    reader.readAsDataURL(file);
  });
}

export async function uploadImageFile(file: File, maxBytes = DEFAULT_MAX_BYTES): Promise<string> {
  if (!file) throw new Error("No file selected.");
  if (file.size > maxBytes) {
    throw new Error("Image is too large. Use a smaller file (<= 6MB)." );
  }

  const form = new FormData();
  form.set("file", file);

  const res = await fetch("/api/uploads", {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    let msg = "Upload failed.";
    try {
      const data = await res.json();
      if (data?.error) msg = data.error;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }

  const data = await res.json();
  if (!data?.url) {
    throw new Error("Upload failed.");
  }

  return data.url as string;
}

export async function uploadImageWithFallback(file: File, maxBytes = DEFAULT_MAX_BYTES): Promise<string> {
  try {
    return await uploadImageFile(file, maxBytes);
  } catch (err) {
    if (import.meta.env?.DEV) {
      return await readImageAsDataUrl(file);
    }
    throw err;
  }
}

export const MAX_IMAGE_BYTES = DEFAULT_MAX_BYTES;

export async function readVideoAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) reject(new Error("Failed to read file."));
      else resolve(result);
    };
    reader.readAsDataURL(file);
  });
}

export async function getVideoDurationSeconds(file: File): Promise<number> {
  if (typeof document === "undefined") return 0;
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      const cleanup = () => {
        video.removeAttribute("src");
        video.load();
      };
      video.onloadedmetadata = () => {
        const duration = Number.isFinite(video.duration) ? video.duration : 0;
        cleanup();
        resolve(duration);
      };
      video.onerror = () => {
        cleanup();
        reject(new Error("Unable to read video duration."));
      };
      video.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function uploadVideoFile(file: File, maxBytes = DEFAULT_MAX_VIDEO_BYTES): Promise<string> {
  if (!file) throw new Error("No file selected.");
  if (!file.type || !file.type.startsWith("video/")) {
    throw new Error("Please upload a video file.");
  }
  if (file.size > maxBytes) {
    throw new Error("Video is too large. Use a smaller file (<= 30MB).");
  }

  const form = new FormData();
  form.set("file", file);

  const res = await fetch("/api/uploads/video", {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    let msg = "Upload failed.";
    try {
      const data = await res.json();
      if (data?.error) msg = data.error;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }

  const data = await res.json();
  if (!data?.url) {
    throw new Error("Upload failed.");
  }

  return data.url as string;
}

export async function uploadVideoWithFallback(file: File, maxBytes = DEFAULT_MAX_VIDEO_BYTES): Promise<string> {
  try {
    return await uploadVideoFile(file, maxBytes);
  } catch (err) {
    if (import.meta.env?.DEV) {
      if (file.size <= 8 * 1024 * 1024) {
        return await readVideoAsDataUrl(file);
      }
      return URL.createObjectURL(file);
    }
    throw err;
  }
}

export const MAX_VIDEO_BYTES = DEFAULT_MAX_VIDEO_BYTES;
export const MAX_VIDEO_SECONDS = DEFAULT_MAX_VIDEO_SECONDS;
