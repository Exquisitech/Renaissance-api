export enum AdminRole {
  SUPER_ADMIN = 'super_admin',
  FINANCIAL_ADMIN = 'financial_admin',
  SUPPORT_ADMIN = 'support_admin',
  RISK_ADMIN = 'risk_admin',
}

export enum Permission {
  // User Management
  VIEW_USERS = 'view_users',
  EDIT_USERS = 'edit_users',
  DELETE_USERS = 'delete_users',
  SUSPEND_USERS = 'suspend_users',

  // Financial Operations
  VIEW_TRANSACTIONS = 'view_transactions',
  PROCESS_WITHDRAWALS = 'process_withdrawals',
  ADJUST_BALANCES = 'adjust_balances',
  VIEW_FINANCIAL_REPORTS = 'view_financial_reports',

  // Risk Management
  VIEW_RISK_METRICS = 'view_risk_metrics',
  SET_BET_LIMITS = 'set_bet_limits',
  EMERGENCY_PAUSE = 'emergency_pause',
  OVERRIDE_LIMITS = 'override_limits',

  // Support Operations
  VIEW_SUPPORT_TICKETS = 'view_support_tickets',
  RESPOND_TO_TICKETS = 'respond_to_tickets',
  VIEW_USER_ACTIVITY = 'view_user_activity',
  RESET_USER_PASSWORD = 'reset_user_password',

  // System Administration
  MANAGE_ADMINS = 'manage_admins',
  VIEW_AUDIT_LOGS = 'view_audit_logs',
  MANAGE_SEASONS = 'manage_seasons',
  MANAGE_SYSTEM_CONFIG = 'manage_system_config',

  // Content Moderation
  MODERATE_CONTENT = 'moderate_content',
  BAN_USERS = 'ban_users',

  // Analytics
  VIEW_ANALYTICS = 'view_analytics',
  EXPORT_DATA = 'export_data',
}
