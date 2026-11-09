import { useEffect, useRef, useState } from "react";
import {
  Camera,
  ImageUp,
  QrCode,
  ArrowRight,
  ShieldCheck,
  LoaderCircle,
} from "lucide-react";
import { SAMPLE_QR } from "./campus";
import { parseQR } from "./session";
import { loadImage, validateImage } from "./uploads";
import { convertHeicToJpegBlob, isHeicFile } from "./heicConverter";
export async function decodeQR(
  source: CanvasImageSource,
  width: number,
  height: number,
) {
  const { default: jsQR } = await import("jsqr");
  const scale = Math.min(1, 960 / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Image reading is unavailable in this browser.");
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return (
    jsQR(image.data, image.width, image.height, {
      inversionAttempts: "attemptBoth",
    })?.data ?? null
  );
}
export default function QRPanel({
  onActivate,
}: {
  onActivate: (entranceId: string) => void;
}) {
  const [error, setError] = useState("");
  const [camera, setCamera] = useState(false);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const active = useRef(true);
  const timer = useRef<number | undefined>(undefined);
  const fileInput = useRef<HTMLInputElement>(null);
  function stop() {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    window.clearTimeout(timer.current);
  }
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      stop();
    };
  }, []);
  function accept(value: string) {
    const entrance = parseQR(value);
    if (!entrance) {
      setError(
        "This code is not a recognised Uniway demo entrance. Try the sample campus below.",
      );
      return false;
    }
    stop();
    onActivate(entrance);
    return true;
  }
  async function startCamera() {
    setError("");
    setBusy(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          "Camera scanning needs HTTPS or localhost and a supported browser. Upload a QR image or try the demo.",
        );
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      if (!active.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = media;
      setCamera(true);
      setBusy(false);
    } catch (e) {
      if (active.current) {
        const denied =
          typeof e === "object" &&
          e !== null &&
          "name" in e &&
          e.name === "NotAllowedError";
        setError(
          denied
            ? "Camera access was declined. You can upload a QR image or use the demo code."
            : e instanceof Error
              ? e.message
              : "The camera could not be opened. Try a QR image instead.",
        );
        setBusy(false);
      }
    }
  }
  useEffect(() => {
    if (!camera || !video.current || !stream.current) return;
    const v = video.current;
    v.srcObject = stream.current;
    let cancelled = false;
    async function scan() {
      if (cancelled || !active.current || !stream.current) return;
      try {
        if (v.readyState >= 2 && v.videoWidth) {
          const result = await decodeQR(v, v.videoWidth, v.videoHeight);
          if (cancelled || !active.current) return;
          if (result && accept(result)) return;
        }
      } catch {
        if (!cancelled && active.current) {
          setError(
            "Camera scanning could not continue. Try uploading a QR image.",
          );
          stop();
          setCamera(false);
          return;
        }
      }
      if (!cancelled) timer.current = window.setTimeout(() => void scan(), 500);
    }
    void v
      .play()
      .then(() => scan())
      .catch(() => {
        if (active.current && !cancelled) {
          setError("Could not play the camera feed. Try uploading a QR image.");
          stop();
          setCamera(false);
        }
      });
    return () => {
      cancelled = true;
      window.clearTimeout(timer.current);
    };
  }, [camera]);
  async function readFile(file: File | undefined) {
    if (!file) return;
    setError("");
    const invalid = validateImage(file);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    let blob: Blob = file;
    if (isHeicFile(file)) {
      try {
        blob = await convertHeicToJpegBlob(file);
      } catch (err) {
        if (active.current) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to convert HEIC image.",
          );
          setBusy(false);
          if (fileInput.current) fileInput.current.value = "";
        }
        return;
      }
    }
    const url = URL.createObjectURL(blob);
    try {
      const image = await loadImage(url);
      const result = await decodeQR(
        image,
        image.naturalWidth,
        image.naturalHeight,
      );
      if (active.current) {
        if (result) accept(result);
        else
          setError(
            "No QR code was found. Use a clear, uncropped image of the code.",
          );
      }
    } catch (e) {
      if (active.current)
        setError(
          e instanceof Error ? e.message : "This image could not be scanned.",
        );
    } finally {
      URL.revokeObjectURL(url);
      if (active.current) {
        setBusy(false);
        if (fileInput.current) fileInput.current.value = "";
      }
    }
  }
  return (
    <div className="qr-panel">
      <p className="modal-description">
        A new campus? You’re in. Scan a Uniway entrance code to get your
        bearings.
      </p>
      <div className={`scanner ${camera ? "camera-active" : ""}`}>
        {camera ? (
          <video ref={video} muted playsInline aria-label="Camera QR scanner" />
        ) : (
          <>
            <div className="scan-frame">
              <QrCode size={82} strokeWidth={1.1} />
              <i />
              <i />
              <i />
              <i />
            </div>
            <p>Point your camera at an entrance QR code</p>
          </>
        )}
        {camera && <div className="camera-reticle" aria-hidden="true" />}
      </div>
      <div className="scan-actions">
        <button
          className="primary-button"
          disabled={busy}
          onClick={() => {
            if (camera) {
              stop();
              setCamera(false);
            } else void startCamera();
          }}
        >
          {busy ? (
            <LoaderCircle className="spin" size={18} />
          ) : (
            <Camera size={18} />
          )}{" "}
          {camera ? "Stop camera" : "Open camera"}
        </button>
        <button
          className="secondary-button"
          disabled={busy}
          onClick={() => fileInput.current?.click()}
        >
          <ImageUp size={18} /> Upload QR image
        </button>
      </div>
      <input
        ref={fileInput}
        type="file"
        className="sr-only"
        accept=".heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif"
        aria-label="Choose QR image"
        onChange={(e) => void readFile(e.target.files?.[0])}
      />
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      <details className="manual-code">
        <summary>Have an entrance code?</summary>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            accept(code);
          }}
        >
          <input
            aria-label="Uniway entrance code"
            placeholder="uniway://willowbrook/south-gate"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button className="icon-button" aria-label="Open entrance code">
            <ArrowRight size={20} />
          </button>
        </form>
      </details>
      <button className="demo-entry" onClick={() => accept(SAMPLE_QR)}>
        <span className="demo-entry-icon">
          <QrCode size={22} />
        </span>
        <span>
          <strong>Just looking around?</strong>
          <small>Try Willowbrook’s South Gate demo</small>
        </span>
        <ArrowRight size={19} />
      </button>
      <div className="privacy-line">
        <ShieldCheck size={17} />
        <span>
          Your visitor session lasts 3 hours. Scanning again during an active
          session keeps its original expiry.
        </span>
      </div>
    </div>
  );
}
