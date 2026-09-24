import {
  ChartExportDestination,
  ChartExportFilenames,
  ChartExportFormat,
} from "@webview/features/chart/chartExport.types";

/** Pixel density used for raster image exports. */
const PNG_EXPORT_PIXEL_RATIO = 2;

/** Minimal ECharts export surface required by the download workflow. */
export interface ChartExportChart {
  /**
   * Generates a data URL for the requested image format.
   * @param options Format and optional raster pixel density.
   * @returns An ECharts data URL.
   */
  getDataURL(options: { type: ChartExportFormat; pixelRatio?: number }): string;
}

/** Minimal browser surface required by the export workflow. */
export interface ChartExportBrowser {
  /** Provides browser download operations. */
  readonly download: ChartExportDownloadAdapter;
  /** Provides clipboard operations. */
  readonly clipboard: ChartExportClipboardAdapter;
  /** Provides SVG-to-PNG conversion. */
  readonly rasterizer: ChartExportRasterizer;
  /** Creates transient export artifacts. */
  readonly artifacts: ChartExportArtifactAdapter;
}

/** Performs browser anchor and object URL download operations. */
export interface ChartExportDownloadAdapter {
  /**
   * Starts a download from a URL.
   * @param dataUrl URL or object URL containing the export.
   * @param filename Suggested local filename.
   * @throws When the browser cannot activate the download link.
   */
  download(dataUrl: string, filename: string): void;
}

/** Performs browser text and binary clipboard operations. */
export interface ChartExportClipboardAdapter {
  /**
   * Decodes base64 text for SVG clipboard output.
   * @param input Base64 payload.
   * @returns Decoded binary string.
   */
  decodeBase64(input: string): string;
  /**
   * Creates an image blob from a data URL.
   * @param dataUrl Image data URL to decode.
   * @param format Format used in validation errors.
   * @param mimeType MIME type assigned to the blob.
   * @returns A binary image blob.
   * @throws When the data URL is malformed.
   */
  createImageBlob(dataUrl: string, format: ChartExportFormat, mimeType: string): ChartExportBlob;
  /**
   * Writes text to the clipboard.
   * @param text Text payload to copy.
   * @returns A promise that settles after writing.
   * @throws When clipboard access fails.
   */
  writeText(text: string): Promise<void>;
  /**
   * Writes an image payload to the clipboard.
   * @param blob Binary image payload.
   * @param mimeType MIME type of the payload.
   * @returns A promise that settles after writing.
   * @throws When clipboard access or image decoding fails.
   */
  writeImage(blob: ChartExportBlob, mimeType: string): Promise<void>;
}

/** Converts SVG data URLs into PNG blobs. */
export interface ChartExportRasterizer {
  /**
   * Converts SVG data to a high-resolution PNG blob.
   * @param dataUrl SVG data URL to rasterize.
   * @param pixelRatio Output scale applied to canvas dimensions.
   * @returns A promise containing a PNG blob.
   * @throws When image loading or PNG encoding fails.
   */
  fromSvg(dataUrl: string, pixelRatio: number): Promise<ChartExportBlob>;
}

/** Owns the lifecycle of a transient generated export. */
export interface ChartExportArtifactAdapter {
  /**
   * Creates an artifact backed by a temporary object URL.
   * @param blob Generated binary payload.
   * @returns An artifact with a revocable object URL.
   * @throws When object URL creation fails.
   */
  create(blob: ChartExportBlob): ChartExportArtifact;
}

/** A generated export with an object URL that must be revoked. */
export interface ChartExportArtifact {
  /** URL used by the download anchor. */
  readonly url: string;
  /**
   * Releases the object URL.
   * @returns Nothing.
   */
  readonly revoke: () => void;
}

/** Creates a browser Blob from binary or text parts. */
type ChartExportBlobFactory = (
  parts: readonly (string | Uint8Array)[],
  options: { type: string },
) => ChartExportBlob;

/** Opaque image payload accepted by the browser clipboard API. */
export interface ChartExportBlob {
  /** Marker for the browser blob implementation. */
  readonly __chartExportBlob: true;
}

/** Minimal canvas surface required to rasterize SVG output. */
export interface ChartExportCanvas {
  /** Canvas output width. */
  width: number;
  /** Canvas output height. */
  height: number;
  /**
   * Returns the 2D drawing context.
   * @param contextId Requested context type.
   * @returns A drawing context or null when unavailable.
   */
  getContext: (contextId: "2d") => ChartExportCanvasContext | null;
  /**
   * Encodes the canvas as an image blob.
   * @param callback Receives the generated blob or null on failure.
   * @param type Requested output MIME type.
   * @returns Nothing; completion is reported through the callback.
   */
  toBlob: (callback: (blob: ChartExportBlob | null) => void, type: string) => void;
}

