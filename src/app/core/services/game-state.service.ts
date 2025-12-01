import { Injectable } from '@angular/core';
import { BehaviorSubject, interval, Subject } from 'rxjs';
import { GameState, Company, JobType, EmployeeRole, EmployeeConfig, IngredientStats, BurgerIngredient, FoodtruckUpgrades, DailyStats, FreelanceUpgrades, SetupItem, Employee } from '../../models/game-models';

const EMPLOYEE_CONFIGS: Record<EmployeeRole, EmployeeConfig> = {
  [EmployeeRole.DEV_JUNIOR]: { role: EmployeeRole.DEV_JUNIOR, name: 'Stagiaire', baseCost: 2000, costFactor: 1.5, baseDailySalary: 100, salaryFactor: 1.2, baseEfficiency: 1, efficiencyFactor: 1.2, description: 'Code lentement' },
  [EmployeeRole.DEV_SENIOR]: { role: EmployeeRole.DEV_SENIOR, name: 'Lead Dev', baseCost: 10000, costFactor: 1.6, baseDailySalary: 800, salaryFactor: 1.3, baseEfficiency: 4, efficiencyFactor: 1.4, description: 'Code très vite + Bonus' },
  [EmployeeRole.COOK]: { role: EmployeeRole.COOK, name: 'Cuisinier', baseCost: 500, costFactor: 1.55, baseDailySalary: 50, salaryFactor: 1.2, baseEfficiency: 1, efficiencyFactor: 1.1, description: 'Cuisine' },
  [EmployeeRole.SERVER]: { role: EmployeeRole.SERVER, name: 'Serveur', baseCost: 300, costFactor: 1.6, baseDailySalary: 40, salaryFactor: 1.15, baseEfficiency: 5, efficiencyFactor: 1.05, description: 'Service' },
  [EmployeeRole.CASHIER]: { role: EmployeeRole.CASHIER, name: 'Caissier', baseCost: 200, costFactor: 1.4, baseDailySalary: 30, salaryFactor: 1.1, baseEfficiency: 1, efficiencyFactor: 1.1, description: 'Caisse' },
  [EmployeeRole.STOCK_MANAGER]: { role: EmployeeRole.STOCK_MANAGER, name: 'Stock', baseCost: 500, costFactor: 1.4, baseDailySalary: 60, salaryFactor: 1.1, baseEfficiency: 1, efficiencyFactor: 1.1, description: 'Stock' },
  [EmployeeRole.WORKER]: { role: EmployeeRole.WORKER, name: 'Ouvrier', baseCost: 2000, costFactor: 1.4, baseDailySalary: 200, salaryFactor: 1.1, baseEfficiency: 1, efficiencyFactor: 1.1, description: 'Prod' },
  [EmployeeRole.LINE_MANAGER]: { role: EmployeeRole.LINE_MANAGER, name: 'Chef', baseCost: 10000, costFactor: 1.5, baseDailySalary: 1000, salaryFactor: 1.2, baseEfficiency: 1, efficiencyFactor: 1.2, description: 'Supervision' },
};

@Injectable({ providedIn: 'root' })
export class GameStateService {
  
  private readonly SAVE_KEY = 'JEUB2_SAVE_REPAIR_V2_THEMES'; 
  private readonly TICK_RATE_MS = 1000; 
  private readonly HOURS_PER_TICK = 1 / 60; 
  public dayEnded$ = new Subject<DailyStats>();

