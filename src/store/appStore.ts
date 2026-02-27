import { create } from 'zustand'
import type { PullResult } from '@/lib/gacha'

interface AppState {
  fossils: number | null
  pullResults: Array<PullResult>
  isPulling: boolean

  setFossils: (fossils: number) => void
  setPullResults: (results: Array<PullResult>) => void
  addPullResult: (result: PullResult) => void
  setIsPulling: (pulling: boolean) => void
  clearPullResults: () => void
}

export const useAppStore = create<AppState>((set) => ({
  fossils: null,
  pullResults: [],
  isPulling: false,

  setFossils: (fossils) => set({ fossils }),
  setPullResults: (results) => set({ pullResults: results }),
  addPullResult: (result) =>
    set((state) => ({ pullResults: [...state.pullResults, result] })),
  setIsPulling: (pulling) => set({ isPulling: pulling }),
  clearPullResults: () => set({ pullResults: [] }),
}))
