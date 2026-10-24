import { describe, expect, it } from "vitest";

import { createAdminClient } from "../api/admin-client.js";
import { UploadFailedError, resolveEditorFileUrl, uploadEditorFile } from "./file-upload.js";
import { tusUpload } from "./tus-upload.js";
import { uploadVideo } from "./video-upload.js";

const FILE_ID = "6f1c2a4e-1b7d-4c3a-9f2e-0a1b2c3d4e5f";

type Call = { url: string; init: RequestInit };

/** One fake for the module's API and the storage or provider URLs. */
function network(routes: Record<string, (init: RequestInit) => Response>) {
  const calls: Call[] = [];
  const fetcher = (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const route = routes[`${init.method ?? "GET"} ${url}`];
    return Promise.resolve(route === undefined ? new Response(null, { status: 404 }) : route(init));
  };
  return { fetcher, calls, admin: createAdminClient("/api", fetcher) };
}

const image = new File(["png-bytes"], "chart.png", { type: "image/png" });

describe("uploadEditorFile", () => {
  it("gets an upload URL, PUTs the bytes and answers the document url", async () => {
    const net = network({
      "POST /api/v1/admin/files/uploads": () =>
        Response.json({
          file: { id: FILE_ID, url: `elearning-file:${FILE_ID}` },
          upload: {
            url: "https://files.example.com/k",
            method: "PUT",
            headers: { "Content-Type": "image/png" },
          },
        }),
      "PUT https://files.example.com/k": () => new Response(null, { status: 200 }),
    });

    const url = await uploadEditorFile(net.admin, net.fetcher, image);

    expect(url).toBe(`elearning-file:${FILE_ID}`);
    expect(JSON.parse(net.calls[0]?.init.body as string)).toEqual({
      mime_type: "image/png",
      size_bytes: 9,
    });
    expect(net.calls[1]?.init).toMatchObject({
      method: "PUT",
      headers: { "Content-Type": "image/png" },
      body: image,
    });
  });

  it("fails when the storage refuses the bytes", async () => {
    const net = network({
      "POST /api/v1/admin/files/uploads": () =>
        Response.json({
          file: { url: "x" },
          upload: { url: "https://files.example.com/k", method: "PUT", headers: {} },
        }),
      "PUT https://files.example.com/k": () => new Response(null, { status: 403 }),
    });

    await expect(uploadEditorFile(net.admin, net.fetcher, image)).rejects.toEqual(
      new UploadFailedError(403),
    );
  });

  it("fails before any upload when the server refuses the type", async () => {
    const net = network({
      "POST /api/v1/admin/files/uploads": () =>
        Response.json(
          { error: { code: "file_type_not_allowed", message: "m", request_id: "r" } },
          { status: 415 },
        ),
    });

    await expect(uploadEditorFile(net.admin, net.fetcher, image)).rejects.toMatchObject({
      code: "file_type_not_allowed",
    });
    expect(net.calls).toHaveLength(1);
  });
});

describe("resolveEditorFileUrl", () => {
  it("signs a module file and leaves any other url alone", async () => {
    const net = network({
      [`GET /api/v1/admin/files/${FILE_ID}`]: () =>
        Response.json({ read_url: "https://files.example.com/k?sig=1" }),
    });

    expect(await resolveEditorFileUrl(net.admin, `elearning-file:${FILE_ID}`)).toBe(
      "https://files.example.com/k?sig=1",
    );
    expect(await resolveEditorFileUrl(net.admin, "https://example.com/a.png")).toBe(
      "https://example.com/a.png",
    );
  });
});

/** A tus endpoint that stores what it receives, optionally failing some PATCHes. */
function tusServer(failures: number[] = []) {
  let stored = 0;
  let patches = 0;
  const net = network({
    "PATCH https://tus.example.com/u": (init) => {
      patches += 1;
      if (failures.includes(patches)) return new Response(null, { status: 500 });
      const headers = new Headers(init.headers);
      if (Number(headers.get("Upload-Offset")) !== stored)
        return new Response(null, { status: 409 });
      stored += init.body instanceof Blob ? init.body.size : 0;
      return new Response(null, { status: 204, headers: { "Upload-Offset": String(stored) } });
    },
    "HEAD https://tus.example.com/u": () =>
      new Response(null, { status: 200, headers: { "Upload-Offset": String(stored) } }),
  });
  return { ...net, stored: () => stored };
}

const noWait = () => Promise.resolve();
const video = new Blob([new Uint8Array(10)]);

