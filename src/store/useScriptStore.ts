'use client';

import { create } from 'zustand';

export interface ScoreItem {
  label: string;
  value: string;
}

export type SolutionVersion = 'M15_STANDARD' | 'M15_DEEP' | 'M15_REMAKE';

export const PLATFORMS = ['抖音', '快手', '微信视频号', '红果短剧', '爱奇艺', 'B站', '淘宝', '优酷', '腾讯视频'] as const;
export type Platform = typeof PLATFORMS[number];

interface ScriptState {
  scriptContent: string;
  selectedModules: string[];
  isAnalyzing: boolean;
  report: string;
  error: string | null;
  scores: ScoreItem[];
  solutionVersion: SolutionVersion;
  selectedPlatforms: Platform[];

  setScriptContent: (content: string) => void;
  setSelectedModules: (modules: string[]) => void;
  toggleModule: (module: string) => void;
  setIsAnalyzing: (v: boolean) => void;
  appendReport: (chunk: string) => void;
  setError: (error: string | null) => void;
  setScores: (scores: ScoreItem[]) => void;
  setSolutionVersion: (v: SolutionVersion) => void;
  togglePlatform: (p: Platform) => void;
  reset: () => void;
}

export const useScriptStore = create<ScriptState>((set) => ({
  scriptContent: '',
  selectedModules: [],
  isAnalyzing: false,
  report: '',
  error: null,
  scores: [],
  solutionVersion: 'M15_STANDARD',
  selectedPlatforms: [],

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

  setSolutionVersion: (v) => set({ solutionVersion: v }),

  togglePlatform: (p) =>
    set((s) => ({
      selectedPlatforms: s.selectedPlatforms.includes(p)
        ? s.selectedPlatforms.filter((x) => x !== p)
        : [...s.selectedPlatforms, p],
    })),

  reset: () =>
    set({
      report: '',
      error: null,
      scores: [],
      isAnalyzing: false,
    }),
}));