  private defaultState: GameState = {
    user: { username: 'Entrepreneur', title: 'Débutant' },
    money: 2000, gems: 0, totalMoneyEarned: 0, hasCompletedIntro: false,
    tutoFlags: { foodtruckIntroSeen: false },
    day: 1, timeOfDay: 6.0, 
    companies: [
      this.createCompany('1', JobType.CLOTHING_STORE, 'Friperie Cool', true, 0),
      this.createCompany('2', JobType.FREELANCE_DEV, 'Agence Web', false, 1000),
      this.createCompany('3', JobType.FOODTRUCK, 'Burger Truck', false, 5000),
      this.createCompany('4', JobType.FACTORY, 'Usine Tesla', false, 20000)
    ],
    employees: [],
    foodtruckMastery: this.initFoodtruckMastery(),
    foodtruckUpgrades: { grillLevel: 1, marketingLevel: 1, serviceLevel: 1, unlockedIngredients: [BurgerIngredient.BUN, BurgerIngredient.STEAK], maxServiceReached: 1, hasKeyboard: false },
    // NOUVEAU : Initialisation des thèmes
    freelanceUpgrades: { chairLevel: 0, screenLevel: 0, coffeeLevel: 0, pcLevel: 0, bossBeaten: 0, contractsCompleted: 0, ownedThemes: ['DEFAULT'], activeThemeId: 'DEFAULT' },
    dailyStats: { revenue: 0, expenses: 0, customersServed: 0, day: 1 },
    quests: [], achievements: [], activeEvents: [],
    lastSavedAt: Date.now(), lastOnlineAt: Date.now()
  } as any;

  private state$ = new BehaviorSubject<GameState>(this.defaultState);
  public gameState$ = this.state$.asObservable();

  constructor() {
    this.loadState();
    interval(this.TICK_RATE_MS).subscribe(() => this.gameLoop());
    interval(10000).subscribe(() => this.saveState());
  }

  // --- NOUVEAU : GESTION DES THÈMES ---
  buyFreelanceTheme(themeId: string, cost: number) {
      if (this.spendMoney(cost)) {
          const s = this.state$.getValue();
          const up = { ...s.freelanceUpgrades };
          if (!up.ownedThemes.includes(themeId)) {
              up.ownedThemes = [...up.ownedThemes, themeId];
              // On l'équipe automatiquement à l'achat
              up.activeThemeId = themeId;
              this.updateState({ freelanceUpgrades: up });
              this.saveState();
          }
      }
  }

  setFreelanceTheme(themeId: string) {
      const s = this.state$.getValue();
      const up = { ...s.freelanceUpgrades };
      if (up.ownedThemes.includes(themeId)) {
          up.activeThemeId = themeId;
          this.updateState({ freelanceUpgrades: up });
          this.saveState();
      }
  }

  // ... (Code existant inchangé pour les autres méthodes)
  
  private createCompany(id: string, type: JobType, name: string, unlocked: boolean, cost: number): Company {
    return { id, type, name, unlocked, unlockCost: cost, level: 1, baseRevenuePerAction: 10, revenuePerSecond: 0, costPerSecond: 0, netProfitPerSecond: 0, employees: [] };
  }
  
  unlockCompany(companyId: string, cost: number) {
    if (this.spendMoney(cost)) {
      const state = this.state$.getValue();
      const updatedCompanies = state.companies.map(c => c.id === companyId ? { ...c, unlocked: true } : c);
      this.updateState({ companies: updatedCompanies });
      this.saveState();
    }
  }

  buyFoodtruckUpgrade(type: 'grill' | 'marketing' | 'service', cost: number) {
    if (this.spendMoney(cost)) {
      const state = this.state$.getValue();
      const upgrades = { ...state.foodtruckUpgrades };
      if (type === 'grill') upgrades.grillLevel++;
      if (type === 'marketing') upgrades.marketingLevel++;
      if (type === 'service') upgrades.serviceLevel++;
      this.updateState({ foodtruckUpgrades: upgrades });
      this.saveState();
    }
  }

  unlockIngredient(ingredient: string, cost: number) {
    if (this.spendMoney(cost)) {
        const state = this.state$.getValue();
        const upgrades = { ...state.foodtruckUpgrades };
        if (!upgrades.unlockedIngredients.includes(ingredient)) {
            upgrades.unlockedIngredients.push(ingredient);
            this.updateState({ foodtruckUpgrades: upgrades });
            this.saveState();
        }
    }
  }
  
  unlockKeyboard(cost: number) {
     if (this.spendMoney(cost)) {
        const state = this.state$.getValue();
        const upgrades = { ...state.foodtruckUpgrades, hasKeyboard: true };
        this.updateState({ foodtruckUpgrades: upgrades });
        this.saveState();
     }
  }

  incrementContractsCompleted() {
      const state = this.state$.getValue();
      const up = { ...state.freelanceUpgrades };
      up.contractsCompleted = (up.contractsCompleted || 0) + 1;
      this.updateState({ freelanceUpgrades: up });
      this.saveState();
  }

