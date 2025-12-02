import { Component, OnInit, OnDestroy, ChangeDetectorRef, HostListener, ChangeDetectionStrategy } from '@angular/core';
import { GameStateService } from '../../../core/services/game-state.service';
import { SoundService } from '../../../core/services/sound.service';
import { BurgerIngredient, IngredientStats, FoodtruckUpgrades } from '../../../models/game-models';

interface FloatingText { id: number; text: string; x: number; y: number; type: 'success' | 'error' | 'vip' | 'levelup' | 'auto'; }
interface Particle { id: number; x: number; y: number; color: string; rotation: number; speedX: number; speedY: number; }

@Component({
  selector: 'app-foodtruck-game',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush, // OPTIMISATION PERFORMANCE
  template: `
    <div class="h-full bg-slate-900 p-6 flex flex-col gap-6 font-sans select-none overflow-hidden relative transition-colors duration-500" 
         [class.vip-theme]="isVip" 
         [class.fever-theme]="isFeverMode && !isVip">
         <ng-content></ng-content> 
         <div class="grid grid-cols-12 gap-6 h-24 shrink-0 z-10">
        <div class="col-span-3 card-panel flex flex-col justify-center px-6 relative overflow-hidden group">
           <div class="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1 label-text">Caisse</div>
           <div class="text-2xl font-black text-white tracking-tight value-text group-hover:scale-105 transition-transform origin-left">
              {{ currentMoney | number:'1.0-0' }} €
           </div>
           <div class="absolute right-2 bottom-[-10px] text-6xl opacity-10 rotate-12 emoji-bg">💰</div>
        </div>
        <div class="col-span-6 card-panel flex items-center justify-between px-2 relative">
           <div class="flex flex-col items-center justify-center w-24 h-full border-r border-white/10">
              <span class="text-3xl font-black text-white value-text">{{ formatGameTime(timeOfDay) }}</span>
              <span class="text-[9px] text-slate-500 uppercase font-bold label-text">Jour {{ currentDay }}</span>
           </div>
           <div class="flex-1 flex flex-col items-center justify-center">
              <div *ngIf="isFeverMode" class="text-red-500 font-black text-lg animate-pulse tracking-widest uppercase glow-text">🔥 RUSH (20h-02h) -1s 🔥</div>
              <div *ngIf="isVip && !isFeverMode" class="text-amber-400 font-black text-lg animate-pulse tracking-widest uppercase glow-text">👑 Client VIP 👑</div>
              <div *ngIf="!isFeverMode && !isVip" class="text-slate-400 font-bold text-xs uppercase tracking-wide">Service Midi</div>
              <div class="flex gap-2 mt-1 opacity-80">
                 <span *ngIf="cookCount > 0" class="badge-pill bg-blue-500/20 text-blue-300 border-blue-500/30">👨‍🍳 {{cookCount}} Auto</span>
                 <span *ngIf="serverBonus > 0" class="badge-pill bg-green-500/20 text-green-300 border-green-500/30">⚡ +{{serverBonus}}% Vit.</span>
              </div>
           </div>
        </div>
        <div class="col-span-3 card-panel flex flex-col justify-center items-end px-6 relative overflow-hidden">
           <div class="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1 label-text">Temps Restant</div>
           <div class="text-3xl font-mono font-bold text-white z-10 value-text">{{ (displayTimeLeft / 1000) | number:'1.1-1' }}s</div>
           <div class="absolute bottom-0 left-0 h-1.5 w-full bg-black/20">
              <div class="h-full transition-all duration-200" 
                   [style.width.%]="getBarPercentage()"
                   [class.bg-blue-500]="!isTimeRunningOut() && !isVip && !isFeverMode" 
                   [class.bg-red-500]="isTimeRunningOut() || isFeverMode"
                   [class.bg-amber-400]="isVip"></div>
           </div>
        </div>
      </div>
      <div class="flex-1 grid grid-cols-12 gap-6 min-h-0 z-0">
         <div class="col-span-3 card-panel flex flex-col items-center py-4 overflow-hidden">
            <div class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 label-text shrink-0">À Préparer</div>
            <div class="mb-3 flex flex-col items-center bg-slate-950/30 w-full py-2 border-y border-white/5 shrink-0">
                <span class="text-2xl font-black text-green-400 tracking-tight">{{ getCurrentReward() | number:'1.0-0' }} €</span>
                <span class="text-[8px] text-slate-500 uppercase font-bold">Valeur Commande</span>
            </div>
            <div class="flex-1 min-h-0 w-full overflow-y-auto custom-scroll px-2 flex flex-col items-center gap-2 pb-2">
               <div *ngFor="let ing of remainingOrder; let i = index" 
                    class="w-14 h-14 shrink-0 rounded-xl flex items-center justify-center text-3xl shadow-inner border border-white/5 bg-black/20 animate-in"
                    [style.animation-delay]="i * 50 + 'ms'">
                  {{ getIcon(ing) }}
               </div>
               <div *ngIf="remainingOrder.length === 0" class="mt-4 text-green-400 font-bold text-xs animate-pulse flex flex-col items-center">
                  <span>✅ PRÊT</span>
                  <span class="text-[9px] opacity-70">Envoie !</span>
               </div>
            </div>
         </div>
         <div class="col-span-9 card-panel relative overflow-hidden flex items-end justify-center pb-10 group bg-grid-pattern">
            <div class="absolute inset-0 pointer-events-none">
                <div *ngFor="let p of particles" class="absolute w-2 h-2 rounded-full"
                     [style.left.px]="p.x" [style.top.px]="p.y" 
                     [style.background-color]="p.color" 
                     [style.transform]="'rotate(' + p.rotation + 'deg)'"></div>
            </div>
            <div class="relative z-10 flex flex-col-reverse items-center transition-transform duration-200" 
                 [style.transform]="'scale(' + (1 - currentStack.length * 0.02) + ')'">
                <div *ngFor="let ing of currentStack; let i = index" 
                     class="text-8xl -mb-14 drop-shadow-2xl animate-pop hover:scale-105 transition-transform cursor-pointer select-none"
                     [style.zIndex]="i">
                     {{ getIcon(ing) }}
                </div>
                <div class="w-72 h-6 bg-slate-700/50 rounded-[100%] mt-8 shadow-xl blur-sm z-[-1] plate-shadow"></div>
            </div>
            <div *ngFor="let ft of floatingTexts" class="absolute pointer-events-none font-bold text-3xl z-50 animate-float"
                 [style.left.px]="ft.x" [style.top.px]="ft.y"
                 [ngClass]="ft.type">
              {{ ft.text }}
            </div>
         </div>
      </div>
      <div class="shrink-0 card-panel p-4 z-20 shadow-2xl border-t border-white/10 transition-all duration-300">
         <div class="flex gap-4 items-stretch">
            <div class="flex-1 flex flex-wrap gap-2 justify-center content-center">
               <button *ngFor="let ing of currentAvailableIngredients; let i = index" 
                       (click)="addIngredient(ing, $event)"
                       class="relative group bg-slate-800 border-b-4 border-slate-950 rounded-xl 
                              active:border-b-0 active:translate-y-1 transition-all 
                              flex flex-col items-center justify-center overflow-hidden hover:bg-slate-700 ing-key
                              w-20 h-20 lg:w-24 lg:h-24">
                  <div *ngIf="upgrades.hasKeyboard" class="absolute top-1 left-1 bg-white/20 text-white/70 text-[10px] px-1.5 rounded font-mono border border-white/10">
                     {{ i + 1 }}
                  </div>
                  <span class="text-3xl lg:text-4xl mb-1 group-hover:scale-110 transition-transform duration-200">{{ getIcon(ing) }}</span>
                  <span class="text-[8px] lg:text-[9px] font-bold text-slate-500 uppercase tracking-wide group-hover:text-slate-300 label-text truncate w-full text-center px-1">{{ getShortName(ing) }}</span>
                  <div class="absolute bottom-0 left-0 w-full h-1 bg-black/40">
                     <div class="h-full bg-blue-500 transition-all duration-300" [style.width.%]="(mastery[ing].xp / mastery[ing].xpMax) * 100"></div>
                  </div>
               </button>
            </div>
            <button (click)="validateBurger($event)" 
                    [disabled]="currentStack.length === 0"
                    class="w-32 lg:w-48 rounded-xl font-black text-lg lg:text-xl uppercase tracking-widest shadow-lg border-b-4 active:border-b-0 active:translate-y-1 transition-all flex flex-col items-center justify-center text-center leading-none action-key disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shrink-0 self-stretch min-h-[5rem]"
                    [ngClass]="getActionBtnClass()">
                <span>{{ getButtonLabel() }}</span>
                <span *ngIf="upgrades.hasKeyboard" class="text-[10px] opacity-60 font-normal mt-1 border border-white/30 px-2 rounded">ESPACE</span>
            </button>
         </div>
      </div>
    </div>
  `,
  // (styles: [ ... gardez vos styles originaux ...])
  styles: [`
    .card-panel { background-color: #1e293b; border: 1px solid #334155; border-radius: 1rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
    .badge-pill { padding: 2px 8px; border-radius: 99px; font-size: 10px; font-weight: bold; border: 1px solid; display: inline-block; }

    .vip-theme .card-panel { background-color: #2a2010; border-color: #78350f; }
    .vip-theme .label-text { color: #d97706; }
    .vip-theme .value-text { color: #fcd34d; text-shadow: 0 0 10px rgba(251, 191, 36, 0.5); }
    .vip-theme .ing-key { background-color: #451a03; border-color: #78350f; }
    .vip-theme .plate-shadow { background-color: #b45309; opacity: 0.5; }
    .vip-theme .glow-text { text-shadow: 0 0 15px #fbbf24; }

    .fever-theme .card-panel { background-color: #2a1010; border-color: #7f1d1d; }
    .fever-theme .label-text { color: #f87171; }
    .fever-theme .value-text { color: #fecaca; text-shadow: 0 0 10px rgba(239, 68, 68, 0.5); }
    .fever-theme .glow-text { text-shadow: 0 0 15px #ef4444; }

    .bg-grid-pattern { background-image: radial-gradient(#334155 1px, transparent 1px); background-size: 20px 20px; background-position: center; }
    .vip-theme .bg-grid-pattern { background-image: radial-gradient(#92400e 1px, transparent 1px); }

    .animate-in { animation: slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) backwards; }
    @keyframes slideIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }

    .animate-pop { animation: pop 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
    @keyframes pop { from { transform: scale(0.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }

    .animate-float { animation: floatUp 0.8s forwards ease-out; }
    @keyframes floatUp { 0% { opacity: 1; transform: translateY(0); } 100% { opacity: 0; transform: translateY(-40px); } }
    
    .animate-fade-in { animation: fade 0.2s ease-out; }
    @keyframes fade { from { opacity: 0; } to { opacity: 1; } }

    .success { color: #4ade80; text-shadow: 0 2px 0 #000; }
    .error { color: #ef4444; text-shadow: 0 2px 0 #000; }
    .vip { color: #fbbf24; text-shadow: 0 0 10px #b45309; font-size: 2.5rem; }
    .auto { color: #60a5fa; text-shadow: 0 2px 0 #1e3a8a; }

    .custom-scroll::-webkit-scrollbar { width: 4px; height: 4px; }
    .custom-scroll::-webkit-scrollbar-track { background: transparent; }
    .custom-scroll::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }
  `]
})
export class FoodtruckGameComponent implements OnInit, OnDestroy {

