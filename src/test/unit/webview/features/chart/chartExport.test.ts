import {
  ChartExportBlob,
  ChartExportBrowser,
  ChartExportCanvas,
  createImageBlob,
  createPngBlobFromSvg,
  decodeDataUrl,
  defaultBrowser,
  exportChartImage,
} from "@webview/features/chart/chartExport";
import * as assert from "assert";

suite("chartExport", () => {
  test("requests two-times pixel density for PNG exports", async () => {
    let receivedPixelRatio: number | undefined;
    const chart = {
      getDataURL: (options: { type: "svg" | "png"; pixelRatio?: number }) => {
        receivedPixelRatio = options.pixelRatio;
        return "data:image/png;base64,AA==";
      },
    };

    await exportChartImage(
      chart,
      "png",
      "download",
      { svg: "a.svg", png: "a.png" },
      createBrowser(createLink()),
    );

    assert.strictEqual(receivedPixelRatio, 2);
  });

  test("downloads the requested chart format and removes the temporary link", async () => {
    const link = createLink();
    const browser = createBrowser(link);
    const chart = {
      getDataURL: (options: { type: "svg" | "png"; pixelRatio?: number }) => `data:${options.type}`,
    };

    await exportChartImage(
      chart,
      "svg",
      "download",
      {
        svg: "schedule.svg",
        png: "schedule.png",
      },
      browser,
    );

    assert.strictEqual(link.href, "data:svg");
    assert.strictEqual(link.download, "schedule.svg");
    assert.strictEqual(link.clicked, true);
    assert.strictEqual(link.removed, true);
  });

  test("copies the requested format with its image MIME type", async () => {
    const clipboardItems: ChartExportBlob[] = [];
    const blobs: ChartExportBlob[] = [];
    const clipboardMimeTypes: string[] = [];
    const browser = createBrowser(createLink(), {
      clipboardItems,
      blobs,
      clipboardMimeTypes,
    });
    const chart = {
      getDataURL: (options: { type: "svg" | "png"; pixelRatio?: number }) =>
        options.type === "png" ? "data:image/png;base64,AA==" : "data:image/svg+xml,%3Csvg%3E",
    };

    await exportChartImage(
      chart,
      "png",
      "clipboard",
      {
        svg: "schedule.svg",
        png: "schedule.png",
      },
      browser,
    );

    assert.strictEqual(clipboardItems.length, 1);
    assert.strictEqual(blobs.length, 1);
    assert.deepStrictEqual(clipboardMimeTypes, ["image/png"]);
  });

  test("copies SVG markup as text", async () => {
    const copiedText: string[] = [];
    const browser = createBrowser(createLink(), { copiedText });
    const chart = { getDataURL: () => "data:image/svg+xml,%3Csvg%3E%3C%2Fsvg%3E" };

    await exportChartImage(
      chart,
      "svg",
      "clipboard",
      {
        svg: "schedule.svg",
        png: "schedule.png",
      },
      browser,
    );

    assert.deepStrictEqual(copiedText, ["<svg></svg>"]);
  });

  test("decodes percent-encoded and base64 data URLs", () => {
    const browser = createBrowser(createLink());

    assert.strictEqual(
      decodeDataUrl(browser, "data:image/svg+xml,%3Csvg%3E%3C%2Fsvg%3E", "svg"),
      "<svg></svg>",
    );
    assert.strictEqual(decodeDataUrl(browser, "data:image/svg+xml;base64,encoded", "svg"), "\0");
  });

  test("rejects malformed data URLs", () => {
    const browser = createBrowser(createLink());

    assert.throws(
      () => decodeDataUrl(browser, "data:image/svg+xml", "svg"),
      /Invalid svg data URL\./,
    );
  });

  test("creates image blobs from base64 and encoded payloads", () => {
    const parts: (string | Uint8Array)[][] = [];
    const types: string[] = [];
    const createBlob = (blobParts: readonly (string | Uint8Array)[], options: { type: string }) => {
      parts.push([...blobParts]);
      types.push(options.type);
      return { __chartExportBlob: true as const };
    };
    const atob = () => "png-bytes";

    createImageBlob(atob, createBlob, "data:image/png;base64,encoded", "png", "image/png");
    createImageBlob(atob, createBlob, "data:image/png,%01", "png", "image/png");

    assert.strictEqual(parts.length, 2);
    assert.deepStrictEqual(parts[0], [
      Uint8Array.from([112, 110, 103, 45, 98, 121, 116, 101, 115]),
    ]);
    assert.deepStrictEqual(parts[1], ["\x01"]);
    assert.deepStrictEqual(types, ["image/png", "image/png"]);
  });

  test("creates the default browser adapters", () => {
    const browser = defaultBrowser();

    assert.deepStrictEqual(Object.keys(browser).sort(), [
      "artifacts",
      "clipboard",
      "download",
      "rasterizer",
    ]);
  });

  test("rasterizes an SVG image into a PNG blob", async () => {
    const canvas: ChartExportCanvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage: () => undefined }),
      toBlob: (callback) => callback({ __chartExportBlob: true }),
    };
    const runtime = {
      document: { createElement: () => canvas },
      Image: class {
        width = 100;
        height = 50;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(value: string) {
          void value;
          this.onload?.();
        }
      },
    };

    await createPngBlobFromSvg(runtime, "data:image/svg+xml,%3Csvg%3E", 2);

    assert.strictEqual(canvas.width, 200);
    assert.strictEqual(canvas.height, 100);
  });

  test("rasterizes SVG renderer output before PNG clipboard copy", async () => {
    const rasterizedDataUrls: string[] = [];
    const rasterizedPixelRatios: number[] = [];
    const browser = createBrowser(createLink(), { rasterizedDataUrls, rasterizedPixelRatios });
    const chart = { getDataURL: () => "data:image/svg+xml,%3Csvg%3E%3C%2Fsvg%3E" };

    await exportChartImage(
      chart,
      "png",
      "clipboard",
      { svg: "schedule.svg", png: "schedule.png" },
      browser,
    );

    assert.deepStrictEqual(rasterizedDataUrls, ["data:image/svg+xml,%3Csvg%3E%3C%2Fsvg%3E"]);
    assert.deepStrictEqual(rasterizedPixelRatios, [2]);
  });

  test("rasterizes SVG renderer output before PNG download", async () => {
    const rasterizedDataUrls: string[] = [];
    const rasterizedPixelRatios: number[] = [];
    const revokedObjectUrls: string[] = [];
    const browser = createBrowser(createLink(), {
      rasterizedDataUrls,
      rasterizedPixelRatios,
      revokedObjectUrls,
    });
    const chart = { getDataURL: () => "data:image/svg+xml,%3Csvg%3E%3C%2Fsvg%3E" };

    await exportChartImage(
      chart,
      "png",
      "download",
      { svg: "schedule.svg", png: "schedule.png" },
      browser,
    );

    assert.deepStrictEqual(rasterizedDataUrls, ["data:image/svg+xml,%3Csvg%3E%3C%2Fsvg%3E"]);
    assert.deepStrictEqual(rasterizedPixelRatios, [2]);
    assert.deepStrictEqual(revokedObjectUrls, ["blob:test-0"]);
  });

  test("revokes the PNG artifact when download fails", async () => {
    const revokedObjectUrls: string[] = [];
    const browser = createBrowser(createLink(), {
      revokedObjectUrls,
      rejectDownload: true,
    });
    const chart = { getDataURL: () => "data:image/svg+xml,%3Csvg%3E%3C%2Fsvg%3E" };

    await assert.rejects(
      exportChartImage(chart, "png", "download", { svg: "a.svg", png: "a.png" }, browser),
      /Download failed\./,
    );
    assert.deepStrictEqual(revokedObjectUrls, ["blob:test-0"]);
  });

  test("propagates a rejected PNG binary clipboard write", async () => {
    const browser = createBrowser(createLink(), { rejectBinaryWrite: true });
    const chart = { getDataURL: () => "data:image/png;base64,AA==" };

    await assert.rejects(
      exportChartImage(
        chart,
        "png",
        "clipboard",
        {
          svg: "schedule.svg",
          png: "schedule.png",
        },
        browser,
      ),
      /Binary clipboard writes are unavailable\./,
    );
  });
});

