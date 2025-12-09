import { Component, OnInit } from '@angular/core';
import { Observable, interval } from 'rxjs';
import { map, filter, take } from 'rxjs/operators';
import { GameStateService } from '../../core/services/game-state.service';
import { SoundService } from '../../core/services/sound.service';
import { FirebaseService, MarketItem } from '../../core/services/firebase.service';
import { GameState, Company, JobType, DailyStats, SetupItem, Holding, EmployeeRole } from '../../models/game-models';
import { IDE_THEMES, IdeTheme } from '../../core/config/themes.config';

interface PrestigeItem { id: string; name: string; icon: string; cost: number; desc: string; }

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
  isOnlineTabOpen = false;
  
  // MODIFICATION : Ajout de 'PROFILE' dans les onglets possibles
  activeTab: 'LEADERBOARD' | 'MARKET' | 'GUILD' | 'PROFILE' = 'LEADERBOARD';
  selectedPlayer: any = null; 
  tickerMessages: string[] = ["Bienvenue sur le marché mondial !", "Le Bitcoin est en chute libre...", "Qui sera le prochain CEO de l'année ?"];
  tickerIndex = 0;
  
  newUsername = '';
  newHoldingName = ''; 
  
  JobType = JobType;
  SetupItem = SetupItem;
  availableThemes = IDE_THEMES;

  leaderboard: any[] = [];
  marketItems: MarketItem[] = [];
  holdings: Holding[] = [];

  prestigeItems: PrestigeItem[] = [
    { id: 'WATCH', name: 'Rolex en Or', icon: '⌚', cost: 5000, desc: 'Le temps c\'est de l\'argent.' },
    { id: 'CAR', name: 'Tesla Model S', icon: '🚗', cost: 45000, desc: 'Zéro émission, 100% style.' },
    { id: 'APARTMENT', name: 'Penthouse', icon: '🏢', cost: 250000, desc: 'Vue sur tout ton empire.' },
    { id: 'ISLAND', name: 'Île Privée', icon: '🏝️', cost: 5000000, desc: 'La retraite anticipée.' }
  ];

  constructor(
      public gameStateService: GameStateService, 
      private soundService: SoundService,
      public firebaseService: FirebaseService
  ) {
    this.gameState$ = this.gameStateService.gameState$;
  }

  ngOnInit() {
    this.gameState$.pipe(
      map(state => state.companies.find(c => c.unlocked)), 
      filter(c => !!c), 
      take(1)
    ).subscribe(c => {
      if (!this.selectedCompany && c) this.selectedCompany = c;
    });

    // MODIFICATION : On initialise le champ d'édition avec le pseudo actuel
    this.gameState$.subscribe(state => {
        if (state.user && !this.newUsername) {
            this.newUsername = state.user.username;
        }
    });

    this.gameStateService.dayEnded$.subscribe(stats => {
       this.dailyReport = stats;
       this.soundService.playSuccess();
    });

    interval(5000).subscribe(() => {
        this.tickerIndex = (this.tickerIndex + 1) % this.tickerMessages.length;
    });
  }

  // --- ONLINE UI HELPERS ---
  getRankClass(index: number) {
      if (index === 0) return 'bg-yellow-500/20 border-yellow-500/50 text-yellow-100 shadow-[0_0_15px_rgba(234,179,8,0.3)]';
      if (index === 1) return 'bg-slate-300/10 border-slate-300/50 text-slate-200';
      if (index === 2) return 'bg-amber-700/10 border-amber-700/50 text-amber-200';
      return 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-700 transition-colors';
  }

  viewPlayerDetails(player: any) {
      this.selectedPlayer = player;
      this.soundService.playSoftPop();
  }

  closePlayerDetails() {
      this.selectedPlayer = null;
  }

  createHolding() {
      if (!this.newHoldingName) return;
      this.firebaseService.createHolding(this.newHoldingName, this.newUsername).then(() => {
          this.refreshOnlineData();
          this.newHoldingName = '';
      });
  }

  logout() {
    if(confirm("Se déconnecter ?")) this.gameStateService.logoutAndClear();
  }

  updateUsername() {
      if (this.newUsername?.trim()) {
          this.gameStateService.updateUsername(this.newUsername.trim());
          this.soundService.playSuccess();
          // Note : Pas besoin de rafraîchir les données online ici, la modif est locale pour l'instant
          // Elle sera envoyée lors de la prochaine sauvegarde auto ou fermeture
      }
  }

  toggleGlobalShop() {
    this.isGlobalShopOpen = !this.isGlobalShopOpen;
    if (this.isGlobalShopOpen) this.soundService.playSoftPop();
  }

  isThemeOwned(state: GameState, themeId: string): boolean { return state.freelanceUpgrades.ownedThemes.includes(themeId); }
  isActiveTheme(state: GameState, themeId: string): boolean { return state.freelanceUpgrades.activeThemeId === themeId; }
  buyOrEquipTheme(theme: IdeTheme) {
      this.gameState$.pipe(take(1)).subscribe(state => {
          if (this.isThemeOwned(state, theme.id)) {
              this.gameStateService.setFreelanceTheme(theme.id);
              this.soundService.playSoftPop();
          } else {
              if (state.money >= theme.cost) {
                  this.gameStateService.buyFreelanceTheme(theme.id, theme.cost);
                  this.soundService.playSuccess();
              } else this.soundService.playError();
          }
      });
  }

  toggleAdmin() { this.isAdminOpen = !this.isAdminOpen; }
  adminAddMoney(amount: number) { this.gameStateService.addMoney(amount); this.soundService.playCash(); }
  adminSetTime(event: any) { const val = parseFloat(event.target.value); if (!isNaN(val) && val >= 0 && val <= 24) { this.gameStateService.setTimeOfDay(val); } }

  toggleOnlineTab() { 
      this.isOnlineTabOpen = !this.isOnlineTabOpen; 
      if (this.isOnlineTabOpen) this.refreshOnlineData(); 
  }
  
  async connect() { await this.gameStateService.connectOnline(); this.refreshOnlineData(); }
  
  refreshOnlineData() { 
    this.firebaseService.getLeaderboard().subscribe((data: any) => {
        this.leaderboard = data;
        if (this.leaderboard.length > 0) this.tickerMessages.push(`👑 ${this.leaderboard[0].username} domine le classement !`);
    }); 
    this.firebaseService.getMarketItems().subscribe((data: any) => this.marketItems = data); 
    this.firebaseService.getHoldings().subscribe((data: any) => this.holdings = data);
  }
  
  sellEmployee() { 
    this.gameState$.pipe(take(1)).subscribe(state => { 
        const item: MarketItem = { 
            sellerId: this.firebaseService.currentUserId || 'anon', 
            sellerName: state.user?.username || 'Anonyme', 
            type: 'Dev Senior', 
            price: 5000, 
            timestamp: Date.now(),
            rarity: 'RARE'
        }; 
        this.firebaseService.sellItem(item); 
        this.soundService.playCash(); 
        setTimeout(() => this.refreshOnlineData(), 1000); 
    }); 
  }
  
  buyItem(item: MarketItem) { 
    this.gameState$.pipe(take(1)).subscribe(async (state) => { 
        if (state.money >= item.price) { 
            const result = await this.firebaseService.buyItem(item);
            if (result === 'SUCCESS') {
                this.gameStateService.addMoney(-item.price); 
                if (item.type === 'Dev Senior') this.gameStateService.hireEmployee('2', EmployeeRole.DEV_SENIOR); 
                this.soundService.playSuccess(); 
                this.refreshOnlineData();
            } else if (result === 'SNIPER_PROTECTION') {
                alert("🛑 Protection Sniper ! Attendez quelques secondes après la mise en vente.");
                this.soundService.playError();
            } else {
                alert("Trop tard ! Objet déjà vendu.");
                this.soundService.playError();
                this.refreshOnlineData();
            }
        } else this.soundService.playError(); 
    }); 
  }

  buySetup(item: string) { const cost = this.getSetupCost(item); this.gameState$.pipe(take(1)).subscribe(state => { if (state.money >= cost) { this.gameStateService.buySetupUpgrade(item as SetupItem, cost); this.soundService.playSuccess(); } else this.soundService.playError(); }); }
  getSetupCost(item: string): number { return { CHAIR: 2000, SCREEN: 5000, COFFEE: 1500, PC: 20000 }[item] || 0; }
  getSetupLevel(state: GameState, item: string): number { if (!state.freelanceUpgrades) return 0; switch(item) { case 'CHAIR': return state.freelanceUpgrades.chairLevel; case 'SCREEN': return state.freelanceUpgrades.screenLevel; case 'COFFEE': return state.freelanceUpgrades.coffeeLevel; case 'PC': return state.freelanceUpgrades.pcLevel; default: return 0; } }
  getFoodtruckLevel(state: GameState, type: string): number { if (!state.foodtruckUpgrades) return 1; return (state.foodtruckUpgrades as any)[type + 'Level'] || 1; }
  getFoodtruckCost(state: GameState, type: string): number { const lvl = this.getFoodtruckLevel(state, type); return Math.floor(150 * Math.pow(1.6, lvl)); }
  buyFoodtruck(type: string) { this.gameState$.pipe(take(1)).subscribe(state => { const cost = this.getFoodtruckCost(state, type); if (state.money >= cost) { this.gameStateService.buyFoodtruckUpgrade(type as any, cost); this.soundService.playSuccess(); } else this.soundService.playError(); }); }
  buyKeyboard() { this.gameState$.pipe(take(1)).subscribe(state => { if (state.money >= 5000 && !state.foodtruckUpgrades.hasKeyboard) { this.gameStateService.unlockKeyboard(5000); this.soundService.playSuccess(); } else this.soundService.playError(); }); }
  hasPrestigeItem(state: GameState, id: string): boolean { return state.achievements.some((a: any) => a.id === 'PRESTIGE_' + id); }
  buyPrestige(item: PrestigeItem) { if (this.gameStateService.buyPrestigeItem(item)) this.soundService.playSuccess(); else this.soundService.playError(); }
  getMyPrestigeItems(state: GameState): any[] { return state.achievements.filter((a: any) => a.id.startsWith('PRESTIGE_')); }
  getUnlockCost(type: JobType): number { switch (type) { case JobType.FREELANCE_DEV: return 10; case JobType.FACTORY: return 50; case JobType.CLOTHING_STORE: return 25; default: return 0; } }
  buyCompany(company: Company) { const cost = this.getUnlockCost(company.type); if (cost > 0) { this.gameStateService.unlockCompany(company.id, cost); this.soundService.playSuccess(); } }
  closeReport() { this.dailyReport = null; }
  selectCompany(c: Company) { if (c.unlocked) { this.gameState$.subscribe(state => { const freshVersion = state.companies.find(x => x.id === c.id); if (freshVersion && this.selectedCompany?.id === freshVersion.id) this.selectedCompany = freshVersion; }); this.selectedCompany = c; this.soundService.playSoftPop(); } }
  formatTime(decimalTime: number): string { const hours = Math.floor(decimalTime); const minutes = Math.floor((decimalTime - hours) * 60); return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`; }
  resetData() { this.gameStateService.hardResetGame(); }
}