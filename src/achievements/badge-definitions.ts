export type BadgeTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'DIAMOND';
export type BadgeCategory = 'MILESTONE' | 'STREAK' | 'SAVINGS' | 'SPEED';

export interface BadgeDefinition {
  key: string;
  title: string;
  description: string;
  emoji: string;
  category: BadgeCategory;
  tier: BadgeTier;
}

export const BADGE_CATALOG: BadgeDefinition[] = [
  // ── MILESTONES ──
  { key: 'FIRST_LOAN_ADDED', title: 'First Step', description: 'Added your first loan', emoji: '👣', category: 'MILESTONE', tier: 'BRONZE' },
  { key: 'THREE_LOANS_TRACKED', title: 'Portfolio Manager', description: 'Tracking 3+ loans', emoji: '📋', category: 'MILESTONE', tier: 'SILVER' },
  { key: 'FIRST_LOAN_CLOSED', title: 'Debt Slayer', description: 'Closed your first loan completely', emoji: '⚔️', category: 'MILESTONE', tier: 'GOLD' },
  { key: 'ALL_LOANS_CLOSED', title: 'Freedom Champion', description: 'All loans fully paid off!', emoji: '🏆', category: 'MILESTONE', tier: 'DIAMOND' },

  // ── STREAKS ──
  { key: 'EMI_STREAK_3', title: 'Hat-trick', description: '3 consecutive on-time EMIs', emoji: '🎯', category: 'STREAK', tier: 'BRONZE' },
  { key: 'EMI_STREAK_6', title: 'Half-Year Hero', description: '6 consecutive on-time EMIs', emoji: '🔥', category: 'STREAK', tier: 'SILVER' },
  { key: 'EMI_STREAK_12', title: 'Year of Discipline', description: '12 consecutive on-time EMIs', emoji: '💎', category: 'STREAK', tier: 'GOLD' },

  // ── SAVINGS ──
  { key: 'SAVED_10K', title: 'Smart Saver', description: 'Saved ₹10,000+ in interest', emoji: '💰', category: 'SAVINGS', tier: 'BRONZE' },
  { key: 'SAVED_50K', title: 'Wealth Guardian', description: 'Saved ₹50,000+ in interest', emoji: '🏦', category: 'SAVINGS', tier: 'SILVER' },
  { key: 'SAVED_1L', title: 'Lakh Saver', description: 'Saved ₹1,00,000+ in interest', emoji: '🚀', category: 'SAVINGS', tier: 'GOLD' },

  // ── SPEED ──
  { key: 'FIRST_PREPAYMENT', title: 'Accelerator', description: 'Made your first prepayment', emoji: '⚡', category: 'SPEED', tier: 'BRONZE' },
  { key: 'PROFILE_COMPLETE', title: 'All Set', description: 'Completed your full profile setup', emoji: '✅', category: 'SPEED', tier: 'BRONZE' },
  { key: 'STRATEGY_ACTIVATED', title: 'Strategist', description: 'Activated a payoff strategy', emoji: '🧠', category: 'SPEED', tier: 'SILVER' },
  { key: 'APP_OPENED_7_DAYS', title: 'Committed', description: 'Opened Nimmadhi 7 days in a row', emoji: '📱', category: 'SPEED', tier: 'GOLD' },
];