  incrementBossBeaten() {
      const state = this.state$.getValue();
      const up = { ...state.freelanceUpgrades };
      up.bossBeaten++;
      this.updateState({ freelanceUpgrades: up });
      this.saveState();
  }

  buySetupUpgrade(item: SetupItem, cost: number) {
      const state = this.state$.getValue();
      let lvl = 0;
      if(item === SetupItem.CHAIR) lvl = state.freelanceUpgrades.chairLevel;
      if(item === SetupItem.SCREEN) lvl = state.freelanceUpgrades.screenLevel;
      if(item === SetupItem.COFFEE) lvl = state.freelanceUpgrades.coffeeLevel;
      if(item === SetupItem.PC) lvl = state.freelanceUpgrades.pcLevel;
      if (lvl >= 1) return;
      if (this.spendMoney(cost)) {
          const up = { ...state.freelanceUpgrades };
          switch(item) {
              case SetupItem.CHAIR: up.chairLevel = 1; break;
              case SetupItem.SCREEN: up.screenLevel = 1; break;
              case SetupItem.COFFEE: up.coffeeLevel = 1; break;
              case SetupItem.PC: up.pcLevel = 1; break;
          }
          this.updateState({ freelanceUpgrades: up });
          this.saveState();
      }
  }

  getEmployeeConfig(role: EmployeeRole) { return EMPLOYEE_CONFIGS[role]; }
  
  hireEmployee(companyId: string, role: EmployeeRole) {
    const cost = this.getNextHireCost(companyId, role);
    if (this.spendMoney(cost)) {
      const state = this.state$.getValue();
      const newEmp: Employee = { id: Math.random().toString(36).substr(2, 9), role, hiredAt: Date.now(), dailySalary: EMPLOYEE_CONFIGS[role].baseDailySalary, efficiency: 1, isPaused: false };
      const updatedCompanies = state.companies.map(c => c.id === companyId ? { ...c, employees: [...c.employees, newEmp] } : c);
      this.updateState({ companies: updatedCompanies });
      this.saveState();
    }
  }

  upgradeEmployeeSetup(companyId: string, employeeId: string, cost: number) {
    if (this.spendMoney(cost)) {
      const state = this.state$.getValue();
      const updatedCompanies = state.companies.map(c => c.id === companyId ? { ...c, employees: c.employees.map(e => e.id === employeeId ? { ...e, efficiency: e.efficiency + 1 } : e) } : c);
      this.updateState({ companies: updatedCompanies });
      this.saveState();
    }
  }

  toggleEmployeePause(companyId: string, employeeId: string) {
      const state = this.state$.getValue();
      const updatedCompanies = state.companies.map(c => c.id === companyId ? { ...c, employees: c.employees.map(e => e.id === employeeId ? { ...e, isPaused: !e.isPaused } : e) } : c);
      this.updateState({ companies: updatedCompanies });
  }

  getNextHireCost(companyId: string, role: EmployeeRole): number {
    const state = this.state$.getValue();
    const company = state.companies.find(x => x.id === companyId);
    if(!company) return 0;
    const count = company.employees.filter(e => e.role === role).length;
    return Math.floor(EMPLOYEE_CONFIGS[role].baseCost * Math.pow(1.5, count));
  }
  
  getTotalEmployeePower(type: JobType, role: EmployeeRole): number { 
      const s = this.state$.getValue();
      const c = s.companies.find(x => x.type === type);
      if (!c) return 0;
      return c.employees.filter(e => e.role === role).length;
  }

  addMoney(amount: number) { 
      const state = this.state$.getValue(); 
      const stats = { ...(state.dailyStats || { day: state.day, revenue: 0, expenses: 0, customersServed: 0 }) };
      if (amount > 0) stats.revenue += amount;
      this.updateState({ money: state.money + amount, totalMoneyEarned: amount > 0 ? state.totalMoneyEarned + amount : state.totalMoneyEarned, dailyStats: stats }); 
  }
  
  spendMoney(amount: number): boolean { 
      const state = this.state$.getValue(); 
      if (state.money >= amount) { this.updateState({ money: state.money - amount }); return true; } 
      return false; 
  }

