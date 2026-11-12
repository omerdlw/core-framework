"use client";

import { useEffect, useState } from "react";

import { getOrCreateGlobalContext } from "@/core/kernel";
import { createStore } from "@/foundation/utils";

import { DEFAULT_MEDIA_STATE } from "./constants";
import { bindFollowers, sameElements, toggleElement } from "./playback";
import {
  createMediaState,
  findDisplacedAudio,
  mediaStatesEqual,
  mergeMediaSource,
  resolveMediaSession,
} from "./session";
import {
  type MediaActions,
  type MediaContextValue,
  type MediaEntry,
  type MediaProviderProps,
  type MediaSession,
  type MediaState,
} from "./types";

/**
 * React context holding the media store and actions.
 */
export const MediaContext = getOrCreateGlobalContext<MediaContextValue | null>(
  "MediaContext",
  null,
);

/**
 * Store with the default state; used outside a MediaProvider.
 */
export const NOOP_MEDIA_STORE = createStore<MediaState>(DEFAULT_MEDIA_STATE);

interface Binding {
  cleanup: () => void;
  followers: readonly (HTMLMediaElement | null)[];
  transport: HTMLMediaElement;
}

/**
 * Moves the follower binding to match the session: keeps it when the transport
 * and followers are unchanged, otherwise replaces it.
 */
function rebindFollowers(
  current: Binding | null,
  session: MediaSession | null,
): Binding | null {
  const transport = session?.transport.element ?? null;
  const followers = (session?.followers ?? []).map((source) => source.element);
  if (
    current &&
    current.transport === transport &&
    sameElements(current.followers, followers)
  ) {
    return current;
  }
  current?.cleanup();
  const live = followers.filter(
    (element): element is HTMLMediaElement => element !== null,
  );
  if (!transport || live.length === 0) return null;
  return {
    cleanup: bindFollowers(transport, live),
    followers,
    transport,
  };
}

/** Mutes an entry through its own controls, or directly on its element. */
function setEntryMuted(entry: MediaEntry, muted: boolean): void {
  if (entry.controls?.setMuted) entry.controls.setMuted(muted);
  else if (entry.element) entry.element.muted = muted;
}

function toggleEntry(entry: MediaEntry): void {
  if (entry.controls?.toggle) entry.controls.toggle();
  else toggleElement(entry.element);
}

function toggleEntryLoop(
  entry: MediaEntry,
  patch: (id: string, changes: Partial<MediaEntry>) => void,
): void {
  if (entry.controls?.toggleLoop) {
    entry.controls.toggleLoop();
    return;
  }
  const loop = !entry.loop;
  if (entry.element) entry.element.loop = loop;
  patch(entry.id, { loop });
}

interface MediaInstance {
  /** Releases the follower binding. */
  dispose: () => void;
  value: MediaContextValue;
}

/** Builds the media store, its source registry and the actions over them. */
function createMedia(): MediaInstance {
  const store = createStore<MediaState>(DEFAULT_MEDIA_STATE, {
    freezeSnapshots: false,
  });
  const sources = new Map<string, MediaEntry>();
  let session: MediaSession | null = null;
  let order = 0;
  let binding: Binding | null = null;

  const commit = () => {
    session = resolveMediaSession([...sources.values()]);
    binding = rebindFollowers(binding, session);
    const next = createMediaState(session);
    store.publish((prev) => (mediaStatesEqual(prev, next) ? prev : next));
  };

  const patch = (id: string, changes: Partial<MediaEntry>) => {
    const current = sources.get(id);
    if (!current) return;
    sources.set(id, { ...current, ...changes });
    commit();
  };

  const actions: MediaActions = {
    removeSource: (id) => {
      if (sources.delete(id)) commit();
    },
    setMuted: (muted) => {
      const audible = session?.audible;
      if (audible) setEntryMuted(audible, muted);
    },
    toggle: () => {
      const transport = session?.transport;
      if (transport) toggleEntry(transport);
    },
    toggleLoop: () => {
      const transport = session?.transport;
      if (transport) toggleEntryLoop(transport, patch);
    },
    upsertSource: (input) => {
      const current = sources.get(input.id);
      if (!current) order += 1;
      sources.set(input.id, mergeMediaSource(current, input, order));
      commit();
      if (!current) {
        findDisplacedAudio([...sources.values()], session, input.id).forEach(
          (entry) => entry.element?.pause(),
        );
      }
    },
  };

  return {
    dispose: () => {
      binding?.cleanup();
      binding = null;
    },
    value: { actions, store },
  };
}

/**
 * Provides media state and actions to its children and keeps follower
 * sources in sync with their transport.
 */
export function MediaProvider({ children }: MediaProviderProps) {
  const [{ dispose, value }] = useState(createMedia);
  useEffect(() => dispose, [dispose]);

  return <MediaContext value={value}>{children}</MediaContext>;
}