interface TestLink {
  href: string;
  download: string;
  clicked: boolean;
  removed: boolean;
  click: () => void;
  remove: () => void;
}

/** Named dependencies used by the chart export browser test double. */
interface ChartExportTestOptions {
  /** Captured binary clipboard items. */
  clipboardItems?: ChartExportBlob[];
  /** Captured generated blobs. */
  blobs?: ChartExportBlob[];
  /** Captured text clipboard values. */
  copiedText?: string[];
  /** Forces binary clipboard failure. */
  rejectBinaryWrite?: boolean;
  /** Captured clipboard MIME keys. */
  clipboardMimeTypes?: string[];
  /** Captured SVG rasterization inputs. */
  rasterizedDataUrls?: string[];
  /** Captured rasterization pixel ratios. */
  rasterizedPixelRatios?: number[];
  /** Captured object URL revocations. */
  revokedObjectUrls?: string[];
  /** Forces the download adapter to fail. */
  rejectDownload?: boolean;
}

/** Creates a link spy for the browser export seam. */
function createLink(): TestLink {
  const link = {
    href: "",
    download: "",
    clicked: false,
    removed: false,
    click: () => {
      link.clicked = true;
    },
    remove: () => {
      link.removed = true;
    },
  };
  return link;
}

/** Creates a browser seam with injectable clipboard spies. */
function createBrowser(link: TestLink, options: ChartExportTestOptions = {}): ChartExportBrowser {
  const clipboardItems = options.clipboardItems ?? [];
  const blobs = options.blobs ?? [];
  const copiedText = options.copiedText ?? [];
  const clipboardMimeTypes = options.clipboardMimeTypes ?? [];
  const rasterizedDataUrls = options.rasterizedDataUrls ?? [];
  const rasterizedPixelRatios = options.rasterizedPixelRatios ?? [];
  const revokedObjectUrls = options.revokedObjectUrls ?? [];
  const objectUrls: string[] = [];

  return {
    download: {
      download: (dataUrl, filename) => {
        if (options.rejectDownload) {
          throw new Error("Download failed.");
        }
        link.href = dataUrl;
        link.download = filename;
        link.click();
        link.remove();
      },
    },
    clipboard: {
      decodeBase64: () => "\0",
      createImageBlob: (_dataUrl, _format, _mimeType) => {
        const blob = { __chartExportBlob: true as const };
        blobs.push(blob);
        return blob;
      },
      writeImage: async (item, mimeType) => {
        if (options.rejectBinaryWrite) {
          throw new Error("Binary clipboard writes are unavailable.");
        }
        clipboardItems.push(item);
        clipboardMimeTypes.push(mimeType);
      },
      writeText: async (text) => {
        copiedText.push(text);
      },
    },
    rasterizer: {
      fromSvg: async (dataUrl, pixelRatio) => {
        rasterizedDataUrls.push(dataUrl);
        rasterizedPixelRatios.push(pixelRatio);
        const blob = { __chartExportBlob: true as const };
        blobs.push(blob);
        return blob;
      },
    },
    artifacts: {
      create: () => {
        const objectUrl = `blob:test-${objectUrls.length}`;
        objectUrls.push(objectUrl);
        return {
          url: objectUrl,
          revoke: () => {
            revokedObjectUrls.push(objectUrl);
          },
        };
      },
    },
  };
}