  readonly CONFIG = {
    TIME: { startSeconds: 10, lessPerLevel: 1, minSeconds: 2 },
    ECONOMY: { baseReward: 35, percentPerLevel: 20, ingredientLevelBonus: 10 },
    VIP: { chance: 0.10, rewardMult: 5, timeDivisor: 2 },
    PROGRESSION: { unlockCheeseLevel: 3, unlockSaladLevel: 6, unlockTomatoLevel: 9 },
    FX: { confettiEvery: 5, feverThreshold: 5, confettiColors: ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#ffffff'] },
    AUTO: { cookSpeedBase: 5000, serverSlowPct: 10 },
    UNLOCK_COSTS: {
        [BurgerIngredient.CHEESE]: 1000, [BurgerIngredient.ONION]: 500,
        [BurgerIngredient.SALAD]: 2000, [BurgerIngredient.BACON]: 3500,
        [BurgerIngredient.PICKLE]: 0, [BurgerIngredient.TOMATO]: 0, [BurgerIngredient.SAUCE]: 0
    } as Record<string, number>
  };

  currentMoney = 0;
  isVip = false;
  triggerShake = false;
  
  comboMultiplier = 1;
  currentOrder: BurgerIngredient[] = [];
  currentStack: BurgerIngredient[] = [];
  allIngredientsList = Object.values(BurgerIngredient);
  currentAvailableIngredients: BurgerIngredient[] = [];
  mastery: Record<string, IngredientStats> = {};
  upgrades: FoodtruckUpgrades = { grillLevel: 1, marketingLevel: 1, serviceLevel: 1, unlockedIngredients: [], maxServiceReached: 1, hasKeyboard: false };
  
  cookCount = 0; serverCount = 0; serverBonus = 0; autoCookInterval: any;
  displayTimeLeft = 0; totalTimeForLevel = 0; isRunning = false; rafId: any; endTime = 0;
  floatingTexts: FloatingText[] = []; particles: Particle[] = []; private counter = 0;
  
  timeOfDay = 6;
  currentDay = 1;

  get isFeverMode(): boolean { 
      return (this.timeOfDay >= 20) || (this.timeOfDay < 2);
  }

  get remainingOrder() {
    return this.currentOrder.slice(this.currentStack.length);
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if (!this.upgrades.hasKeyboard) return;
    const key = event.key;
    const num = parseInt(key);
    if (!isNaN(num) && num > 0 && num <= this.currentAvailableIngredients.length) {
       this.addIngredient(this.currentAvailableIngredients[num - 1]);
    }
    if (key === ' ' || key === 'Enter') {
       event.preventDefault();
       this.validateBurger();
    }
  }

  constructor(private gameState: GameStateService, private cdr: ChangeDetectorRef, private soundService: SoundService) {
    this.allIngredientsList.forEach(ing => this.mastery[ing] = { level: 1, xp: 0, xpMax: 5 });
  }

  ngOnInit() {
    this.gameState.gameState$.subscribe(state => {
      this.currentMoney = state.money;
      this.timeOfDay = state.timeOfDay;
      this.currentDay = state.day;

      if (state.foodtruckMastery) this.mastery = JSON.parse(JSON.stringify(state.foodtruckMastery));
      if (state.foodtruckUpgrades) this.upgrades = { ...state.foodtruckUpgrades };
      
      const activeCompany = state.companies.find(c => c.type === 'FOODTRUCK');
      if (activeCompany) {
         const cookPower = this.gameState.getTotalEmployeePower(activeCompany.type, 'COOK' as any);
         const serverPower = this.gameState.getTotalEmployeePower(activeCompany.type, 'SERVER' as any);
         this.cookCount = Math.floor(cookPower);
         this.serverBonus = Math.min(75, serverPower); 
      }
      this.cdr.markForCheck(); // IMPORTANT pour OnPush
    });
    this.resetGame(1);
  }

  ngOnDestroy() { this.stopChrono(); this.stopAutoCook(); }

  startAutoCook() {
    this.stopAutoCook();
    if (this.cookCount > 0) {
      const speed = Math.max(500, this.CONFIG.AUTO.cookSpeedBase / this.cookCount);
      this.autoCookInterval = setInterval(() => { 
          if (this.isRunning) {
              this.performAutoAction();
              this.cdr.markForCheck(); 
          }
      }, speed);
    }
  }
  stopAutoCook() { if (this.autoCookInterval) clearInterval(this.autoCookInterval); }
  
  performAutoAction() { 
    if (this.currentStack.length < this.currentOrder.length) { 
        this.addIngredient(this.currentOrder[this.currentStack.length], undefined, true); 
    } else { 
        this.validateBurger(); 
    } 
  }

  addIngredient(ing: BurgerIngredient, event?: MouseEvent, isAuto: boolean = false) {
    if (!this.isRunning) { this.startChrono(); this.startAutoCook(); }
    
    if (!isAuto) {
        if ([BurgerIngredient.STEAK, BurgerIngredient.BACON].includes(ing)) this.soundService.playSteakSound();
        else if ([BurgerIngredient.SALAD, BurgerIngredient.ONION].includes(ing)) this.soundService.playSaladSound();
        else this.soundService.playSoftPop();
    }
    this.currentStack.push(ing);
    if (isAuto) this.spawnText('🤖', 100 + Math.random()*150, 200, 'auto');

    const index = this.currentStack.length - 1;
    if (this.currentOrder[index] !== ing) { 
        this.spawnText('RATÉ !', event?.clientX || 200, event?.clientY || 200, 'error');
        this.failLevel(); 
    }
    this.cdr.markForCheck();
  }

  validateBurger(event?: MouseEvent) {
    if (this.currentStack.length !== this.currentOrder.length) { this.failLevel(); return; }
    
    this.stopChrono(); this.stopAutoCook();
    this.soundService.playSuccess();
    this.gameState.incrementCustomersServed();
    
    this.gainXpForIngredients(event);
    const gain = this.getCurrentReward();
    this.gameState.addMoney(gain);
    
    this.spawnText(`+${Math.floor(gain)}€`, 200, 150, this.isVip ? 'vip' : 'success');
    
    this.gameState.updateMaxServiceReached(this.comboMultiplier);
    if(this.comboMultiplier >= 6) this.gameState.unlockIngredientByService('PICKLE');
    if(this.comboMultiplier >= 10) this.gameState.unlockIngredientByService('TOMATO');
    if(this.comboMultiplier >= 15) this.gameState.unlockIngredientByService('SAUCE');

    if (this.isVip || this.comboMultiplier % this.CONFIG.FX.confettiEvery === 0) { this.spawnConfetti(); }
    this.resetGame(this.comboMultiplier + 1);
  }

  failLevel() {
    this.stopChrono(); this.stopAutoCook();
    this.soundService.playError();
    this.triggerShake = true; 
    setTimeout(() => { this.triggerShake = false; this.cdr.markForCheck(); }, 400);
    this.resetGame(1);
  }

  resetGame(level: number, forceVip: boolean = false) {
    this.comboMultiplier = level; this.currentStack = []; this.isRunning = false;
    
    if (forceVip) this.isVip = true;
    else this.isVip = Math.random() < (this.CONFIG.VIP.chance + (this.upgrades.marketingLevel * 0.02));
    
    let seconds = this.CONFIG.TIME.startSeconds - ((this.comboMultiplier - 1) * this.CONFIG.TIME.lessPerLevel);
    seconds += this.upgrades.grillLevel * 0.5;

    if (this.isFeverMode && !this.isVip) {
        seconds -= 1.0; 
    }
    
    if (seconds < this.CONFIG.TIME.minSeconds) seconds = this.CONFIG.TIME.minSeconds;
    if (this.serverBonus > 0) seconds = seconds * (1 + this.serverBonus / 100);
    if (this.isVip) seconds = seconds / this.CONFIG.VIP.timeDivisor;
    
    this.totalTimeForLevel = seconds * 1000; this.displayTimeLeft = this.totalTimeForLevel;
    this.generateSmartOrder(); 
    this.cdr.detectChanges(); // Force le rafraîchissement immédiat
  }

  generateSmartOrder() {
    let pool = [BurgerIngredient.STEAK];
    if (this.isUnlocked(BurgerIngredient.CHEESE) || this.comboMultiplier >= this.CONFIG.PROGRESSION.unlockCheeseLevel) pool.push(BurgerIngredient.CHEESE);
    if (this.isUnlocked(BurgerIngredient.SALAD) || this.comboMultiplier >= this.CONFIG.PROGRESSION.unlockSaladLevel) pool.push(BurgerIngredient.SALAD);
    if (this.isUnlocked(BurgerIngredient.TOMATO) || this.comboMultiplier >= this.CONFIG.PROGRESSION.unlockTomatoLevel) pool.push(BurgerIngredient.TOMATO);
    
    this.allIngredientsList.forEach(ing => {
        if (this.isUnlocked(ing) && !pool.includes(ing) && ing !== BurgerIngredient.BUN) pool.push(ing);
    });
    this.currentAvailableIngredients = [BurgerIngredient.BUN, ...pool];
    const count = Math.min(6, 1 + Math.floor(this.comboMultiplier / 3));
    const inside = [];
    for(let i=0; i<count; i++) inside.push(pool[Math.floor(Math.random() * pool.length)]);
    this.currentOrder = [BurgerIngredient.BUN, ...inside, BurgerIngredient.BUN];
  }

  getCurrentReward(): number { 
    const rate = 1 + (this.CONFIG.ECONOMY.percentPerLevel / 100);
    let base = this.CONFIG.ECONOMY.baseReward * Math.pow(rate, this.comboMultiplier - 1);
    base += (this.upgrades.serviceLevel * 5);
    let totalLevels = 0; this.currentOrder.forEach(ing => { if(this.mastery[ing]) totalLevels += this.mastery[ing].level; });
    const avgLevel = this.currentOrder.length > 0 ? totalLevels / this.currentOrder.length : 1;
    const masteryBonus = 1 + ((avgLevel - 1) * (this.CONFIG.ECONOMY.ingredientLevelBonus / 100));
    base = base * masteryBonus;
    if (this.isVip) base = base * this.CONFIG.VIP.rewardMult;
    return base; 
  }

  gainXpForIngredients(event?: MouseEvent) {
    const uniqueIngredients = [...new Set(this.currentStack)];
    uniqueIngredients.forEach(ing => {
      if (!this.mastery[ing]) this.mastery[ing] = { level: 1, xp: 0, xpMax: 5 };
      const stats = this.mastery[ing]; stats.xp++;
      if (stats.xp >= stats.xpMax) { 
          stats.level++; stats.xp = 0; stats.xpMax = Math.floor(stats.xpMax * 1.5); 
          if (event) this.spawnText(`${this.getIcon(ing)} UP!`, event.clientX, event.clientY - 50, 'levelup'); 
      }
    });
    this.gameState.updateIngredientMastery(this.mastery);
  }

  startChrono() {
    this.isRunning = true; this.endTime = Date.now() + this.totalTimeForLevel;
    const loop = () => {
      if (!this.isRunning) return;
      const remaining = this.endTime - Date.now();
      if (remaining <= 0) { 
          this.displayTimeLeft = 0; 
          this.spawnText('TEMPS ÉCOULÉ !', 200, 200, 'error'); 
          this.failLevel(); 
          this.cdr.detectChanges();
      } 
      else { 
          this.displayTimeLeft = remaining; 
          this.cdr.detectChanges(); // Nécessaire car requestAnimationFrame tourne en dehors de la zone Angular
          this.rafId = requestAnimationFrame(loop); 
      }
    };
    this.rafId = requestAnimationFrame(loop);
  }
  stopChrono() { this.isRunning = false; if (this.rafId) cancelAnimationFrame(this.rafId); }
  getBarPercentage() { return (this.displayTimeLeft / this.totalTimeForLevel) * 100; }
  isTimeRunningOut() { return this.getBarPercentage() < 30; }

  // UTILS
  getActionBtnClass() {
      if (this.isFeverMode && !this.isVip) return 'bg-red-600 hover:bg-red-500 border-red-800 text-white shadow-[0_4px_20px_rgba(239,68,68,0.4)] animate-pulse';
      if (this.isVip) return 'bg-gradient-to-r from-amber-600 to-amber-500 border-amber-700 text-amber-50 shadow-[0_4px_20px_rgba(245,158,11,0.4)]';
      return 'bg-blue-600 hover:bg-blue-500 border-blue-700 text-white';
  }
  getButtonLabel() { return this.isFeverMode && !this.isVip ? '🔥 FEVER !' : (this.isVip ? '👑 SERVIR LE ROI DU BURGER' : '🛎️ ENVOYER'); }
  formatGameTime(decimalTime: number): string { const hours = Math.floor(decimalTime); const minutes = Math.floor((decimalTime - hours) * 60); return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`; }

  spawnConfetti() { for (let i = 0; i < 30; i++) { this.particles.push({ id: this.counter++, x: Math.random() * 300 + 50, y: 200, color: this.CONFIG.FX.confettiColors[Math.floor(Math.random() * this.CONFIG.FX.confettiColors.length)], rotation: Math.random() * 360, speedX: (Math.random() - 0.5) * 10, speedY: (Math.random() - 1) * 15 - 5 }); } this.animateParticles(); }
  animateParticles() { 
      if (this.particles.length === 0) return; 
      this.particles.forEach(p => { p.x += p.speedX; p.y += p.speedY; p.speedY += 0.5; p.rotation += 5; }); 
      this.particles = this.particles.filter(p => p.y < 600); 
      if (this.particles.length > 0) requestAnimationFrame(() => { 
          this.animateParticles(); 
          this.cdr.detectChanges(); 
      }); 
  }
  spawnText(text: string, x: number, y: number, type: any) { 
      const id = this.counter++; 
      this.floatingTexts.push({ id, text, x: x || 200, y: y || 100, type }); 
      setTimeout(() => { 
          this.floatingTexts = this.floatingTexts.filter(ft => ft.id !== id); 
          this.cdr.detectChanges(); 
      }, 1000); 
  }

  isUnlocked(ing: string) { return this.upgrades.unlockedIngredients.includes(ing); }
  getShortName(ing: string) { const map: any = { BUN: 'Pain', STEAK: 'Viande', CHEESE: 'Fromage', SALAD: 'Salade', TOMATO: 'Tomate', SAUCE: 'Sauce', ONION: 'Oignon', PICKLE: 'Cornich.', BACON: 'Bacon' }; return map[ing] || ing; }
  getIcon(ing: string): string { const icons: any = { BUN: '🍞', STEAK: '🥩', CHEESE: '🧀', SALAD: '🥬', TOMATO: '🍅', SAUCE: '🥣', ONION: '🧅', PICKLE: '🥒', BACON: '🥓' }; return icons[ing] || '❓'; }
}