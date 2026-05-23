/**
 * 模块依赖关系 — v2 精简版
 * 所有模块独立选择，不自动绑定
 */

/** 无依赖 — 每个模块独立使用 */
export const MODULE_DEPENDENCIES: Record<string, string[]> = {};

/** 无分层 — 所有模块合并为一次调用 */
export const MODULE_LAYERS: Record<string, number> = {};

/** 模块名称映射 */
export const MODULE_NAMES: Record<string, string> = {
  M2: '平台合规', M16: '多平台适配', M18: '剧本优化',
};

/** 无冲突 */
export const MODULE_CONFLICTS: [string, string, string][] = [];

export function getAllDeps(): string[] { return []; }

export function findMissingDeps(): string[] { return []; }

export function findAffectedModules(): string[] { return []; }

export function sortByLayer(modules: string[]): string[] { return modules; }
