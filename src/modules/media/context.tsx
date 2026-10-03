"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getOrCreateGlobalContext } from "@/kernel";
import { createStore } from "@/utils";
import { DEFAULT_MEDIA_STATE } from "./constants";
import {
  bindFollowers,
  sameElements,
  toggleElement,
} from "./playback";
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

export const MediaContext = getOrCreateGlobalContext<MediaContextValue | null>(
  "MediaContext",
  null,
);

export const NOOP_MEDIA_STORE = createStore<MediaState>(DEFAULT_MEDIA_STATE);

interface Binding {
  cleanup: () => void;
  followers: readonly (HTMLMediaElement | null)[];
  transport: HTMLMediaElement;
}

export function MediaProvider({ children }: MediaProviderProps) {
  const [store] = useState(() =>
    createStore<MediaState>(DEFAULT_MEDIA_STATE, { freezeSnapshots: false }),
  );
  const sourcesRef = useRef(new Map<string, MediaEntry>());
  const sessionRef = useRef<MediaSession | null>(null);
  const orderRef = useRef(0);
  const bindingRef = useRef<Binding | null>(null);

  const actions = useMemo<MediaActions>(() => {
    const unbind = () => {
      bindingRef.current?.cleanup();
      bindingRef.current = null;
    };

    const rebind = (session: MediaSession | null) => {
      const transport = session?.transport.element ?? null;
      const followers = (session?.followers ?? []).map(
        (source) => source.element,
      );
      const current = bindingRef.current;
      if (
        current &&
        current.transport === transport &&
        sameElements(current.followers, followers)
      ) {
        return;
      }
      unbind();
      const live = followers.filter(
        (element): element is HTMLMediaElement => element !== null,
      );
      if (!transport || live.length === 0) return;
      bindingRef.current = {
        cleanup: bindFollowers(transport, live),
        followers,
        transport,
      };
    };

    const commit = () => {
      const session = resolveMediaSession([...sourcesRef.current.values()]);
      sessionRef.current = session;
      rebind(session);
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
        if (!audible) return;
        if (audible.controls?.setMuted) audible.controls.setMuted(muted);
        else if (audible.element) audible.element.muted = muted;
      },
      toggle: () => {
        const transport = sessionRef.current?.transport;
        if (!transport) return;
        if (transport.controls?.toggle) transport.controls.toggle();
        else toggleElement(transport.element);
      },
      toggleLoop: () => {
        const transport = sessionRef.current?.transport;
        if (!transport) return;
        if (transport.controls?.toggleLoop) {
          transport.controls.toggleLoop();
          return;
        }
        const loop = !transport.loop;
        if (transport.element) transport.element.loop = loop;
        patch(transport.id, { loop });
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
