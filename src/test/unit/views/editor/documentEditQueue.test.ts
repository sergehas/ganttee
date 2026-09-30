import { DocumentEditQueue } from "@views/editor/documentEditQueue";
import * as assert from "assert";

suite("DocumentEditQueue", () => {
  test("serializes operations sharing a document key", async () => {
    const queue = new DocumentEditQueue();
    let releaseFirst = (): void => undefined;
    const first = queue.run(
      "file:///project.ganttee",
      () =>
        new Promise<void>((resolve) => {
          releaseFirst = resolve;
        }),
    );
    let secondStarted = false;
    const second = queue.run("file:///project.ganttee", async () => {
      secondStarted = true;
    });

    await Promise.resolve();
    assert.strictEqual(secondStarted, false);
    releaseFirst();
    await Promise.all([first, second]);
    assert.strictEqual(secondStarted, true);
  });

  test("rejects a queued proposal after an earlier edit advances the revision", async () => {
    const queue = new DocumentEditQueue();
    let revision = 0;
    let releaseFirst = (): void => undefined;
    let secondApplied = false;
    let staleCount = 0;
    const first = queue.runRevisioned(
      "file:///project.ganttee",
      0,
      () => revision,
      () =>
        new Promise<boolean>((resolve) => {
          releaseFirst = () => {
            revision += 1;
            resolve(true);
          };
        }),
      () => {
        staleCount += 1;
      },
    );
    const second = queue.runRevisioned(
      "file:///project.ganttee",
      0,
      () => revision,
      async () => {
        secondApplied = true;
        return true;
      },
      () => {
        staleCount += 1;
      },
    );

    await Promise.resolve();
    releaseFirst();

    assert.strictEqual(await first, true);
    assert.strictEqual(await second, false);
    assert.strictEqual(secondApplied, false);
    assert.strictEqual(staleCount, 1);
  });

  test("runs operations for different documents independently", async () => {
    const queue = new DocumentEditQueue();
    let releaseFirst = (): void => undefined;
    const first = queue.run(
      "file:///first.ganttee",
      () =>
        new Promise<void>((resolve) => {
          releaseFirst = resolve;
        }),
    );
    const second = queue.run("file:///second.ganttee", async () => "complete");

    assert.strictEqual(await second, "complete");
    releaseFirst();
    await first;
  });

  test("continues processing after a queued operation rejects", async () => {
    const queue = new DocumentEditQueue();
    const failed = queue.run("file:///project.ganttee", async () => {
      throw new Error("failed");
    });
    const next = queue.run("file:///project.ganttee", async () => "complete");

    await assert.rejects(failed, /failed/);
    assert.strictEqual(await next, "complete");
  });
});
