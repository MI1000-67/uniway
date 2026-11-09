// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { convertHeicToJpegBlob, isHeicFile } from "./heicConverter";
import { validateImage } from "./uploads";
import UploadPanel from "./UploadPanel";
import QRPanel from "./QRPanel";

const mockHeic2any = vi.fn(async ({ blob }: { blob: Blob }) => {
  return new Blob(["mock-jpeg-data"], { type: "image/jpeg" });
});

vi.mock("heic2any", () => {
  return {
    default: (args: { blob: Blob }) => mockHeic2any(args),
  };
});

describe("HEIC File Detection and Validation", () => {
  it("detects HEIC/HEIF by MIME type", () => {
    expect(isHeicFile({ type: "image/heic", name: "photo" })).toBe(true);
    expect(isHeicFile({ type: "image/heif", name: "photo" })).toBe(true);
    expect(isHeicFile({ type: "image/heic-sequence", name: "photo" })).toBe(
      true,
    );
    expect(isHeicFile({ type: "image/heif-sequence", name: "photo" })).toBe(
      true,
    );
    expect(isHeicFile({ type: "IMAGE/HEIC", name: "photo" })).toBe(true);
  });

  it("detects HEIC/HEIF by file extension when MIME type is empty (Chromium on Windows)", () => {
    expect(isHeicFile({ type: "", name: "55999.heic" })).toBe(true);
    expect(isHeicFile({ type: "", name: "56002.HEIC" })).toBe(true);
    expect(isHeicFile({ type: "", name: "map.heif" })).toBe(true);
    expect(isHeicFile({ type: "", name: "map.HEIF" })).toBe(true);
    expect(isHeicFile({ type: undefined, name: "campus_plan.heic" })).toBe(
      true,
    );
  });

  it("returns false for non-HEIC files and nullish values", () => {
    expect(isHeicFile({ type: "image/png", name: "map.png" })).toBe(false);
    expect(isHeicFile({ type: "image/jpeg", name: "map.jpg" })).toBe(false);
    expect(isHeicFile({ type: "image/webp", name: "map.webp" })).toBe(false);
    expect(isHeicFile({ type: "", name: "map.pdf" })).toBe(false);
    expect(isHeicFile(null)).toBe(false);
    expect(isHeicFile(undefined)).toBe(false);
  });

  it("validates HEIC files within size limits via validateImage", () => {
    // Standard HEIC file
    const validHeic = {
      name: "55999.heic",
      type: "image/heic",
      size: 3 * 1024 * 1024,
    };
    expect(validateImage(validHeic)).toBeNull();

    // Windows empty MIME type with .heic extension
    const winHeic = {
      name: "56002.heic",
      type: "",
      size: 4 * 1024 * 1024,
    };
    expect(validateImage(winHeic)).toBeNull();

    // Zero-byte HEIC
    const emptyHeic = {
      name: "empty.heic",
      type: "image/heic",
      size: 0,
    };
    expect(validateImage(emptyHeic)).toMatch(/empty/i);

    // Over 15MB size limit
    const oversizedHeic = {
      name: "giant_map.heic",
      type: "image/heic",
      size: 16 * 1024 * 1024,
    };
    expect(validateImage(oversizedHeic)).toMatch(/under 15 MB/i);
  });
});

