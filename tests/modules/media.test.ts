import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_MEDIA_STATE } from "../../src/modules/media/constants.ts";
import {
  bindFollowers,
  toggleElement,
} from "../../src/modules/media/playback.ts";
import {
  createMediaState,
  findDisplacedAudio,
  mergeMediaSource,
  resolveMediaSession,
  selectPageMedia,
} from "../../src/modules/media/session.ts";
import type { MediaEntry } from "../../src/modules/media/types.ts";

class FakeMedia extends EventTarget {
  currentTime = 0;
  ended = false;
  loop = false;
  muted = false;
  paused = true;
  playbackRate = 1;
  plays = 0;
  volume = 1;

  play() {
    this.paused = false;
    this.plays += 1;
    this.dispatchEvent(new Event("play"));
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
    this.dispatchEvent(new Event("pause"));
  }
}

const media = () => new FakeMedia() as unknown as HTMLMediaElement;

let order = 0;
const entry = (id: string, over: Partial<MediaEntry> = {}): MediaEntry =>
  mergeMediaSource(undefined, { id, ...over }, (order += 1));

describe("resolveMediaSession", () => {
  test("no sources means no session", () => {
    assert.equal(resolveMediaSession([]), null);
  });

  test("a lone video is both transport and audible (video only)", () => {
    const video = entry("background", { kind: "video" });
    const session = resolveMediaSession([video])!;
    assert.equal(session.transport, video);
    assert.equal(session.audible, video);
    assert.deepEqual(session.followers, []);
  });

  test("a lone audio is both transport and audible (audio only)", () => {
    const audio = entry("a");
    const session = resolveMediaSession([audio])!;
    assert.equal(session.transport, audio);
    assert.equal(session.audible, audio);
  });

  test("an audio following a muted video: video owns the timeline, audio owns the sound", () => {
    const video = entry("background", { kind: "video" });
    const audio = entry("a", { follow: "background" });
    const session = resolveMediaSession([video, audio])!;
    assert.equal(session.transport, video);
    assert.equal(session.audible, audio);
    assert.deepEqual(session.followers, [audio]);
  });

  test("independent sources: the newest wins the controls", () => {
    const video = entry("background", { kind: "video" });
    const audio = entry("a");
    const session = resolveMediaSession([video, audio])!;
    assert.equal(session.transport, audio);
    assert.equal(session.audible, audio);
    assert.deepEqual(session.followers, []);
  });

  test("a follower whose target is missing is standalone", () => {
    const audio = entry("a", { follow: "background" });
    const session = resolveMediaSession([audio])!;
    assert.equal(session.transport, audio);
    assert.deepEqual(session.followers, []);
  });

  test("follow cycles and self-follow never leave the dock without a transport", () => {
    const a = entry("a", { follow: "b" });
    const b = entry("b", { follow: "a" });
    assert.equal(resolveMediaSession([a, b])!.transport, b);
    const self = entry("s", { follow: "s" });
    assert.equal(resolveMediaSession([self])!.transport, self);
  });

  test("a follower of a follower is standalone", () => {
    const video = entry("background", { kind: "video" });
    const first = entry("a", { follow: "background" });
    const second = entry("b", { follow: "a" });
    const session = resolveMediaSession([video, first, second])!;
    assert.equal(session.transport, second);
    assert.deepEqual(session.followers, []);
  });

  test("with several audio followers the newest one is audible", () => {
    const video = entry("background", { kind: "video" });
    const first = entry("a", { follow: "background" });
    const second = entry("b", { follow: "background" });
    const session = resolveMediaSession([video, first, second])!;
    assert.equal(session.audible, second);
    assert.deepEqual(session.followers, [first, second]);
  });

  test("a video follower never takes the volume controls", () => {
    const lead = entry("a");
    const video = entry("v", { follow: "a", kind: "video" });
    const session = resolveMediaSession([lead, video])!;
    assert.equal(session.audible, lead);
  });
});

describe("createMediaState", () => {
  test("no session is the default state", () => {
    assert.equal(createMediaState(null), DEFAULT_MEDIA_STATE);
  });

  test("exposes transport and audible elements separately", () => {
    const videoEl = media();
    const audioEl = media();
    const video = entry("background", {
      element: videoEl,
      isPlaying: true,
      kind: "video",
      loop: true,
    });
    const audio = entry("a", { element: audioEl, follow: "background" });
    const state = createMediaState(resolveMediaSession([video, audio]));
    assert.deepEqual(state, {
      audibleElement: audioEl,
      element: videoEl,
      hasMedia: true,
      isPlaying: true,
      kind: "video",
      loop: true,
      sourceId: "background",
    });
  });
});