/** Minimal 2D context surface required to draw an SVG image. */
export interface ChartExportCanvasContext {
  /**
   * Draws the loaded SVG image into the canvas.
   * @param image Loaded SVG image.
   * @param x Destination x-coordinate.
   * @param y Destination y-coordinate.
   * @param width Destination width.
   * @param height Destination height.
   * @returns Nothing.
   */
  drawImage: (image: ChartExportImage, x: number, y: number, width: number, height: number) => void;
}

/** Minimal image surface required to load an SVG data URL. */
export interface ChartExportImage {
  /** Loaded image width. */
  width: number;
  /** Loaded image height. */
  height: number;
  /** Invoked after the image loads. */
  onload: (() => void) | null;
  /** Invoked when the image cannot load. */
  onerror: (() => void) | null;
  /** Image source data URL. */
  src: string;
}

/** Opaque clipboard payload accepted by the browser clipboard API. */
export interface ChartClipboardItem {
  /** Marker for the browser clipboard implementation. */
  readonly __chartClipboardItem: true;
}

/**
 * Generates and delivers one image export from an ECharts instance.
 * @param chart ECharts instance capable of generating a data URL.
 * @param format Requested SVG or PNG format.
 * @param destination Download or clipboard destination.
 * @param filenames Localized filenames for downloaded formats.
 * @param browser Optional browser adapter, primarily for deterministic tests.
 * @returns A promise that settles after the destination completes.
 * @throws Propagates chart-generation, conversion, download, or clipboard failures.
 */
export async function exportChartImage(
  chart: ChartExportChart,
  format: ChartExportFormat,
  destination: ChartExportDestination,
  filenames: ChartExportFilenames,
  browser: ChartExportBrowser = defaultBrowser(),
): Promise<void> {
  const dataUrl = chart.getDataURL({
    type: format,
    ...(format === "png" ? { pixelRatio: PNG_EXPORT_PIXEL_RATIO } : {}),
  });
  if (destination === "download") {
    await downloadChartData(browser, dataUrl, format, filenames[format]);
    return;
  }
  await copyDataUrl(browser, dataUrl, format);
}

/**
 * Delivers one generated image through the download adapter.
 * @param browser Browser adapters used by the operation.
 * @param dataUrl ECharts-generated image data URL.
 * @param format Requested export format.
 * @param filename Localized download filename.
 * @returns A promise that settles after rasterization and download setup.
 * @throws Propagates rasterization or download failures.
 */
async function downloadChartData(
  browser: ChartExportBrowser,
  dataUrl: string,
  format: ChartExportFormat,
  filename: string,
): Promise<void> {
  if (format === "png" && isSvgDataUrl(dataUrl)) {
    const blob = await browser.rasterizer.fromSvg(dataUrl, PNG_EXPORT_PIXEL_RATIO);
    const artifact = browser.artifacts.create(blob);
    try {
      browser.download.download(artifact.url, filename);
    } finally {
      artifact.revoke();
    }
    return;
  }
  browser.download.download(dataUrl, filename);
}

/**
 * Delivers one generated image through the clipboard adapter.
 * @param browser Browser adapters used by the operation.
 * @param dataUrl ECharts-generated image data URL.
 * @param format Requested export format.
 * @returns A promise that settles after clipboard delivery.
 * @throws Propagates data decoding or clipboard failures.
 */
async function copyDataUrl(
  browser: ChartExportBrowser,
  dataUrl: string,
  format: ChartExportFormat,
): Promise<void> {
  if (format === "svg") {
    await browser.clipboard.writeText(decodeDataUrl(browser, dataUrl, format));
    return;
  }
  const mimeType = "image/png";
  const blob = isSvgDataUrl(dataUrl)
    ? await browser.rasterizer.fromSvg(dataUrl, PNG_EXPORT_PIXEL_RATIO)
    : browser.clipboard.createImageBlob(dataUrl, format, mimeType);
  await browser.clipboard.writeImage(blob, mimeType);
}

/**
 * Returns whether an export data URL contains SVG rather than PNG bytes.
 * @param dataUrl Data URL returned by ECharts.
 * @returns Whether the media type is SVG.
 */
function isSvgDataUrl(dataUrl: string): boolean {
  return dataUrl.startsWith("data:image/svg+xml");
}

/**
 * Decodes the text payload from a data URL.
 * @param browser Browser clipboard decoder.
 * @param dataUrl Data URL to decode.
 * @param format Expected export format used in errors.
 * @returns Decoded text payload.
 * @throws Error when the data URL has no payload separator or cannot be decoded.
 */
export function decodeDataUrl(
  browser: ChartExportBrowser,
  dataUrl: string,
  format: ChartExportFormat,
): string {
  const separatorIndex = dataUrl.indexOf(",");
  if (separatorIndex < 0) {
    throw new Error(`Invalid ${format} data URL.`);
  }
  const metadata = dataUrl.slice(0, separatorIndex);
  const payload = dataUrl.slice(separatorIndex + 1);
  if (metadata.endsWith(";base64")) {
    return browserBase64ToText(browser, payload);
  }
  return decodeURIComponent(payload);
}

