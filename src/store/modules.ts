export interface ModuleMeta {
  id: string;
  name: string;
  desc: string;
}

export const MODULES: ModuleMeta[] = [
  { id: 'M2', name: '平台合规审查', desc: '对标抖音/快手/红果等主流平台审核标准' },
  { id: 'M16', name: '多平台商业适配', desc: '根据目标平台（抖音/快手/红果等）提供定制化建议' },
];
