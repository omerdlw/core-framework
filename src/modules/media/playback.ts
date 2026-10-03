import { MEDIA_SYNC_DRIFT_SECONDS } from "./constants";

const noop = () => {};

export function toggleElement(element: HTMLMediaElement | null): void {
  if (!element) return;
  if (element.paused || element.ended) {
    void Promise.resolve(element.play()).catch(noop);
  } else {
    element.pause();
  }
}

export function safePlay(element: HTMLMediaElement): void {
  try {
    void Promise.resolve(element.play()).catch(noop);
  } catch {}
}

export function sameElements(
  a: readonly (HTMLMediaElement | null)[],
  b: readonly (HTMLMediaElement | null)[],
): boolean {
  return (
    a.length === b.length && a.every((element, index) => element === b[index])
  );
}

export function bindFollowers(
  transport: HTMLMediaElement,
  followers: readonly HTMLMediaElement[],
): () => void {
  const ownLoops = followers.map((follower) => follower.loop);

  const align = (hard: boolean) => {
    const time = Number(transport.currentTime) || 0;
    for (const follower of followers) {
      follower.loop = false;
      if (follower.playbackRate !== transport.playbackRate) {
        follower.playbackRate = transport.playbackRate;
      }
      const drift = Math.abs((Number(follower.currentTime) || 0) - time);
      if (hard || drift > MEDIA_SYNC_DRIFT_SECONDS) follower.currentTime = time;
    }
  };
  const play = () => {
    align(false);
    followers.forEach(safePlay);
  };
  const pause = () => followers.forEach((follower) => follower.pause());
  const hardAlign = () => align(true);
  const softAlign = () => align(false);

  const listeners: [string, () => void][] = [
    ["play", play],
    ["playing", play],
    ["pause", pause],
    ["waiting", pause],
    ["ended", pause],
    ["seeking", hardAlign],
    ["seeked", hardAlign],
    ["ratechange", softAlign],
    ["timeupdate", softAlign],
  ];
  for (const [type, listener] of listeners) {
    transport.addEventListener(type, listener);
  }

  hardAlign();
  if (!transport.paused && !transport.ended) play();

  return () => {
    for (const [type, listener] of listeners) {
      transport.removeEventListener(type, listener);
    }
    followers.forEach((follower, index) => {
      follower.loop = ownLoops[index];
    });
  };
}
