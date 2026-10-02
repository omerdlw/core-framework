import "../support/dom.ts";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { act, createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { RegistryProvider } from "../../src/core/kernel/index.ts";
import {
  BackgroundProvider,
  useBackgroundActions,
  useBackgroundState,
} from "../../src/modules/background/context.tsx";
import {
  extractYouTubeVideoId,
  isDirectVideoUrl,
  isYouTubeUrl,
  parseYouTubeUrlConfig,
} from "../../src/modules/background/youtube/parse.ts";

import {
  mergeBackgroundState,
  normalizeBackgroundInput,
  resolveVideoClassNames,
  resolveVideoOptions,
  selectPageBackground,
} from "../../src/modules/background/utils.ts";

describe("background actions", () => {
  class FakeVideo {
    ended = false;
    loop = false;
    muted = true;
    paused = true;
    volume = 0;
    pauseCalls = 0;
    playCalls = [] as any[];
    #playResults = [] as any[];

    queuePlayResult(result) {
      this.#playResults.push(result as any);
    }

    play() {
      this.playCalls.push({ muted: this.muted } as any);
      if (this.#playResults.shift() === "not-allowed") {
        const error = new Error("play() blocked");
        error.name = "NotAllowedError";
        return Promise.reject(error);
      }
      this.paused = false;
      return Promise.resolve();
    }

    pause() {
      this.pauseCalls += 1;
      this.paused = true;
    }
  }

  async function mountBackground() {
    const probe = { renders: 0 };
    function Probe() {
      (probe as any).state = useBackgroundState();
      (probe as any).actions = useBackgroundActions();
      probe.renders += 1;
      return null;
    }
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () =>
      root.render(
        h(RegistryProvider, null, h(BackgroundProvider, null, h(Probe))),
      ),
    );
    return {
      probe,
      run: (fn) => act(async () => fn((probe as any).actions)),
      unmount: () => act(async () => root.unmount()),
    };
  }

  async function withVideo() {
    const view = await mountBackground();
    const video = new FakeVideo();
    await view.run((actions) => actions.setVideoElement(video));
    return { ...view, video };
  }

  const settlePromises = () =>
    act(async () => {
      for (let index = 0; index < 5; index += 1) await Promise.resolve();
    });

  describe("background video actions", () => {
    test("setVideoElement exposes the element in state", async () => {
      const { probe, video, unmount } = await withVideo();
      assert.equal((probe as any).state.videoElement, video);
      await unmount();
    });

    test("toggleVideo plays a paused element, muted as configured", async () => {
      const { probe, run, video, unmount } = await withVideo();
      await run((actions) => actions.toggleVideo());
      assert.deepEqual(video.playCalls, [{ muted: true }]);
      assert.equal(video.paused, false);
      assert.equal((probe as any).state.isPlaying, true);
      await unmount();
    });

    test("toggleVideo trusts the element: a playing element is paused", async () => {
      const { probe, run, video, unmount } = await withVideo();
      video.paused = false;
      await run((actions) => actions.toggleVideo());
      assert.equal(video.pauseCalls, 1);
      assert.equal(video.paused, true);
      assert.equal((probe as any).state.isPlaying, false);
      await unmount();
    });

    test("playing unmuted raises a zero volume to 0.8", async () => {
      const { run, video, unmount } = await withVideo();
      await run((actions) => actions.setVideoMuted(false));
      video.volume = 0;
      await run((actions) => actions.toggleVideo());
      assert.deepEqual(video.playCalls, [{ muted: false }]);
      assert.equal(video.volume, 0.8);
      await unmount();
    });

    test("blocked unmuted autoplay retries muted", async () => {
      const { run, video, unmount } = await withVideo();
      await run((actions) => actions.setVideoMuted(false));
      video.queuePlayResult("not-allowed");
      await run((actions) => actions.toggleVideo());
      await settlePromises();
      assert.deepEqual(video.playCalls, [{ muted: false }, { muted: true }]);
      assert.equal(video.muted, true);
      await unmount();
    });

    test("toggleMute unmutes (starting playback state) and mutes again", async () => {
      const { probe, run, video, unmount } = await withVideo();

      await run((actions) => actions.toggleMute());
      assert.equal(video.muted, false);
      assert.equal(
        video.volume,
        0.8,
        "a silent element gets an audible volume",
      );
      assert.equal((probe as any).state.videoOptions.muted, false);
      assert.equal(
        (probe as any).state.isPlaying,
        true,
        "unmuting marks it playing",
      );

      await run((actions) => actions.toggleMute());
      assert.equal(video.muted, true);
      assert.equal((probe as any).state.videoOptions.muted, true);
      assert.equal(
        (probe as any).state.isPlaying,
        true,
        "muting keeps playback state",
      );
      await unmount();
    });

    test("setVideoMuted syncs element and state, and ignores no-op calls", async () => {
      const { probe, run, video, unmount } = await withVideo();
      await run((actions) => actions.setVideoMuted(false));
      assert.equal(video.muted, false);
      assert.equal((probe as any).state.videoOptions.muted, false);

      const renders = probe.renders;
      await run((actions) => actions.setVideoMuted(false));
      assert.equal(
        probe.renders,
        renders,
        "an unchanged value causes no update",
      );
      await unmount();
    });

    test("toggleLoop flips loop on the element and in state", async () => {
      const { probe, run, video, unmount } = await withVideo();
      await run((actions) => actions.toggleLoop());
      assert.equal(video.loop, true);
      assert.equal((probe as any).state.videoOptions.loop, true);

      await run((actions) => actions.toggleLoop());
      assert.equal(video.loop, false);
      assert.equal((probe as any).state.videoOptions.loop, false);
      await unmount();
    });

    test("setVideoPlaying only records state; it does not drive the element", async () => {
      const { probe, run, video, unmount } = await withVideo();
      await run((actions) => actions.setVideoPlaying(true));
      assert.equal((probe as any).state.isPlaying, true);
      assert.deepEqual(video.playCalls, []);
      await unmount();
    });

    test("without an element, actions update state and do not throw", async () => {
      const { probe, run, unmount } = await mountBackground();
      await run((actions) => {
        actions.toggleVideo();
        actions.toggleLoop();
      });
      assert.equal((probe as any).state.isPlaying, true);
      assert.equal((probe as any).state.videoOptions.loop, true);
      await unmount();
    });
  });

  describe("background actions: stability and fresh state", () => {
    test("repeated toggles in one batch each see the previous toggle", async () => {
      const { probe, run, video, unmount } = await withVideo();
      await run((actions) => {
        actions.toggleMute();
        actions.toggleMute();
        actions.toggleLoop();
        actions.toggleLoop();
      });
      assert.equal(video.muted, true, "mute toggled twice returns to muted");
      assert.equal((probe as any).state.videoOptions.muted, true);
      assert.equal(video.loop, false, "loop toggled twice returns to off");
      assert.equal((probe as any).state.videoOptions.loop, false);
      await unmount();
    });

    test("the actions object is stable across state changes", async () => {
      const { probe, run, unmount } = await withVideo();
      const initial = (probe as any).actions;
      await run((actions) => actions.setBackground({ color: "#123456" }));
      await run((actions) => actions.toggleLoop());
      await run((actions) => actions.setVideoPlaying(true));
      assert.equal((probe as any).actions, initial);
      await unmount();
    });
  });
});

