import { create } from 'zustand'
import type { PullResult } from '@/lib/gacha'

interface AppState {
  pullResults: Array<PullResult>
  isPulling: boolean

  setPullResults: (results: Array<PullResult>) => void
  addPullResult: (result: PullResult) => void
  setIsPulling: (pulling: boolean) => void
  clearPullResults: () => void
}

export const useAppStore = create<AppState>((set) => ({
  pullResults: [],
  isPulling: false,

  setPullResults: (results) => set({ pullResults: results }),
  addPullResult: (result) =>
    set((state) => ({ pullResults: [...state.pullResults, result] })),
  setIsPulling: (pulling) => set({ isPulling: pulling }),
  clearPullResults: () => set({ pullResults: [] }),
}))
