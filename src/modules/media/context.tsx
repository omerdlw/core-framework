"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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

/**
 * Provides media state and actions to its children and keeps follower
 * sources in sync with their transport.
 */
export function MediaProvider({ children }: MediaProviderProps) {
  const [store] = useState(() =>
    createStore<MediaState>(DEFAULT_MEDIA_STATE, { freezeSnapshots: false }),
  );
  const sourcesRef = useRef(new Map<string, MediaEntry>());
  const sessionRef = useRef<MediaSession | null>(null);
  const orderRef = useRef(0);
  const bindingRef = useRef<Binding | null>(null);

  const actions = useMemo<MediaActions>(() => {
    const commit = () => {
      const session = resolveMediaSession([...sourcesRef.current.values()]);
      sessionRef.current = session;
      bindingRef.current = rebindFollowers(bindingRef.current, session);
      const next = createMediaState(session);
      store.publish((prev) => (mediaStatesEqual(prev, next) ? prev : next));
    };

    const patch = (id: string, changes: Partial<MediaEntry>) => {
      const current = sourcesRef.current.get(id);
      if (!current) return;
      sourcesRef.current.set(id, { ...current, ...changes });
      commit();
    };

    return {
      removeSource: (id) => {
        if (sourcesRef.current.delete(id)) commit();
      },
      setMuted: (muted) => {
        const audible = sessionRef.current?.audible;
        if (audible) setEntryMuted(audible, muted);
      },
      toggle: () => {
        const transport = sessionRef.current?.transport;
        if (transport) toggleEntry(transport);
      },
      toggleLoop: () => {
        const transport = sessionRef.current?.transport;
        if (transport) toggleEntryLoop(transport, patch);
      },
      upsertSource: (input) => {
        const current = sourcesRef.current.get(input.id);
        if (!current) orderRef.current += 1;
        sourcesRef.current.set(
          input.id,
          mergeMediaSource(current, input, orderRef.current),
        );
        commit();
        if (!current) {
          findDisplacedAudio(
            [...sourcesRef.current.values()],
            sessionRef.current,
            input.id,
          ).forEach((entry) => entry.element?.pause());
        }
      },
    };
  }, [store]);

  useEffect(
    () => () => {
      bindingRef.current?.cleanup();
      bindingRef.current = null;
    },
    [],
  );

  const value = useMemo<MediaContextValue>(
    () => ({ actions, store }),
    [actions, store],
  );

  return <MediaContext value={value}>{children}</MediaContext>;
}
