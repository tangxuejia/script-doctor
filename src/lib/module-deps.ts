/**
 * 模块依赖关系与分层执行体系
 *
 * 诊断层 → 分析层 → 方案层 → 商业化层
 * 上层模块依赖下层模块的输出
 */

/** 模块依赖映射：选中此模块时需要前置模块 */
export const MODULE_DEPENDENCIES: Record<string, string[]> = {
  // 分析层 ◀ 诊断层
  M3: ['M1', 'M2'],        // 爆款拆解 ← AI诊断 + 合规
  M9: ['M1', 'M3'],        // 白金突破 ← AI诊断 + 爆款拆解

  // 方案层 ◀ 诊断+分析层
  M18: ['M1', 'M2', 'M3', 'M9'], // 三级优化 ← 全部前置

  // 商业化层 ◀ 诊断+方案层
  M10: ['M2', 'M3'],       // 出海 ← 合规 + 爆款
  M11: ['M9'],             // 互动影游 ← 白金诊断
  M12: ['M2', 'M3', 'M9'], // 精品申报 ← 合规 + 爆款 + 白金
  M13: ['M18'],            // Agent协同 ← 三级优化
  M16: ['M2', 'M18'],      // 多平台 ← 合规 + 三级优化
};

/** 模块分层：数字越小越先执行 */
export const MODULE_LAYERS: Record<string, number> = {
  M1: 1, M2: 1, M6: 1, M7: 1,   // 诊断层
  M3: 2, M9: 2,                   // 分析层
  M18: 3,                          // 方案层
  M10: 4, M11: 4, M12: 4, M13: 4, M16: 4, // 商业化层
  M4: 4, M5: 4, M8: 4,           // 工具类
};

/** 模块名称映射 */
export const MODULE_NAMES: Record<string, string> = {
  M1: 'AI深度鉴别', M2: '动态合规', M3: '爆款拆解', M4: '制作协同',
  M5: '互动共创', M6: '跨模态评估', M7: '数据驱动', M8: '提示词库',
  M9: '白金突破', M10: '出海适配', M11: '互动影游', M12: '精品申报',
  M13: 'Agent协同', M16: '多平台适配', M18: '三级优化',
};

/** 无冲突 — M18 已统一替换 M14/M15/M17 */
export const MODULE_CONFLICTS: [string, string, string][] = [];

/**
 * 获取模块的所有递归依赖（含间接依赖）
 */
export function getAllDeps(moduleId: string, visited = new Set<string>()): string[] {
  if (visited.has(moduleId)) return [];
  visited.add(moduleId);
  const direct = MODULE_DEPENDENCIES[moduleId] || [];
  const all = new Set(direct);
  direct.forEach(d => getAllDeps(d, visited).forEach(a => all.add(a)));
  return Array.from(all);
}

/**
 * 检查选中的模块中是否有缺失的依赖
 * 返回需要自动添加的模块ID列表
 */
export function findMissingDeps(selected: string[]): string[] {
  const missing = new Set<string>();
  for (const m of selected) {
    const deps = getAllDeps(m);
    deps.forEach(d => { if (!selected.includes(d)) missing.add(d); });
  }
  return Array.from(missing);
}

/**
 * 检查取消某个模块会影响哪些已选模块
 * 返回受影响的模块ID列表
 */
export function findAffectedModules(removing: string, selected: string[]): string[] {
  return selected.filter(m =>
    m !== removing && getAllDeps(m).includes(removing)
  );
}

/**
 * 按层级排序模块ID
 */
export function sortByLayer(modules: string[]): string[] {
  return [...modules].sort((a, b) => (MODULE_LAYERS[a] || 99) - (MODULE_LAYERS[b] || 99));
}
