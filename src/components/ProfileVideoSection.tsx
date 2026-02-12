import { useEffect, useRef, useState } from "react";
import type { VideoApprovalStatus } from "../lib/data";
import {
  MAX_VIDEO_BYTES,
  MAX_VIDEO_SECONDS,
  getVideoDurationSeconds,
  uploadVideoWithFallback,
} from "../lib/uploads";

type IntroVideoPatch = {
  introVideoUrl?: string;
  introVideoStatus?: VideoApprovalStatus;
  introVideoSubmittedAt?: string;
  introVideoDurationSec?: number;
  introVideoSizeBytes?: number;
  introVideoMime?: string;
};

type ProfileVideoSectionProps = {
  introVideoUrl: string;
  introVideoStatus?: VideoApprovalStatus;
  introVideoSubmittedAt?: string;
  introVideoDurationSec?: number;
  introVideoSizeBytes?: number;
  introVideoMime?: string;
  onUpdate: (patch: IntroVideoPatch) => void;
  readOnly?: boolean;
};

const formatBytes = (value?: number) => {
  if (!value || value <= 0) return "-";
  const mb = value / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  const kb = value / 1024;
  return `${kb.toFixed(0)} KB`;
};

const formatDuration = (value?: number) => {
  if (!value || value <= 0) return "-";
  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value % 60);
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
};

const maxDurationLabel = `${MAX_VIDEO_SECONDS}s`;
const maxSizeLabel = `${Math.round(MAX_VIDEO_BYTES / (1024 * 1024))}MB`;

