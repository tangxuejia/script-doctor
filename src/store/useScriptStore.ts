'use client';

import { create } from 'zustand';

export interface ScoreItem {
  label: string;
  value: string;
}

interface ScriptState {
  scriptContent: string;
  selectedModules: string[];
  isAnalyzing: boolean;
  report: string;
  error: string | null;
  scores: ScoreItem[];

  setScriptContent: (content: string) => void;
  setSelectedModules: (modules: string[]) => void;
  toggleModule: (module: string) => void;
  setIsAnalyzing: (v: boolean) => void;
  appendReport: (chunk: string) => void;
  setError: (error: string | null) => void;
  setScores: (scores: ScoreItem[]) => void;
  reset: () => void;
}

export const useScriptStore = create<ScriptState>((set) => ({
  scriptContent: '',
  selectedModules: [],
  isAnalyzing: false,
  report: '',
  error: null,
  scores: [],

  setScriptContent: (content) => set({ scriptContent: content }),

  setSelectedModules: (modules) => set({ selectedModules: modules }),

  toggleModule: (m) =>
    set((s) => ({
      selectedModules: s.selectedModules.includes(m)
        ? s.selectedModules.filter((x) => x !== m)
        : [...s.selectedModules, m],
    })),

  setIsAnalyzing: (v) => set({ isAnalyzing: v }),

  appendReport: (chunk) =>
    set((s) => ({ report: s.report + chunk })),

  setError: (error) => set({ error }),

  setScores: (scores) => set({ scores }),

  reset: () =>
    set({
      report: '',
      error: null,
      scores: [],
      isAnalyzing: false,
    }),
}));
