export const Messages = {
  FRONTEND_ACTIVITY_SAVED: '活动记录已同步到碳账本',
  FRONTEND_GOAL_SAVED: '减排目标已更新',
  FRONTEND_PROFILE_SAVED: '个人资料已保存',
  FRONTEND_FACTOR_REQUIRED: '请先选择匹配的排放因子',
  FRONTEND_ORG_CREATED: '组织已创建，创建者已成为组织管理员',
  FRONTEND_ORG_REDEEMED: '邀请码兑换成功，已归属组织',
  FRONTEND_ORG_LEFT: '已退出组织，归属期内的活动保留在组织历史',
  FRONTEND_ORG_INVITE_ISSUED: '一次性邀请码已签发',
  FRONTEND_ORG_MEMBER_REMOVED: '成员已移出，其归属期内活动保留在组织历史',
  LOG_ORG_WINDOWS: 'OrganizationInviteStatus/OrganizationMemberRole affects invite badges, member tables, logs and errors',
  BACKEND_SHARED_COPY: '前后端耦合文案：修改文案时需要同步后端 constants/messages.ts',
  LOG_ACTIVITY_CATEGORY: 'ActivityCategory affects filters, chart legends, logs and errors',
  LOG_GOAL_STATUS: 'GoalStatus affects list badges, progress cards, logs and errors'
} as const;

