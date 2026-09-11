import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEMO_SPEC } from '@ale/engine';
import type { AdElement, AdSpec, Surface } from '@ale/engine';
import { customSurface, PRESETS } from './presets';

const STORAGE_KEY = 'ale.playground.v1';

export interface PlaygroundState {
  spec: AdSpec;
  surface: Surface;
  showDebug: boolean;
  selectedElementId: string | null;

  setSpec: (spec: AdSpec) => void;
  resetSpec: () => void;
  updateElement: (id: string, patch: Partial<AdElement>) => void;
  setPriority: (id: string, priority: number) => void;
  /** Adds or removes an element from `rules.neverDrop`. */
  toggleNeverDrop: (id: string) => void;
  removeElement: (id: string) => void;
  addElement: (element: AdElement) => void;
  setTheme: (patch: Partial<AdSpec['theme']>) => void;
  setPalette: (patch: Partial<AdSpec['theme']['palette']>) => void;

  setSurface: (surface: Surface) => void;
  setSurfaceSize: (width: number, height: number) => void;
  selectPreset: (id: string) => void;

  toggleDebug: () => void;
  selectElement: (id: string | null) => void;
}

const firstPreset = PRESETS.find((s) => s.id === 'story-1080x1920') ?? PRESETS[0];

export const usePlayground = create<PlaygroundState>()(
  persist(
    (set) => ({
      spec: DEMO_SPEC,
      surface: firstPreset ?? customSurface(1080, 1920),
      showDebug: false,
      selectedElementId: null,

      setSpec: (spec) => set({ spec }),
      resetSpec: () => set({ spec: DEMO_SPEC, selectedElementId: null }),

      updateElement: (id, patch) =>
        set((state) => ({
          spec: {
            ...state.spec,
            elements: state.spec.elements.map((el) => (el.id === id ? { ...el, ...patch } : el)),
          },
        })),

      setPriority: (id, priority) =>
        set((state) => ({
          spec: {
            ...state.spec,
            elements: state.spec.elements.map((el) =>
              el.id === id
                ? { ...el, priority: Math.max(0, Math.min(100, Math.round(priority))) }
                : el,
            ),
          },
        })),

      toggleNeverDrop: (id) =>
        set((state) => {
          const held = new Set(state.spec.rules?.neverDrop ?? []);
          if (held.has(id)) held.delete(id);
          else held.add(id);
          const next = [...held];
          return {
            spec: {
              ...state.spec,
              rules: { ...state.spec.rules, neverDrop: next.length > 0 ? next : undefined },
            },
          };
        }),

      removeElement: (id) =>
        set((state) => ({
          selectedElementId: state.selectedElementId === id ? null : state.selectedElementId,
          spec: {
            ...state.spec,
            elements: state.spec.elements.filter((el) => el.id !== id),
            rules: state.spec.rules && {
              ...state.spec.rules,
              neverDrop: state.spec.rules.neverDrop?.filter((n) => n !== id),
              alwaysPairs: state.spec.rules.alwaysPairs?.filter((p) => !p.includes(id)),
            },
          },
        })),

      addElement: (element) =>
        set((state) => ({
          spec: { ...state.spec, elements: [...state.spec.elements, element] },
          selectedElementId: element.id,
        })),

      setTheme: (patch) =>
        set((state) => ({ spec: { ...state.spec, theme: { ...state.spec.theme, ...patch } } })),

      setPalette: (patch) =>
        set((state) => ({
          spec: {
            ...state.spec,
            theme: { ...state.spec.theme, palette: { ...state.spec.theme.palette, ...patch } },
          },
        })),

      setSurface: (surface) => set({ surface }),
      setSurfaceSize: (width, height) => set({ surface: customSurface(width, height) }),
      selectPreset: (id) =>
        set((state) => ({ surface: PRESETS.find((s) => s.id === id) ?? state.surface })),

      toggleDebug: () => set((state) => ({ showDebug: !state.showDebug })),
      selectElement: (id) => set({ selectedElementId: id }),
    }),
    {
      name: STORAGE_KEY,
      // Only the document is worth restoring; UI state should start clean.
      partialize: (state) => ({ spec: state.spec, surface: state.surface }),
    },
  ),
);