describe("Client-Side In-Browser HEIC Conversion", () => {
  beforeEach(() => {
    mockHeic2any.mockReset();
    mockHeic2any.mockImplementation(async () => {
      return new Blob(["mock-jpeg-data"], { type: "image/jpeg" });
    });
  });

  it("converts a single-frame HEIC Blob into a JPEG Blob", async () => {
    const fakeHeicBlob = new Blob(["test-heic"], { type: "image/heic" });
    const converted = await convertHeicToJpegBlob(fakeHeicBlob);

    expect(converted).toBeInstanceOf(Blob);
    expect(converted.type).toBe("image/jpeg");
    expect(mockHeic2any).toHaveBeenCalledWith({
      blob: fakeHeicBlob,
      toType: "image/jpeg",
      quality: 0.92,
    });
  });

  it("handles multi-frame conversion by selecting the first image frame", async () => {
    const frame1 = new Blob(["frame-1"], { type: "image/jpeg" });
    const frame2 = new Blob(["frame-2"], { type: "image/jpeg" });
    mockHeic2any.mockResolvedValueOnce([frame1, frame2] as unknown as Blob);

    const fakeHeic = new Blob(["multi-frame-heic"], { type: "image/heic" });
    const result = await convertHeicToJpegBlob(fakeHeic);
    expect(result).toBe(frame1);
  });

  it("rejects invalid non-Blob inputs", async () => {
    // @ts-expect-error test runtime validation of invalid input
    await expect(convertHeicToJpegBlob(null)).rejects.toThrow(
      /invalid input: expected a file or blob/i,
    );
  });

  it("handles empty conversion result from library", async () => {
    mockHeic2any.mockResolvedValueOnce(null as unknown as Blob);
    const fakeHeic = new Blob(["empty-return"], { type: "image/heic" });
    await expect(convertHeicToJpegBlob(fakeHeic)).rejects.toThrow(
      /conversion returned no image data/i,
    );
  });

  it("wraps underlying conversion library errors gracefully", async () => {
    mockHeic2any.mockRejectedValueOnce(new Error("Corrupt HEIC stream"));
    const corruptBlob = new Blob(["bad-data"], { type: "image/heic" });
    await expect(convertHeicToJpegBlob(corruptBlob)).rejects.toThrow(
      /HEIC conversion failed: Corrupt HEIC stream/i,
    );
  });
});

describe("UI Upload Handling for HEIC", () => {
  beforeEach(() => {
    mockHeic2any.mockReset();
    mockHeic2any.mockImplementation(async () => {
      return new Blob(["converted-jpeg-data"], { type: "image/jpeg" });
    });

    // Mock URL methods
    global.URL.createObjectURL = vi.fn(
      () => `blob:mock-url-${crypto.randomUUID()}`,
    );
    global.URL.revokeObjectURL = vi.fn();

    // Mock Image loading
    vi.stubGlobal(
      "Image",
      class {
        naturalWidth = 1920;
        naturalHeight = 1080;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_val: string) {
          queueMicrotask(() => this.onload?.());
        }
      },
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders UploadPanel accepting HEIC in file input and dropzone hint", () => {
    render(<UploadPanel images={[]} onAdd={vi.fn()} onRemove={vi.fn()} />);

    const input = screen.getByLabelText("Choose campus map images");
    expect(input.getAttribute("accept")).toContain(".heic");
    expect(input.getAttribute("accept")).toContain(".heif");
    expect(input.getAttribute("accept")).toContain("image/heic");

    expect(screen.getByText(/JPG, PNG, WebP, or HEIC/i)).toBeTruthy();
  });

  it("processes a HEIC map upload, converts it to JPEG Blob, and triggers onAdd", async () => {
    const onAdd = vi.fn();
    render(<UploadPanel images={[]} onAdd={onAdd} onRemove={vi.fn()} />);

    const file = new File(["fake-heic-bytes"], "campus-map.heic", {
      type: "image/heic",
    });

    await act(async () => {
      fireEvent.change(screen.getByLabelText("Choose campus map images"), {
        target: { files: [file] },
      });
    });

    await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(1));
    expect(mockHeic2any).toHaveBeenCalledTimes(1);
    const addedImages = onAdd.mock.calls[0][0];
    expect(addedImages).toHaveLength(1);
    expect(addedImages[0].name).toBe("campus-map.heic");
    expect(addedImages[0].width).toBe(1920);
    expect(addedImages[0].height).toBe(1080);
    expect(addedImages[0].url).toMatch(/^blob:mock-url-/);
  });

  it("displays an error message when HEIC conversion fails during upload", async () => {
    mockHeic2any.mockRejectedValueOnce(new Error("Decoder failure"));

    const onAdd = vi.fn();
    render(<UploadPanel images={[]} onAdd={onAdd} onRemove={vi.fn()} />);

    const file = new File(["bad-heic-bytes"], "corrupt.heic", {
      type: "image/heic",
    });

    await act(async () => {
      fireEvent.change(screen.getByLabelText("Choose campus map images"), {
        target: { files: [file] },
      });
    });

    expect(onAdd).toHaveBeenCalledWith([]);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(/Decoder failure/i);
  });

  it("renders QRPanel file input accepting HEIC and HEIF formats", () => {
    render(<QRPanel onActivate={vi.fn()} />);

    const fileInput = screen.getByLabelText("Choose QR image");
    expect(fileInput.getAttribute("accept")).toContain(".heic");
    expect(fileInput.getAttribute("accept")).toContain(".heif");
    expect(fileInput.getAttribute("accept")).toContain("image/heic");
  });
});
