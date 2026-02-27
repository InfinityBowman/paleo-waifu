import { create } from 'zustand'
import type { PullResult } from '@/lib/gacha'

interface AppState {
  fossils: number
  pullResults: PullResult[]
  isPulling: boolean

  setFossils: (fossils: number) => void
  setPullResults: (results: PullResult[]) => void
  addPullResult: (result: PullResult) => void
  setIsPulling: (pulling: boolean) => void
  clearPullResults: () => void
}

export const useAppStore = create<AppState>((set) => ({
  fossils: 0,
  pullResults: [],
  isPulling: false,

  setFossils: (fossils) => set({ fossils }),
  setPullResults: (results) => set({ pullResults: results }),
  addPullResult: (result) =>
    set((state) => ({ pullResults: [...state.pullResults, result] })),
  setIsPulling: (pulling) => set({ isPulling: pulling }),
  clearPullResults: () => set({ pullResults: [] }),
}))
