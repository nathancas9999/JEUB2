import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { map, filter, take } from 'rxjs/operators';
import { GameStateService } from '../../core/services/game-state.service';
import { SoundService } from '../../core/services/sound.service';
import { GameState, Company, JobType, EmployeeRole, DailyStats, SetupItem, FoodtruckUpgrades } from '../../models/game-models';

interface PrestigeItem { id: string; name: string; icon: string; cost: number; desc: string; }

// On définit les thèmes ici aussi pour les afficher dans le shop
const IDE_THEMES = [
    { id: 'DEFAULT', name: 'VS Code Dark', cost: 0, bgClass: 'bg-[#1e1e1e]', textClass: 'text-slate-200' },
    { id: 'MATRIX', name: 'The Matrix', cost: 2500, bgClass: 'bg-black', textClass: 'text-green-500 font-mono' },
    { id: 'DRACULA', name: 'Dracula', cost: 5000, bgClass: 'bg-[#282a36]', textClass: 'text-[#f8f8f2]' },
    { id: 'SOLARIZED', name: 'Solarized Light', cost: 10000, bgClass: 'bg-[#fdf6e3]', textClass: 'text-[#657b83]' }
];

@Component({
  selector: 'app-game-shell',
  standalone: false,
  templateUrl: './game-shell.component.html'
})
export class GameShellComponent implements OnInit {
  
  gameState$: Observable<GameState>; 
  selectedCompany: Company | null = null;
  dailyReport: DailyStats | null = null;
  
  isGlobalShopOpen = false;
  isAdminOpen = false;
  
  JobType = JobType;
  SetupItem = SetupItem;
  
  // Exposer la liste pour le HTML
  availableThemes = IDE_THEMES;

  prestigeItems: PrestigeItem[] = [
    { id: 'WATCH', name: 'Rolex en Or', icon: '⌚', cost: 5000, desc: 'Le temps c\'est de l\'argent.' },
    { id: 'CAR', name: 'Tesla Model S', icon: '🚗', cost: 45000, desc: 'Zéro émission, 100% style.' },
    { id: 'APARTMENT', name: 'Penthouse', icon: '🏢', cost: 250000, desc: 'Vue sur tout ton empire.' },
    { id: 'ISLAND', name: 'Île Privée', icon: '🏝️', cost: 5000000, desc: 'La retraite anticipée.' }
  ];

  constructor(private gameStateService: GameStateService, private soundService: SoundService) {
    this.gameState$ = this.gameStateService.gameState$;
  }

  ngOnInit() {
    this.gameState$.pipe(
      map(state => state.companies.find(c => c.unlocked)), 
      filter(c => !!c), 
      take(1)
    ).subscribe(c => {
      if (!this.selectedCompany && c) {
        this.selectedCompany = c;
      }
    });

    this.gameStateService.dayEnded$.subscribe(stats => {
       this.dailyReport = stats;
       this.soundService.playSuccess();
    });
  }

  toggleGlobalShop() {
    this.isGlobalShopOpen = !this.isGlobalShopOpen;
    if (this.isGlobalShopOpen) this.soundService.playSoftPop();
  }

  // --- LOGIQUE THÈMES ---
  isThemeOwned(state: GameState, themeId: string): boolean {
      return state.freelanceUpgrades.ownedThemes.includes(themeId);
  }

  isActiveTheme(state: GameState, themeId: string): boolean {
      return state.freelanceUpgrades.activeThemeId === themeId;
  }

  buyOrEquipTheme(theme: any) {
      this.gameState$.pipe(take(1)).subscribe(state => {
          if (this.isThemeOwned(state, theme.id)) {
              // Si possédé, on équipe
              this.gameStateService.setFreelanceTheme(theme.id);
              this.soundService.playSoftPop();
          } else {
              // Sinon on achète
              if (state.money >= theme.cost) {
                  this.gameStateService.buyFreelanceTheme(theme.id, theme.cost);
                  this.soundService.playSuccess();
              } else {
                  this.soundService.playError();
              }
          }
      });
  }

  // --- LOGIQUE ADMIN ---
  toggleAdmin() {
    this.isAdminOpen = !this.isAdminOpen;
  }

  adminAddMoney(amount: number) {
    this.gameStateService.addMoney(amount);
    this.soundService.playCash();
  }

  adminSetTime(event: any) {
    const val = parseFloat(event.target.value);
    if (!isNaN(val) && val >= 0 && val <= 24) {
      this.gameStateService.setTimeOfDay(val);
    }
  }

