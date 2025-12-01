export enum JobType {
  CLOTHING_STORE = 'CLOTHING_STORE',
  FREELANCE_DEV = 'FREELANCE_DEV',
  WEB_AGENCY = 'WEB_AGENCY',
  FOODTRUCK = 'FOODTRUCK',
  FACTORY = 'FACTORY'
}

export enum EmployeeRole {
  CASHIER = 'CASHIER', STOCK_MANAGER = 'STOCK_MANAGER',
  DEV_JUNIOR = 'DEV_JUNIOR', DEV_SENIOR = 'DEV_SENIOR',
  COOK = 'COOK', SERVER = 'SERVER',
  WORKER = 'WORKER', LINE_MANAGER = 'LINE_MANAGER'
}

export interface EmployeeConfig {
  role: EmployeeRole; name: string; baseCost: number; costFactor: number;
  baseDailySalary: number; salaryFactor: number; baseEfficiency: number;
  efficiencyFactor: number; description: string;
}

export interface Employee {
  id: string; role: EmployeeRole; hiredAt: number; dailySalary: number; efficiency: number;
  isPaused?: boolean;
}

export interface Company {
  id: string; type: JobType; name: string; level: number; unlocked: boolean;
  unlockCost: number; baseRevenuePerAction: number; revenuePerSecond: number; 
  costPerSecond: number; netProfitPerSecond: number; employees: Employee[];
}

export interface IngredientStats { level: number; xp: number; xpMax: number; }
export interface UserProfile { username: string; title: string; }
export interface DailyStats { day: number; revenue: number; expenses: number; customersServed: number; }

export interface FoodtruckUpgrades {
  grillLevel: number; marketingLevel: number; serviceLevel: number; 
  unlockedIngredients: string[]; maxServiceReached: number; hasKeyboard: boolean;
}

export enum SetupItem { CHAIR = 'CHAIR', SCREEN = 'SCREEN', COFFEE = 'COFFEE', PC = 'PC' }

export interface FreelanceUpgrades {
  chairLevel: number; screenLevel: number; coffeeLevel: number; pcLevel: number;
  bossBeaten: number; contractsCompleted: number;
  // NOUVEAU : Sauvegarde des thèmes
  ownedThemes: string[];
  activeThemeId: string;
}

export interface GameState {
  user: UserProfile | null;
  money: number; gems: number; totalMoneyEarned: number;
  hasCompletedIntro: boolean; tutoFlags: { foodtruckIntroSeen: boolean; };
  day: number; timeOfDay: number;
  companies: Company[]; employees: Employee[];
  foodtruckMastery: Record<string, IngredientStats>;
  foodtruckUpgrades: FoodtruckUpgrades;
  freelanceUpgrades: FreelanceUpgrades;
  dailyStats: DailyStats;
  quests: any[]; achievements: any[]; activeEvents: any[];
  lastSavedAt: number; lastOnlineAt: number;
}

export enum BurgerIngredient {
  BUN = 'BUN', STEAK = 'STEAK', CHEESE = 'CHEESE', SALAD = 'SALAD',
  TOMATO = 'TOMATO', SAUCE = 'SAUCE', ONION = 'ONION', PICKLE = 'PICKLE', BACON = 'BACON'
}