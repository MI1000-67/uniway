import { useEffect, useRef, useState } from "react";
import {
  UploadCloud,
  ImagePlus,
  Trash2,
  ArrowRight,
  Check,
  Info,
  ZoomIn,
  Minus,
  Plus,
} from "lucide-react";
import { loadImage, validateImage } from "./uploads";
import { convertHeicToJpegBlob, isHeicFile } from "./heicConverter";
import type { PreparedMap } from "./preparedMap";
import MapPreparation from "./MapPreparation";
import { formatMapExpiration, mapExpiresAt, mapRemainingTime } from "./session";

export type UploadedImage = {
  id: string;
  name: string;
  url: string;
  width: number;
  height: number;
  uploadedAt?: number;
  expiresAt?: number;
};
export default function UploadPanel({
  images,
  onAdd,
  onRemove,
  onPrepare,
  onOpen,
  onAnalyzed,
  onPreview,
  preparedMaps = {},
}: {
  images: UploadedImage[];
  onAdd: (images: UploadedImage[]) => void;
  onRemove: (id: string) => void;
  onPrepare?: (image: UploadedImage) => void;
  onOpen?: (id: string) => void;
  onAnalyzed?: (map: PreparedMap) => void;
  onPreview?: (image: UploadedImage) => void;
  preparedMaps?: Record<string, PreparedMap>;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const alive = useRef(true);
  const input = useRef<HTMLInputElement>(null);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const active = images.find((i) => i.id === selected) ?? images[0];
  async function addFiles(files: FileList | null) {
    if (!files || busy) return;
    setBusy(true);
    setError("");
    const valid: UploadedImage[] = [];
    const errors: string[] = [];
    for (const file of Array.from(files)) {
      const invalid = validateImage(file);
      if (invalid) {
        errors.push(`${file.name}: ${invalid}`);
        continue;
      }
      let sourceBlob: Blob = file;
      if (isHeicFile(file)) {
        try {
          sourceBlob = await convertHeicToJpegBlob(file);
        } catch (err) {
          errors.push(
            `${file.name}: ${err instanceof Error ? err.message : "This image could not be read."}`,
          );
          continue;
        }
      }
      const url = URL.createObjectURL(sourceBlob);
      try {
        const image = await loadImage(url);
        const now = Date.now();
        valid.push({
          id: crypto.randomUUID(),
          name: file.name,
          url,
          width: image.naturalWidth,
          height: image.naturalHeight,
          uploadedAt: now,
          expiresAt: mapExpiresAt(now),
        });
      } catch {
        URL.revokeObjectURL(url);
        errors.push(`${file.name}: This image could not be read.`);
      }
    }
    if (!alive.current) {
      valid.forEach((i) => URL.revokeObjectURL(i.url));
      return;
    }
    onAdd(valid);
    if (valid.length) {
      setSelected(valid[0].id);
      setZoom(1);
    }
    setError(errors.join(" "));
    setBusy(false);
    if (input.current) input.current.value = "";
  }
  return (
    <div className="upload-panel">
      <p className="modal-description">
        Every journey starts with a map. Bring your campus layout along.
      </p>
      <input
        ref={input}
        className="sr-only"
        type="file"
        accept=".heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif"
        multiple
        aria-label="Choose campus map images"
        onChange={(e) => void addFiles(e.target.files)}
      />
      <button
        className={`dropzone ${dragOver ? "drag-over" : ""}`}
        disabled={busy}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void addFiles(e.dataTransfer.files);
        }}
      >
        <span className="upload-symbol">
          <UploadCloud size={28} />
        </span>
        <strong>
          {busy ? "Opening your images…" : "Drop your campus maps here"}
        </strong>
        <span>
          or <u>browse files</u> on your device
        </span>
        <small>JPG, PNG, WebP, or HEIC · Up to 15 MB each</small>
      </button>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      {!!images.length && (
        <>
          <div className="section-heading">
            <span>YOUR MAPS</span>
            <span>
              {images.length} {images.length === 1 ? "image" : "images"}
            </span>
          </div>
          <div className="upload-thumbnails">
            {images.map((image) => (
              <div
                key={image.id}
                className={`uploaded-image ${active?.id === image.id ? "active" : ""}`}
              >
                <button
                  className="thumbnail-select"
                  onClick={() => {
                    setSelected(image.id);
                    setZoom(1);
                  }}
                  aria-label={`Preview ${image.name}`}
                >
                  <img src={image.url} alt={image.name} />
                  <span>{image.name}</span>
                  {image.expiresAt && (
                    <span
                      className="thumbnail-expiry"
                      title="Uploaded maps expire after 3 hours for privacy and storage hygiene"
                    >
                      ⏳{" "}
                      {formatMapExpiration(
                        mapRemainingTime(image.expiresAt, currentTime),
                      )}
                    </span>
                  )}
                </button>
                <button
                  className="thumbnail-remove"
                  aria-label={`Remove ${image.name}`}
                  onClick={() => onRemove(image.id)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
          {active && (
            <>
              <div className="image-preview">
                <div className="image-preview-bar">
                  <span>
                    <ZoomIn size={15} />
                    {active.width} × {active.height}
                  </span>
                  <span>
                    <button
                      className="icon-button"
                      aria-label="Zoom out image"
                      onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                    >
                      <Minus size={16} />
                    </button>
                    {Math.round(zoom * 100)}%
                    <button
                      className="icon-button"
                      aria-label="Zoom in image"
                      onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                    >
                      <Plus size={16} />
                    </button>
                  </span>
                </div>
                <div className="image-viewer">
                  <img
                    src={active.url}
                    alt={`Uploaded campus layout: ${active.name}`}
                    style={{ width: `${zoom * 100}%`, maxWidth: "none" }}
                  />
                </div>
              </div>
              <MapPreparation
                key={active.id}
                image={active}
                draft={preparedMaps[active.id]}
                onAnalyzed={(map) => onAnalyzed?.(map)}
                onManual={() => onPrepare?.(active)}
                onPreview={() => onPreview?.(active)}
              />
              {preparedMaps[active.id]?.published && (
                <button
                  className="secondary-button"
                  onClick={() => onOpen?.(active.id)}
                >
                  Open reviewed map
                </button>
              )}
            </>
          )}
        </>
      )}
      <div className="preparation-note">
        <Info size={19} />
        <div>
          <strong>Your layout. Your interactive campus.</strong>
          <p>
            Uniway reads labels and suggests visible paths locally. Review the
            draft, correct uncertain details, and explore your campus. Images
            and prepared maps stay in this open tab.
          </p>
        </div>
      </div>
      <div className="preparation-steps">
        <span className="current">
          <ImagePlus size={16} /> Upload
        </span>
        <ArrowRight size={14} />
        <span>Prepare & review</span>
        <ArrowRight size={14} />
        <span>
          <Check size={15} /> Navigate
        </span>
      </div>
    </div>
  );
}