describe("tusUpload", () => {
  it("sends the file in chunks with tus headers and reports progress", async () => {
    const server = tusServer();
    const progress: number[] = [];

    await tusUpload("https://tus.example.com/u", video, {
      fetcher: server.fetcher,
      chunkBytes: 4,
      wait: noWait,
      onProgress: (sent) => progress.push(sent),
    });

    expect(server.stored()).toBe(10);
    expect(progress).toEqual([4, 8, 10]);
    expect(new Headers(server.calls[0]?.init.headers).get("Tus-Resumable")).toBe("1.0.0");
    expect(new Headers(server.calls[0]?.init.headers).get("Content-Type")).toBe(
      "application/offset+octet-stream",
    );
  });

  it("resumes from the provider's offset after a failed chunk", async () => {
    const server = tusServer([2]);

    await tusUpload("https://tus.example.com/u", video, {
      fetcher: server.fetcher,
      chunkBytes: 4,
      wait: noWait,
    });

    expect(server.stored()).toBe(10);
    expect(server.calls.some((call) => call.init.method === "HEAD")).toBe(true);
  });

  it("gives up after three failures in a row, waiting longer each time", async () => {
    const server = tusServer([1, 2, 3, 4]);
    const waits: number[] = [];

    const upload = tusUpload("https://tus.example.com/u", video, {
      fetcher: server.fetcher,
      chunkBytes: 4,
      wait: (ms) => {
        waits.push(ms);
        return Promise.resolve();
      },
    });

    await expect(upload).rejects.toBeInstanceOf(UploadFailedError);
    expect(waits).toEqual([2000, 4000, 8000]);
  });

  it("stops at once when aborted", async () => {
    const server = tusServer([1]);
    const controller = new AbortController();
    controller.abort();

    await expect(
      tusUpload("https://tus.example.com/u", video, {
        fetcher: server.fetcher,
        signal: controller.signal,
        wait: noWait,
      }),
    ).rejects.toBeInstanceOf(UploadFailedError);
  });

  it("does nothing for an empty file", async () => {
    const server = tusServer();

    await tusUpload("https://tus.example.com/u", new Blob([]), { fetcher: server.fetcher });

    expect(server.calls).toEqual([]);
  });
});

describe("uploadVideo", () => {
  const clip = new File([new Uint8Array(6)], "clip.mp4", { type: "video/mp4" });

  it("posts a small file as multipart form data", async () => {
    const net = network({
      "POST /api/v1/admin/videos/uploads": () =>
        Response.json({
          upload_url: "https://upload.example.com/v",
          upload_protocol: "form",
          video: {},
        }),
      "POST https://upload.example.com/v": () => new Response(null, { status: 200 }),
    });
    const progress: number[] = [];

    await uploadVideo(clip, {
      admin: net.admin,
      upload: net.fetcher,
      lessonId: "l1",
      onProgress: (r) => progress.push(r),
    });

    expect(JSON.parse(net.calls[0]?.init.body as string)).toEqual({
      lesson_id: "l1",
      size_bytes: 6,
    });
    expect(net.calls[1]?.init.body).toBeInstanceOf(FormData);
    expect((net.calls[1]?.init.body as FormData).get("file")).toBeInstanceOf(File);
    expect(progress).toEqual([1]);
  });

  it("fails when the provider refuses the form upload", async () => {
    const net = network({
      "POST /api/v1/admin/videos/uploads": () =>
        Response.json({
          upload_url: "https://upload.example.com/v",
          upload_protocol: "form",
          video: {},
        }),
      "POST https://upload.example.com/v": () => new Response(null, { status: 413 }),
    });

    await expect(
      uploadVideo(clip, { admin: net.admin, upload: net.fetcher, lessonId: "l1" }),
    ).rejects.toEqual(new UploadFailedError(413));
  });

  it("uses tus when the server answers a resumable upload", async () => {
    const server = tusServer();
    const tus = network({
      "POST /api/v1/admin/videos/uploads": () =>
        Response.json({
          upload_url: "https://tus.example.com/u",
          upload_protocol: "tus",
          video: {},
        }),
    });
    const fetcher = (url: string, init: RequestInit) =>
      url.startsWith("https://tus") ? server.fetcher(url, init) : tus.fetcher(url, init);
    const progress: number[] = [];

    await uploadVideo(clip, {
      admin: tus.admin,
      upload: fetcher,
      lessonId: "l1",
      onProgress: (r) => progress.push(r),
    });

    expect(server.stored()).toBe(6);
    expect(progress.at(-1)).toBe(1);
  });
});