const ProfileVideoSection: React.FC<ProfileVideoSectionProps> = ({
  introVideoUrl,
  introVideoStatus,
  introVideoSubmittedAt,
  introVideoDurationSec,
  introVideoSizeBytes,
  introVideoMime,
  onUpdate,
  readOnly,
}) => {
  const pending = introVideoStatus === "PENDING";
  const approved = introVideoStatus === "APPROVED";
  const rejected = introVideoStatus === "REJECTED";

  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [recordedUrl]);

  const stopRecording = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (liveVideoRef.current) {
      liveVideoRef.current.srcObject = null;
    }
    setRecording(false);
  };

  const startRecording = async () => {
    if (readOnly || pending) return;
    setError(null);
    setRecordedBlob(null);
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
      setRecordedUrl(null);
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Recording is not supported on this device.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      streamRef.current = stream;
      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream;
        liveVideoRef.current.muted = true;
        await liveVideoRef.current.play().catch(() => undefined);
      }
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "video/webm",
        });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setRecordedUrl(url);
      };
      recorder.start();
      setRecording(true);
      setRecordingSeconds(0);
      const startedAt = Date.now();
      timerRef.current = window.setInterval(() => {
        const seconds = Math.floor((Date.now() - startedAt) / 1000);
        setRecordingSeconds(seconds);
        if (seconds >= MAX_VIDEO_SECONDS) {
          stopRecording();
        }
      }, 250);
    } catch (err: any) {
      setError(err?.message || "Unable to access camera/microphone.");
    }
  };

  const handleVideoFile = async (file: File | null) => {
    if (!file || readOnly || pending) return;
    setError(null);
    try {
      const duration = await getVideoDurationSeconds(file);
      if (duration > MAX_VIDEO_SECONDS) {
        throw new Error(`Video is too long. Max length is ${maxDurationLabel}.`);
      }
      setUploading(true);
      const url = await uploadVideoWithFallback(file, MAX_VIDEO_BYTES);
      onUpdate({
        introVideoUrl: url,
        introVideoStatus: "PENDING",
        introVideoSubmittedAt: new Date().toISOString(),
        introVideoDurationSec: Math.round(duration || 0),
        introVideoSizeBytes: file.size,
        introVideoMime: file.type || undefined,
      });
    } catch (err: any) {
      setError(err?.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const handleUseRecording = async () => {
    if (!recordedBlob) return;
    const file = new File([recordedBlob], `intro_${Date.now()}.webm`, {
      type: recordedBlob.type || "video/webm",
    });
    await handleVideoFile(file);
  };

  const handleClearPending = () => {
    if (readOnly) return;
    onUpdate({
      introVideoUrl: "",
      introVideoStatus: undefined,
      introVideoSubmittedAt: undefined,
      introVideoDurationSec: undefined,
      introVideoSizeBytes: undefined,
      introVideoMime: undefined,
    });
    setRecordedBlob(null);
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
      setRecordedUrl(null);
    }
  };

  const canUpload = !readOnly && !pending && !uploading;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-100">Intro video</div>
          <div className="text-xs text-slate-400">
            {`Max ${maxDurationLabel} · ${maxSizeLabel}. New uploads stay hidden until approved.`}
          </div>
        </div>
        {introVideoStatus && (
          <span className="inline-flex items-center rounded-full border border-slate-700/80 bg-slate-900 px-2 py-0.5 text-[10px] text-slate-200">
            {introVideoStatus}
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          {error}
        </div>
      )}

      {introVideoUrl ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 space-y-2">
          <div className="text-xs text-slate-400">
            {approved ? "Approved video" : pending ? "Pending video" : "Video preview"}
          </div>
          <video
            src={introVideoUrl}
            controls
            preload="metadata"
            className="w-full max-h-[240px] rounded-lg border border-slate-800 bg-black"
          />
          <div className="grid gap-2 text-[11px] text-slate-400 sm:grid-cols-3">
            <div>Length: {formatDuration(introVideoDurationSec)}</div>
            <div>Size: {formatBytes(introVideoSizeBytes)}</div>
            <div>Type: {introVideoMime || "video"}</div>
          </div>
          {introVideoSubmittedAt && (
            <div className="text-[11px] text-slate-500">
              Submitted: {new Date(introVideoSubmittedAt).toLocaleString()}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/30 p-4 text-xs text-slate-400">
          No intro video uploaded yet.
        </div>
      )}

      {pending && !readOnly && (
        <div className="text-xs text-slate-400">
          Pending admin review. You can upload a new video after approval or rejection.
        </div>
      )}

      {rejected && !pending && (
        <div className="text-xs text-slate-400">
          Previous video was rejected. Upload a new one to resubmit.
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-300">Upload a video</div>
          <input
            type="file"
            accept="video/*"
            capture="user"
            disabled={!canUpload}
            onChange={(e) => handleVideoFile(e.target.files?.[0] ?? null)}
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-300 file:mr-3 file:rounded-full file:border-0 file:bg-slate-800 file:px-3 file:py-1 file:text-xs file:text-slate-200 hover:file:bg-slate-700 disabled:opacity-60"
          />
          <div className="text-[11px] text-slate-500">
            Upload a 30-45 second intro. Pending videos are hidden from the wheel.
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-300">Record in app</div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 space-y-2">
            <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-slate-800 bg-black">
              {recording ? (
                <video ref={liveVideoRef} className="w-full h-full object-cover" />
              ) : recordedUrl ? (
                <video src={recordedUrl} controls className="w-full h-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-xs text-slate-500">
                  Preview
                </div>
              )}
              {recording && (
                <div className="absolute top-2 right-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] text-white">
                  Recording {recordingSeconds}s
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {!recording ? (
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={!canUpload}
                  className="px-3 py-1.5 rounded-full text-[11px] font-semibold border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                >
                  Start recording
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="px-3 py-1.5 rounded-full text-[11px] font-semibold border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
                >
                  Stop recording
                </button>
              )}
              {recordedBlob && !recording && (
                <>
                  <button
                    type="button"
                    onClick={handleUseRecording}
                    disabled={!canUpload}
                    className="px-3 py-1.5 rounded-full text-[11px] font-semibold bg-emerald-500/90 text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
                  >
                    Use recording
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRecordedBlob(null);
                      if (recordedUrl) {
                        URL.revokeObjectURL(recordedUrl);
                        setRecordedUrl(null);
                      }
                    }}
                    className="px-3 py-1.5 rounded-full text-[11px] font-semibold border border-slate-700 text-slate-200 hover:bg-slate-800"
                  >
                    Discard
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {pending && !readOnly && (
        <button
          type="button"
          onClick={handleClearPending}
          className="px-3 py-1.5 rounded-full text-[11px] font-semibold border border-slate-700 text-slate-200 hover:bg-slate-800"
        >
          Withdraw pending video
        </button>
      )}
    </div>
  );
};

export default ProfileVideoSection;