/**
 * Decodes a base64 data URL payload into text for the clipboard.
 * @param browser Browser adapter containing the base64 decoder.
 * @param payload Base64 payload without data-URL metadata.
 * @returns Decoded text.
 * @throws Error when the payload is not valid encoded text.
 */
function browserBase64ToText(browser: ChartExportBrowser, payload: string): string {
  return decodeURIComponent(
    Array.from(
      browser.clipboard.decodeBase64(payload),
      (character) => `%${character.charCodeAt(0).toString(16).padStart(2, "0")}`,
    ).join(""),
  );
}

/**
 * Converts an ECharts data URL into a clipboard blob without using fetch.
 * @param atob Browser base64 decoder.
 * @param createBlob Browser Blob factory.
 * @param dataUrl Data URL containing image bytes or text.
 * @param format Expected export format used in errors.
 * @param mimeType MIME type assigned to the resulting Blob.
 * @returns A Blob suitable for binary clipboard delivery.
 * @throws Error when the data URL is malformed or cannot be decoded.
 */
export function createImageBlob(
  atob: (input: string) => string,
  createBlob: ChartExportBlobFactory,
  dataUrl: string,
  format: ChartExportFormat,
  mimeType: string,
): ChartExportBlob {
  const separatorIndex = dataUrl.indexOf(",");
  if (separatorIndex < 0) {
    throw new Error(`Invalid ${format} data URL.`);
  }
  const metadata = dataUrl.slice(0, separatorIndex);
  const payload = dataUrl.slice(separatorIndex + 1);
  if (metadata.endsWith(";base64")) {
    const binary = atob(payload);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return createBlob([bytes], { type: mimeType });
  }
  return createBlob([decodeURIComponent(payload)], { type: mimeType });
}

/**
 * Returns the browser adapters used by the live webview.
 * @returns Focused adapters backed by browser globals.
 */
export function defaultBrowser(): ChartExportBrowser {
  const runtime = globalThis as unknown as {
    document: {
      createElement(tagName: "a"): {
        href: string;
        download: string;
        click: () => void;
        remove: () => void;
      };
      createElement(tagName: "canvas"): ChartExportCanvas;
    };
    atob: (input: string) => string;
    Blob: new (
      parts: readonly (string | Uint8Array)[],
      options: { type: string },
    ) => ChartExportBlob;
    URL: {
      createObjectURL: (blob: ChartExportBlob) => string;
      revokeObjectURL: (url: string) => void;
    };
    Image: new () => ChartExportImage;
    navigator: {
      clipboard: {
        write: (items: readonly ChartClipboardItem[]) => Promise<void>;
        writeText: (text: string) => Promise<void>;
      };
    };
    ClipboardItem: new (data: Record<string, ChartExportBlob>) => ChartClipboardItem;
  };
  const download: ChartExportDownloadAdapter = {
    download: (dataUrl, filename) => {
      const link = runtime.document.createElement("a");
      link.href = dataUrl;
      link.download = filename;
      link.click();
      link.remove();
    },
  };
  const clipboard: ChartExportClipboardAdapter = {
    decodeBase64: runtime.atob,
    createImageBlob: (dataUrl, format, mimeType) =>
      createImageBlob(
        runtime.atob,
        (parts, options) => new runtime.Blob(parts, options),
        dataUrl,
        format,
        mimeType,
      ),
    writeText: (text) => runtime.navigator.clipboard.writeText(text),
    writeImage: (blob, mimeType) =>
      runtime.navigator.clipboard.write([new runtime.ClipboardItem({ [mimeType]: blob })]),
  };
  return {
    download,
    clipboard,
    rasterizer: {
      fromSvg: (dataUrl, pixelRatio) => createPngBlobFromSvg(runtime, dataUrl, pixelRatio),
    },
    artifacts: {
      create: (blob) => {
        const url = runtime.URL.createObjectURL(blob);
        return { url, revoke: () => runtime.URL.revokeObjectURL(url) };
      },
    },
  };
}

/**
 * Rasterizes an SVG data URL into a PNG blob using browser canvas APIs.
 * @param runtime Browser document and image constructors.
 * @param dataUrl SVG data URL to rasterize.
 * @param pixelRatio Output scale applied to canvas dimensions.
 * @returns A promise containing the generated PNG Blob.
 * @throws Error when image loading, canvas setup, or PNG encoding fails.
 */
export function createPngBlobFromSvg(
  runtime: {
    document: {
      createElement(tagName: "canvas"): ChartExportCanvas;
    };
    Image: new () => ChartExportImage;
  },
  dataUrl: string,
  pixelRatio: number,
): Promise<ChartExportBlob> {
  return new Promise((resolve, reject) => {
    const image = new runtime.Image();
    image.onload = () => {
      const canvas = runtime.document.createElement("canvas");
      canvas.width = image.width * pixelRatio;
      canvas.height = image.height * pixelRatio;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Canvas 2D context is unavailable."));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        reject(new Error("PNG conversion failed."));
      }, "image/png");
    };
    image.onerror = () => reject(new Error("SVG image loading failed."));
    image.src = dataUrl;
  });
}
