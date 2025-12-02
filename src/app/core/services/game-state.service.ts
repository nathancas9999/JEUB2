import { Injectable } from '@angular/core';
import { BehaviorSubject, interval, Subject } from 'rxjs';
import { GameState, Company, JobType, EmployeeRole, EmployeeConfig, IngredientStats, BurgerIngredient, FoodtruckUpgrades, DailyStats, FreelanceUpgrades, SetupItem, Employee, UserProfile } from '../../models/game-models';
import { FirebaseService } from './firebase.service';

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
  
  private readonly SAVE_KEY = 'JEUB2_SAVE_V3_ONLINE'; 
  private readonly TICK_RATE_MS = 1000; 
  private readonly HOURS_PER_TICK = 1 / 60; 
  public dayEnded$ = new Subject<DailyStats>();
  
  // NOUVEAU : Indicateur de chargement
  public isLoading$ = new BehaviorSubject<boolean>(true);

  private defaultState: GameState = {
    user: { username: 'Entrepreneur', title: 'Débutant', creationDate: Date.now(), avatarId: '👨‍💼' },
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
    freelanceUpgrades: { chairLevel: 0, screenLevel: 0, coffeeLevel: 0, pcLevel: 0, bossBeaten: 0, contractsCompleted: 0, ownedThemes: ['DEFAULT'], activeThemeId: 'DEFAULT' },
    dailyStats: { revenue: 0, expenses: 0, customersServed: 0, day: 1 },
    quests: [], achievements: [], activeEvents: [],
    lastSavedAt: Date.now(), lastOnlineAt: Date.now(),
    stats: { foodtruckIncome: 0, freelanceIncome: 0, factoryIncome: 0, totalPlayTimeMinutes: 0 }
  } as any;

  private state$ = new BehaviorSubject<GameState>(this.defaultState);
  public gameState$ = this.state$.asObservable();

  constructor(private firebaseService: FirebaseService) {
    // On commence par charger le localstorage pour avoir quelque chose immédiatement
    this.loadLocalState();
    
    interval(this.TICK_RATE_MS).subscribe(() => this.gameLoop());
    interval(60000).subscribe(() => this.saveToCloud());

    this.firebaseService.user$.subscribe(user => {
        if (user) {
            // Si on est déjà dans le jeu (pas sur l'écran titre), on charge en arrière-plan
            // Si on est sur l'écran titre, c'est lui qui gérera le flux
            this.loadCloudDataForUser(user);
        } else {
            // Pas d'user -> Fin du chargement (mode invité par défaut)
            this.isLoading$.next(false);
        }
    });
  }

  // --- NOUVEAU : GESTION CRÉATION COMPTE ---
  
  async checkIfUserHasSave(user: any): Promise<boolean> {
      const save = await this.firebaseService.loadProgress();
      return !!save;
  }

  async initializeNewUser(user: any, username: string) {
      console.log("✨ Initialisation nouveau joueur :", username);
      const cleanState = JSON.parse(JSON.stringify(this.defaultState));
      cleanState.foodtruckMastery = this.initFoodtruckMastery();
      cleanState.lastSavedAt = Date.now();
      
      cleanState.user = {
          username: username,
          title: 'Débutant',
          creationDate: Date.now(),
          avatarId: '👨‍💼'
      };

      this.state$.next(cleanState);
      this.saveLocalState();
      
      await this.firebaseService.saveProgress(cleanState);
      this.isLoading$.next(false);
  }

  // ----------------------------------------

  async loadCloudDataForUser(user: any) {
      this.isLoading$.next(true); // Début chargement
      const cloudSave = await this.firebaseService.loadProgress();
      
      if (cloudSave) {
          console.log("☁️ Sauvegarde chargée.");
          this.state$.next(cloudSave);
          this.saveLocalState();
      } else {
          console.log("🆕 Compte vide (Reload) -> Reset.");
          // Si on est déjà connecté mais qu'il n'y a pas de save, c'est bizarre.
          // On ne fait rien de destructif ici, on laisse l'état par défaut.
      }
      this.isLoading$.next(false); // Fin chargement
  }

  logoutAndClear() {
      localStorage.removeItem(this.SAVE_KEY);
      this.resetToDefaultState(false);
      this.firebaseService.logout().then(() => window.location.reload());
  }

  hardResetGame() {
      if(confirm("Tout effacer ?")) this.resetToDefaultState(true);
  }

  private resetToDefaultState(saveToCloud: boolean) {
      const clean = JSON.parse(JSON.stringify(this.defaultState));
      clean.foodtruckMastery = this.initFoodtruckMastery();
      clean.lastSavedAt = Date.now();
      this.state$.next(clean);
      this.saveLocalState();
      if(saveToCloud) this.saveToCloud();
  }

  updateUsername(newName: string, autoSave = true) {
      const s = this.state$.getValue();
      const currentUser = s.user || this.defaultState.user;
      
      const newUser: UserProfile = { 
          username: newName,
          title: currentUser?.title || 'Débutant',
          avatarId: currentUser?.avatarId,
          holdingId: currentUser?.holdingId,
          creationDate: currentUser?.creationDate || Date.now()
      };

      this.updateState({ user: newUser });
      if(autoSave) { this.saveLocalState(); this.saveToCloud(); }
  }

  // --- ACTIONS ---
  buyPrestigeItem(item: { id: string; name: string; icon: string; cost: number }): boolean {
      const s = this.state$.getValue();
      const id = 'PRESTIGE_' + item.id;
      if (s.achievements.some((a: any) => a.id === id)) return false;
      if (this.spendMoney(item.cost)) {
          const ach = [...s.achievements, { id, name: item.name, icon: item.icon }];
          this.updateState({ achievements: ach });
          this.saveLocalState(); this.saveToCloud();
          return true;
      }
      return false;
  }

  buyFreelanceTheme(themeId: string, cost: number) {
      if (this.spendMoney(cost)) {
          const s = this.state$.getValue();
          const up = { ...s.freelanceUpgrades, ownedThemes: [...s.freelanceUpgrades.ownedThemes, themeId], activeThemeId: themeId };
          this.updateState({ freelanceUpgrades: up });
          this.saveLocalState();
      }
  }

  setFreelanceTheme(themeId: string) {
      const s = this.state$.getValue();
      const up = { ...s.freelanceUpgrades, activeThemeId: themeId };
      this.updateState({ freelanceUpgrades: up });
      this.saveLocalState();
  }

  private createCompany(id: string, type: JobType, name: string, unlocked: boolean, cost: number): Company {
    return { id, type, name, unlocked, unlockCost: cost, level: 1, baseRevenuePerAction: 10, revenuePerSecond: 0, costPerSecond: 0, netProfitPerSecond: 0, employees: [] };
  }
  
  unlockCompany(id: string, cost: number) {
    if (this.spendMoney(cost)) {
      const s = this.state$.getValue();
      this.updateState({ companies: s.companies.map(c => c.id === id ? { ...c, unlocked: true } : c) });
      this.saveLocalState();
    }
  }

  buyFoodtruckUpgrade(type: 'grill' | 'marketing' | 'service', cost: number) {
    if (this.spendMoney(cost)) {
      const s = this.state$.getValue();
      const up = { ...s.foodtruckUpgrades };
      if(type === 'grill') up.grillLevel++; else if(type === 'marketing') up.marketingLevel++; else up.serviceLevel++;
      this.updateState({ foodtruckUpgrades: up });
      this.saveLocalState();
    }
  }

  unlockIngredient(ing: string, cost: number) {
    if (this.spendMoney(cost)) {
        const s = this.state$.getValue();
        const up = { ...s.foodtruckUpgrades, unlockedIngredients: [...s.foodtruckUpgrades.unlockedIngredients, ing] };
        this.updateState({ foodtruckUpgrades: up });
        this.saveLocalState();
    }
  }
  
  unlockKeyboard(cost: number) {
     if (this.spendMoney(cost)) {
        const s = this.state$.getValue();
        const up = { ...s.foodtruckUpgrades, hasKeyboard: true };
        this.updateState({ foodtruckUpgrades: up });
        this.saveLocalState();
     }
  }

  incrementContractsCompleted() {
      const s = this.state$.getValue();
      const up = { ...s.freelanceUpgrades, contractsCompleted: (s.freelanceUpgrades.contractsCompleted || 0) + 1 };
      this.updateState({ freelanceUpgrades: up });
      this.saveLocalState();
  }

  incrementBossBeaten() {
      const s = this.state$.getValue();
      const up = { ...s.freelanceUpgrades, bossBeaten: s.freelanceUpgrades.bossBeaten + 1 };
      this.updateState({ freelanceUpgrades: up });
      this.saveLocalState();
  }

  buySetupUpgrade(item: SetupItem, cost: number) {
      const s = this.state$.getValue();
      let lvl = 0;
      if(item === SetupItem.CHAIR) lvl = s.freelanceUpgrades.chairLevel;
      if(item === SetupItem.SCREEN) lvl = s.freelanceUpgrades.screenLevel;
      if(item === SetupItem.COFFEE) lvl = s.freelanceUpgrades.coffeeLevel;
      if(item === SetupItem.PC) lvl = s.freelanceUpgrades.pcLevel;
      if (lvl >= 1) return;
      if (this.spendMoney(cost)) {
          const up = { ...s.freelanceUpgrades };
          switch(item) {
              case SetupItem.CHAIR: up.chairLevel = 1; break;
              case SetupItem.SCREEN: up.screenLevel = 1; break;
              case SetupItem.COFFEE: up.coffeeLevel = 1; break;
              case SetupItem.PC: up.pcLevel = 1; break;
          }
          this.updateState({ freelanceUpgrades: up });
          this.saveLocalState();
      }
  }

  getEmployeeConfig(role: EmployeeRole) { return EMPLOYEE_CONFIGS[role]; }
  getNextHireCost(companyId: string, role: EmployeeRole): number {
    const c = this.state$.getValue().companies.find(x => x.id === companyId);
    if(!c) return 0;
    return Math.floor(EMPLOYEE_CONFIGS[role].baseCost * Math.pow(1.5, c.employees.filter(e => e.role === role).length));
  }

  hireEmployee(companyId: string, role: EmployeeRole) {
    const cost = this.getNextHireCost(companyId, role);
    if (this.spendMoney(cost)) {
      const s = this.state$.getValue();
      const newEmp: Employee = { id: Math.random().toString(36).substr(2, 9), role, hiredAt: Date.now(), dailySalary: EMPLOYEE_CONFIGS[role].baseDailySalary, efficiency: 1, isPaused: false };
      this.updateState({ companies: s.companies.map(c => c.id === companyId ? { ...c, employees: [...c.employees, newEmp] } : c) });
      this.saveLocalState();
    }
  }

  upgradeEmployeeSetup(companyId: string, empId: string, cost: number) {
    if (this.spendMoney(cost)) {
        const s = this.state$.getValue();
        this.updateState({ companies: s.companies.map(c => c.id === companyId ? { ...c, employees: c.employees.map(e => e.id === empId ? { ...e, efficiency: e.efficiency + 1 } : e) } : c) });
        this.saveLocalState();
    }
  }

  toggleEmployeePause(companyId: string, empId: string) {
      const s = this.state$.getValue();
      this.updateState({ companies: s.companies.map(c => c.id === companyId ? { ...c, employees: c.employees.map(e => e.id === empId ? { ...e, isPaused: !e.isPaused } : e) } : c) });
  }

  getTotalEmployeePower(type: JobType, role: EmployeeRole): number { 
      return this.state$.getValue().companies.find(x => x.type === type)?.employees.filter(e => e.role === role).length || 0;
  }

  addMoney(amount: number) { 
      const s = this.state$.getValue(); 
      const stats = { ...(s.dailyStats || { day: s.day, revenue: 0, expenses: 0, customersServed: 0 }) };
      if (amount > 0) stats.revenue += amount;
      this.updateState({ money: s.money + amount, totalMoneyEarned: amount > 0 ? s.totalMoneyEarned + amount : s.totalMoneyEarned, dailyStats: stats }); 
  }
  
  spendMoney(amount: number): boolean { 
      const s = this.state$.getValue(); 
      if (s.money >= amount) { this.updateState({ money: s.money - amount }); return true; } 
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
                    let gain = 0;
                    if (e.role === EmployeeRole.DEV_JUNIOR) {
                        const chance = 0.05 + (e.efficiency * 0.01); 
                        if (Math.random() < chance) {
                            gain = 100 * e.efficiency;
                        }
                    } 
                    else if (e.role === EmployeeRole.DEV_SENIOR) {
                        const chance = 0.02 + (e.efficiency * 0.005);
                        if (Math.random() < chance) {
                            gain = 1500 * e.efficiency;
                        }
                    }
                    if(gain > 0) {
                        total += gain;
                        const currentStats = s.stats || { foodtruckIncome: 0, freelanceIncome: 0, factoryIncome: 0, totalPlayTimeMinutes: 0 };
                        this.updateState({ stats: { ...currentStats, freelanceIncome: currentStats.freelanceIncome + gain } });
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

  // CORRECTION ICI : updateState en premier, PUIS saveLocalState et SURTOUT saveToCloud
  completeIntro() { 
      const s=this.state$.getValue(); 
      const c=s.companies.map(x=>x.id==='3'?{...x, unlocked:true}:x); 
      
      this.updateState({hasCompletedIntro:true, money:10000, companies:c}); 
      
      this.saveLocalState();
      this.saveToCloud(); // IMPORTANT : On force la sauvegarde cloud ici pour dire "Intro finie"
  }

  setTimeOfDay(t: number) { this.updateState({timeOfDay:t}); }
  unlockIngredientByService(i:string){ const s=this.state$.getValue(); if(!s.foodtruckUpgrades.unlockedIngredients.includes(i)){ const u={...s.foodtruckUpgrades}; u.unlockedIngredients.push(i); this.updateState({foodtruckUpgrades:u}); this.saveLocalState(); }}
  updateMaxServiceReached(l:number){ const s=this.state$.getValue(); if(l>s.foodtruckUpgrades.maxServiceReached){ const u={...s.foodtruckUpgrades, maxServiceReached:l}; this.updateState({foodtruckUpgrades:u}); this.saveLocalState(); }}
  initFoodtruckMastery(): any { const m:any={}; Object.values(BurgerIngredient).forEach(i=>m[i]={level:1,xp:0,xpMax:5}); return m; }
  updateIngredientMastery(m:any) { this.updateState({foodtruckMastery:m}); this.saveLocalState(); }
  incrementCustomersServed() { const s=this.state$.getValue(); const d={...s.dailyStats}; d.customersServed++; this.updateState({dailyStats:d}); }

  private updateState(c:Partial<GameState>) { this.state$.next({...this.state$.getValue(), ...c}); }
  private saveLocalState() { localStorage.setItem(this.SAVE_KEY, JSON.stringify(this.state$.getValue())); }
  private loadLocalState() { 
      const s=localStorage.getItem(this.SAVE_KEY); 
      if(s) { 
          try { 
              const l=JSON.parse(s); 
              this.state$.next({...this.defaultState, ...l}); 
              this.isLoading$.next(false); // On a chargé quelque chose, on arrête le loading
          } catch(e) {} 
      } 
  }

  async saveToCloud() {
      const s = this.state$.getValue();
      const user = this.firebaseService.authInstance.currentUser;
      
      // Ne pas sauvegarder si on n'a rien à sauvegarder (compte anonyme vide)
      if (user?.isAnonymous && (!s.hasCompletedIntro || s.totalMoneyEarned <= 2000)) return;

      const stats = s.stats || { foodtruckIncome: 0, freelanceIncome: 0, factoryIncome: 0, totalPlayTimeMinutes: 0 };
      const updatedStats = { ...stats, totalPlayTimeMinutes: (stats.totalPlayTimeMinutes || 0) + 1 };
      
      // On update le state local pour le temps de jeu
      this.updateState({ stats: updatedStats });
      
      // On envoie
      await this.firebaseService.saveProgress({ ...s, stats: updatedStats });
  }

  async connectOnline() {
      if (!this.firebaseService.authInstance.currentUser) await this.firebaseService.loginAnonymous();
  }
}