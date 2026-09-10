/** 两侧编辑区的初始示例数据（与旧站 SAMPLE / SAMPLE_B 一致） */

export const SAMPLE_L = JSON.stringify(
  {
    姓名: '示例用户',
    角色: '后端开发',
    技能: ['Go', '区块链', 'DID'],
    工作: { 公司: '示例科技', 部门: '平台研发', 在职: true },
    本周目标: [
      { 事项: '完成 DID 同步服务测试', 状态: '进行中' },
      { 事项: '更新协议文档', 状态: '待办' },
    ],
  },
  null,
  2
);

export const SAMPLE_R = JSON.stringify(
  {
    姓名: '示例用户',
    角色: '后端开发',
    技能: ['Go', '区块链', 'DID', 'SM2'],
    工作: { 公司: '示例科技', 部门: '平台研发', 在职: true },
    本周目标: [
      { 事项: '完成 DID 同步服务测试', 状态: '完成' },
      { 事项: '更新协议文档', 状态: '进行中' },
      { 事项: '设计 httptest 工具', 状态: '待办' },
    ],
  },
  null,
  2
);

export const sampleOf = (side: 'L' | 'R'): string => (side === 'R' ? SAMPLE_R : SAMPLE_L);