describe("mergeMediaSource", () => {
  test("fills defaults and keeps the first registration order", () => {
    const created = mergeMediaSource(undefined, { id: "a" }, 5);
    assert.equal(created.kind, "audio");
    assert.equal(created.follow, null);
    assert.equal(created.order, 5);
    const updated = mergeMediaSource(created, { id: "a", isPlaying: true }, 9);
    assert.equal(updated.order, 5);
    assert.equal(updated.isPlaying, true);
  });
});

describe("toggleElement", () => {
  test("plays a paused element and pauses a playing one", () => {
    const el = new FakeMedia();
    toggleElement(el as unknown as HTMLMediaElement);
    assert.equal(el.paused, false);
    toggleElement(el as unknown as HTMLMediaElement);
    assert.equal(el.paused, true);
    toggleElement(null);
  });
});

describe("bindFollowers", () => {
  test("mirrors play, pause, seek and speed onto followers", () => {
    const lead = new FakeMedia();
    const follower = new FakeMedia();
    const stop = bindFollowers(lead as unknown as HTMLMediaElement, [
      follower as unknown as HTMLMediaElement,
    ]);

    lead.playbackRate = 1.5;
    lead.dispatchEvent(new Event("ratechange"));
    assert.equal(follower.playbackRate, 1.5);

    lead.currentTime = 42;
    lead.dispatchEvent(new Event("seeked"));
    assert.equal(follower.currentTime, 42);

    lead.paused = false;
    lead.dispatchEvent(new Event("play"));
    assert.equal(follower.paused, false);

    lead.paused = true;
    lead.dispatchEvent(new Event("pause"));
    assert.equal(follower.paused, true);

    stop();
  });

  test("only corrects drift past the threshold during playback", () => {
    const lead = new FakeMedia();
    const follower = new FakeMedia();
    const stop = bindFollowers(lead as unknown as HTMLMediaElement, [
      follower as unknown as HTMLMediaElement,
    ]);
    lead.currentTime = 10;
    follower.currentTime = 10.1;
    lead.dispatchEvent(new Event("timeupdate"));
    assert.equal(follower.currentTime, 10.1);

    follower.currentTime = 12;
    lead.dispatchEvent(new Event("timeupdate"));
    assert.equal(follower.currentTime, 10);
    stop();
  });

  test("joins a transport that is already playing, in sync", () => {
    const lead = new FakeMedia();
    lead.paused = false;
    lead.currentTime = 7;
    const follower = new FakeMedia();
    const stop = bindFollowers(lead as unknown as HTMLMediaElement, [
      follower as unknown as HTMLMediaElement,
    ]);
    assert.equal(follower.currentTime, 7);
    assert.equal(follower.paused, false);
    stop();
  });

  test("cleanup detaches listeners and restores the follower's own loop", () => {
    const lead = new FakeMedia();
    const follower = new FakeMedia();
    follower.loop = true;
    const stop = bindFollowers(lead as unknown as HTMLMediaElement, [
      follower as unknown as HTMLMediaElement,
    ]);
    assert.equal(follower.loop, false);
    stop();
    assert.equal(follower.loop, true);

    lead.currentTime = 99;
    lead.dispatchEvent(new Event("seeked"));
    assert.notEqual(follower.currentTime, 99);
  });
});

describe("selectPageMedia", () => {
  test("a string is the file URL", () => {
    assert.deepEqual(selectPageMedia("/a.mp3"), { src: "/a.mp3" });
  });

  test("an options object needs a src", () => {
    assert.deepEqual(selectPageMedia({ src: "/a.mp3", loop: true }), {
      loop: true,
      src: "/a.mp3",
    });
    assert.equal(selectPageMedia({ src: "" }), null);
    assert.equal(selectPageMedia({} as any), null);
    assert.equal(selectPageMedia(null), null);
    assert.equal(selectPageMedia(undefined), null);
  });
});

describe("findDisplacedAudio", () => {
  const playing = () => {
    const el = new FakeMedia();
    el.paused = false;
    return el as unknown as HTMLMediaElement;
  };

  test("a new standalone audio displaces other playing standalone audio", () => {
    const old = entry("old", { element: playing() });
    const next = entry("next", { element: playing() });
    const session = resolveMediaSession([old, next]);
    assert.deepEqual(findDisplacedAudio([old, next], session, "next"), [old]);
  });

  test("followers, videos, paused audio and non-transport newcomers are left alone", () => {
    const video = entry("background", { element: playing(), kind: "video" });
    const follower = entry("f", { element: playing(), follow: "background" });
    const paused = entry("p", { element: media() });
    const session = resolveMediaSession([video, paused, follower]);
    assert.deepEqual(
      findDisplacedAudio([video, paused, follower], session, "f"),
      [],
    );

    const old = entry("old", { element: playing() });
    const next = entry("next", { element: playing(), follow: "old" });
    const nested = resolveMediaSession([old, next]);
    assert.deepEqual(findDisplacedAudio([old, next], nested, "next"), []);
  });
});