  // --- ACHATS FREELANCE ---
  buySetup(item: string) {
    const cost = this.getSetupCost(item);
    this.gameState$.pipe(take(1)).subscribe(state => {
       if (state.money >= cost) {
         this.gameStateService.buySetupUpgrade(item as SetupItem, cost);
         this.soundService.playSuccess();
       } else {
         this.soundService.playError();
       }
    });
  }

  getSetupCost(item: string): number {
     return { CHAIR: 2000, SCREEN: 5000, COFFEE: 1500, PC: 20000 }[item] || 0;
  }

  getSetupLevel(state: GameState, item: string): number {
     if (!state.freelanceUpgrades) return 0;
     switch(item) {
       case 'CHAIR': return state.freelanceUpgrades.chairLevel;
       case 'SCREEN': return state.freelanceUpgrades.screenLevel;
       case 'COFFEE': return state.freelanceUpgrades.coffeeLevel;
       case 'PC': return state.freelanceUpgrades.pcLevel;
       default: return 0;
     }
  }

  // --- ACHATS FOODTRUCK ---
  getFoodtruckLevel(state: GameState, type: string): number {
      if (!state.foodtruckUpgrades) return 1;
      return (state.foodtruckUpgrades as any)[type + 'Level'] || 1;
  }

  getFoodtruckCost(state: GameState, type: string): number {
      const lvl = this.getFoodtruckLevel(state, type);
      return Math.floor(150 * Math.pow(1.6, lvl));
  }

  buyFoodtruck(type: 'grill' | 'marketing' | 'service') {
      this.gameState$.pipe(take(1)).subscribe(state => {
          const cost = this.getFoodtruckCost(state, type);
          if (state.money >= cost) {
              this.gameStateService.buyFoodtruckUpgrade(type, cost);
              this.soundService.playSuccess();
          } else {
              this.soundService.playError();
          }
      });
  }

  buyKeyboard() {
      this.gameState$.pipe(take(1)).subscribe(state => {
          if (state.money >= 5000 && !state.foodtruckUpgrades.hasKeyboard) {
              this.gameStateService.unlockKeyboard(5000);
              this.soundService.playSuccess();
          } else {
              this.soundService.playError();
          }
      });
  }

  // --- ACHATS PRESTIGE ---
  hasPrestigeItem(state: GameState, id: string): boolean {
      return state.achievements.some((a: any) => a.id === 'PRESTIGE_' + id);
  }

  buyPrestige(item: PrestigeItem) {
      this.gameState$.pipe(take(1)).subscribe(state => {
          if (this.hasPrestigeItem(state, item.id)) return; 

          if (state.money >= item.cost) {
              this.gameStateService.spendMoney(item.cost); 
              const newAch = [...state.achievements, { id: 'PRESTIGE_' + item.id, name: item.name, icon: item.icon }];
              // @ts-ignore
              this.gameStateService.updateState({ achievements: newAch });
              this.gameStateService['saveState']();
              this.soundService.playSuccess();
          } else {
              this.soundService.playError();
          }
      });
  }
  
  getMyPrestigeItems(state: GameState): any[] {
      return state.achievements.filter((a: any) => a.id.startsWith('PRESTIGE_'));
  }

  getUnlockCost(type: JobType): number {
    switch (type) {
      case JobType.FREELANCE_DEV: return 10; 
      case JobType.FACTORY: return 50;       
      case JobType.CLOTHING_STORE: return 25;
      default: return 0;
    }
  }

  buyCompany(company: Company) {
    const cost = this.getUnlockCost(company.type);
    if (cost > 0) {
      this.gameStateService.unlockCompany(company.id, cost);
      this.soundService.playSuccess();
    }
  }

  closeReport() { this.dailyReport = null; }

  selectCompany(c: Company) {
    if (c.unlocked) {
      this.gameState$.subscribe(state => {
        const freshVersion = state.companies.find(x => x.id === c.id);
        if (freshVersion && this.selectedCompany?.id === freshVersion.id) {
           this.selectedCompany = freshVersion;
        }
      });
      this.selectedCompany = c;
      this.soundService.playSoftPop();
    }
  }

  formatTime(decimalTime: number): string {
    const hours = Math.floor(decimalTime);
    const minutes = Math.floor((decimalTime - hours) * 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  resetData() {
    if (confirm('⚠️ ATTENTION : Cela va effacer toute ta progression. Sûr ?')) {
      this.gameStateService.resetGame();
    }
  }
}