describe("youtube", () => {
  const ID = "dQw4w9WgXcQ";

  describe("extractYouTubeVideoId", () => {
    test("reads the id from every common URL shape", () => {
      for (const url of [
        `https://www.youtube.com/watch?v=${ID}`,
        `https://youtube.com/watch?v=${ID}&list=PL1`,
        `https://m.youtube.com/watch?v=${ID}`,
        `https://music.youtube.com/watch?v=${ID}`,
        `https://youtu.be/${ID}?t=30`,
        `https://www.youtube.com/embed/${ID}`,
        `https://www.youtube-nocookie.com/embed/${ID}`,
        `https://www.youtube.com/shorts/${ID}`,
        `https://www.youtube.com/live/${ID}`,
        `youtube.com/watch?v=${ID}`,
        `//youtu.be/${ID}`,
      ]) {
        assert.equal(extractYouTubeVideoId(url), ID, url);
      }
    });

    test("accepts youtube:/yt: prefixes, and bare ids only when allowed", () => {
      assert.equal(extractYouTubeVideoId(`yt:${ID}`), ID);
      assert.equal(extractYouTubeVideoId(`youtube:${ID}`), ID);
      assert.equal(extractYouTubeVideoId(ID), null);
      assert.equal(extractYouTubeVideoId(ID, { allowBareId: true }), ID);
    });

    test("rejects other sites, bad ids and empty input", () => {
      for (const bad of [
        `https://vimeo.com/watch?v=${ID}`,
        "https://www.youtube.com/watch?v=short",
        "https://www.youtube.com/",
        "https://evil.com/youtube.com/watch?v=" + ID,
        "",
        null,
      ]) {
        assert.equal(extractYouTubeVideoId(bad), null, String(bad));
      }
    });
  });

  describe("isYouTubeUrl / isDirectVideoUrl", () => {
    test("isYouTubeUrl", () => {
      assert.equal(isYouTubeUrl(`https://youtu.be/${ID}`), true);
      assert.equal(isYouTubeUrl("https://example.com/v.mp4"), false);
    });

    test("direct video files, blobs and the internal proxy are playable", () => {
      for (const ok of [
        "https://cdn.example.com/a.mp4",
        "https://cdn.example.com/a.WEBM?token=1#t=2",
        "blob:http://localhost/abc",
        "/api/background/youtube?id=x",
        `https://youtu.be/${ID}`,
      ]) {
        assert.equal(isDirectVideoUrl(ok), true, ok);
      }
      for (const no of [
        "https://example.com/page",
        "https://example.com/a.png",
        "",
        null,
      ]) {
        assert.equal(isDirectVideoUrl(no), false, String(no));
      }
    });
  });

  describe("parseYouTubeUrlConfig", () => {
    test("collects id, list and start/end times", () => {
      const config = parseYouTubeUrlConfig(
        `https://www.youtube.com/watch?v=${ID}&list=PL1&t=1m30s&end=120`,
      );

      assert.equal(config!.videoId, ID);
      assert.equal(config!.listId, "PL1");
      assert.equal(config!.startTime, 90);
      assert.equal(config!.endTime, 120);
    });

    test("time parameters understand plain seconds, h/m/s and junk", () => {
      const start = (t) =>
        parseYouTubeUrlConfig(`https://youtu.be/${ID}?t=${t}`)!.startTime;

      assert.equal(start("45"), 45);
      assert.equal(start("1h2m3s"), 3723);
      assert.equal(start("10s"), 10);
      assert.equal(start("soon"), 0);
    });

    test("start falls back to the start parameter, times default to zero", () => {
      const config = parseYouTubeUrlConfig(`https://youtu.be/${ID}?start=12`);

      assert.equal(config!.startTime, 12);
      assert.equal(config!.endTime, 0);
      assert.equal(config!.listId, null);
    });

    test("non-YouTube input has no config", () => {
      assert.equal(parseYouTubeUrlConfig("https://example.com"), null);
      assert.equal(parseYouTubeUrlConfig(null), null);
    });
  });
});