  private gameLoop() {
    const s = this.state$.getValue();
    if (!s.hasCompletedIntro) return;
    let t = s.timeOfDay + this.HOURS_PER_TICK; let d = s.day; let ds = { ...(s.dailyStats || { day: s.day, revenue: 0, expenses: 0, customersServed: 0 }) };

    if (t >= 24) { 
      t = 0; let salaries = 0;
      s.companies.forEach(c => { c.employees.forEach(e => { salaries += e.dailySalary; }); });
      if (salaries > 0) { this.addMoney(-salaries); ds.expenses += salaries; }
      this.dayEnded$.next({ ...ds, day: s.day });
      d++; ds = { day: d, revenue: 0, expenses: 0, customersServed: 0 };
    }
    this.updateState({ day: d, timeOfDay: t, dailyStats: ds });
    this.tickPassiveIncome();
  }

  private tickPassiveIncome() {
    const s = this.state$.getValue();
    let total = 0;
    
    s.companies.forEach(c => {
       if (c.unlocked && c.employees.length > 0) {
           if (c.type === JobType.FREELANCE_DEV) {
               c.employees.forEach(e => { 
                 if (!e.isPaused) {
                    if (e.role === EmployeeRole.DEV_JUNIOR) {
                        const chance = 0.05 + (e.efficiency * 0.01); 
                        if (Math.random() < chance) {
                            total += 100 * e.efficiency; 
                        }
                    } 
                    else if (e.role === EmployeeRole.DEV_SENIOR) {
                        const chance = 0.02 + (e.efficiency * 0.005);
                        if (Math.random() < chance) {
                            total += 1500 * e.efficiency; 
                        }
                    }
                 }
               });
           } 
           else {
               total += (c.netProfitPerSecond / 10);
           }
       }
    });

    if (total > 0) {
        this.addMoney(total);
    }
  }

  resetGame() { localStorage.removeItem(this.SAVE_KEY); window.location.reload(); }
  completeIntro() { const s=this.state$.getValue(); const c=s.companies.map(x=>x.id==='3'?{...x, unlocked:true}:x); this.updateState({hasCompletedIntro:true, money:10000, companies:c}); this.saveState(); }
  setTimeOfDay(t: number) { this.updateState({timeOfDay:t}); }
  unlockIngredientByService(i:string){ const s=this.state$.getValue(); if(!s.foodtruckUpgrades.unlockedIngredients.includes(i)){ const u={...s.foodtruckUpgrades}; u.unlockedIngredients.push(i); this.updateState({foodtruckUpgrades:u}); this.saveState(); }}
  updateMaxServiceReached(l:number){ const s=this.state$.getValue(); if(l>s.foodtruckUpgrades.maxServiceReached){ const u={...s.foodtruckUpgrades, maxServiceReached:l}; this.updateState({foodtruckUpgrades:u}); this.saveState(); }}
  initFoodtruckMastery(): any { const m:any={}; Object.values(BurgerIngredient).forEach(i=>m[i]={level:1,xp:0,xpMax:5}); return m; }
  updateIngredientMastery(m:any) { this.updateState({foodtruckMastery:m}); this.saveState(); }
  incrementCustomersServed() { const s=this.state$.getValue(); const d={...s.dailyStats}; d.customersServed++; this.updateState({dailyStats:d}); }

  private updateState(c:Partial<GameState>) { this.state$.next({...this.state$.getValue(), ...c}); }
  private saveState() { localStorage.setItem(this.SAVE_KEY, JSON.stringify(this.state$.getValue())); }
  private loadState() { 
      const s=localStorage.getItem(this.SAVE_KEY); 
      if(s) { 
          try { 
              const l=JSON.parse(s); 
              const m={...this.defaultState, ...l}; 
              if(!m.freelanceUpgrades) m.freelanceUpgrades=this.defaultState.freelanceUpgrades;
              // Migration de sauvegarde
              if(!m.freelanceUpgrades.ownedThemes) {
                  m.freelanceUpgrades.ownedThemes = ['DEFAULT'];
                  m.freelanceUpgrades.activeThemeId = 'DEFAULT';
              }
              this.state$.next(m); 
          } catch(e) { console.error(e); } 
      } 
  }
}