describe("background utils", () => {
  describe("normalizeBackgroundInput", () => {
    test("a plain URL is an image, a video URL is a video", () => {
      assert.deepEqual(normalizeBackgroundInput("  /bg.jpg "), {
        image: "/bg.jpg",
      });
      assert.deepEqual(
        normalizeBackgroundInput("https://cdn.example.com/a.mp4"),
        {
          image: null,
          video: "https://cdn.example.com/a.mp4",
        },
      );
      assert.deepEqual(
        normalizeBackgroundInput("https://youtu.be/dQw4w9WgXcQ"),
        {
          image: null,
          video: "https://youtu.be/dQw4w9WgXcQ",
        },
      );
    });

    test("empty input is an empty patch", () => {
      assert.deepEqual(normalizeBackgroundInput(null), {});
      assert.deepEqual(normalizeBackgroundInput(undefined), {});
      assert.deepEqual(normalizeBackgroundInput(""), {});
    });

    test("a YouTube link given as the image is moved to the video", () => {
      assert.deepEqual(
        normalizeBackgroundInput({ image: "https://youtu.be/dQw4w9WgXcQ" }),
        { image: null, video: "https://youtu.be/dQw4w9WgXcQ" },
      );
    });

    test("an explicit video wins over a YouTube image", () => {
      const patch = normalizeBackgroundInput({
        image: "https://youtu.be/dQw4w9WgXcQ",
        video: "/own.mp4",
      });

      assert.equal(patch.video, "/own.mp4");
      assert.equal(patch.image, "https://youtu.be/dQw4w9WgXcQ");
    });
  });

  describe("mergeBackgroundState", () => {
    const base: any = {
      animation: { duration: 1 },
      image: "/old.jpg",
      imageStyle: { opacity: 1 },
      isPlaying: false,
      noiseStyle: {},
      video: null,
      videoOptions: { loop: true },
      videoStyle: {},
    };

    test("style objects are merged one level deep", () => {
      const next = mergeBackgroundState(base, {
        imageStyle: { blur: 4 },
        videoOptions: { muted: false },
      } as any);

      assert.deepEqual(next.imageStyle, { blur: 4, opacity: 1 });
      assert.deepEqual(next.videoOptions, { loop: true, muted: false });
      assert.equal(next.image, "/old.jpg");
    });

    test("a string patch swaps the image and leaves the rest", () => {
      const next = mergeBackgroundState(base, "/new.jpg");

      assert.equal(next.image, "/new.jpg");
      assert.deepEqual(next.videoOptions, base.videoOptions);
    });

    test("a new video starts playing unless autoplay is off", () => {
      assert.equal(
        mergeBackgroundState(base, { video: "/a.mp4" } as any).isPlaying,
        true,
      );
      assert.equal(
        mergeBackgroundState(base, {
          video: "/a.mp4",
          videoOptions: { autoplay: false },
        } as any).isPlaying,
        false,
      );
    });

    test("an explicit isPlaying wins, and removing the video keeps the old flag", () => {
      assert.equal(
        mergeBackgroundState(base, { isPlaying: true, video: "/a.mp4" } as any)
          .isPlaying,
        true,
      );
      assert.equal(
        mergeBackgroundState({ ...base, isPlaying: true, video: "/a.mp4" }, {
          video: null,
        } as any).isPlaying,
        true,
      );
    });

    test("animation merges, and null clears it", () => {
      assert.deepEqual(
        mergeBackgroundState(base, { animation: { delay: 2 } } as any)
          .animation,
        { delay: 2, duration: 1 },
      );
      assert.equal(
        mergeBackgroundState(base, { animation: null } as any).animation,
        null,
      );
    });

    test("the base state is never mutated", () => {
      const snapshot = JSON.stringify(base);

      mergeBackgroundState(base, {
        imageStyle: { blur: 1 },
        video: "/a.mp4",
      } as any);

      assert.equal(JSON.stringify(base), snapshot);
    });
  });

  describe("resolveVideoOptions", () => {
    test("defaults are muted, auto-playing, 1080p without loop", () => {
      assert.deepEqual(resolveVideoOptions(), {
        codec: "auto",
        corp: 0,
        forceIframe: false,
        isLoop: false,
        isMuted: true,
        playbackRate: 1,
        quality: "1080p",
        shouldAutoPlay: true,
        showPoster: false,
        showSpinner: true,
      });
    });

    test("overrides are honoured, including falsy ones", () => {
      const options = resolveVideoOptions({
        autoplay: false,
        loop: true,
        muted: false,
        playbackRate: 1.5,
        showSpinner: false,
      } as any);

      assert.equal(options.shouldAutoPlay, false);
      assert.equal(options.isLoop, true);
      assert.equal(options.isMuted, false);
      assert.equal(options.playbackRate, 1.5);
      assert.equal(options.showSpinner, false);
    });
  });

  describe("resolveVideoClassNames", () => {
    test("splits tokens into object style, width and other classes", () => {
      const result = resolveVideoClassNames(
        "bg-cover bg-top w-full max-w-4xl rounded",
        "opacity-50",
      );

      assert.deepEqual(result.objectStyle, {
        objectFit: "cover",
        objectPosition: "top",
      });
      assert.equal(result.width, "w-full max-w-4xl");
      assert.equal(result.other, "bg-cover bg-top rounded opacity-50");
    });

    test("commas separate tokens and junk inputs are ignored", () => {
      const result = resolveVideoClassNames("bg-cover,w-1/2", null, undefined);

      assert.deepEqual(result.objectStyle, { objectFit: "cover" });
      assert.equal(result.width, "w-1/2");
    });
  });

  test("selectPageBackground normalises or returns null", () => {
    assert.equal(selectPageBackground(null), null);
    assert.deepEqual(selectPageBackground("/a.jpg" as any), {
      image: "/a.jpg",
    });
  });
});
