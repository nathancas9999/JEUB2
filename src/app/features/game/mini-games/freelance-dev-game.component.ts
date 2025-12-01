import { Component, OnInit, HostListener, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { GameStateService } from '../../../core/services/game-state.service';
import { SoundService } from '../../../core/services/sound.service';
import { SetupItem, JobType, EmployeeRole, Employee } from '../../../models/game-models';

interface Mission { id: number; title: string; description: string; difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'BOSS' | 'HACKER'; reward: number; timeLimit: number; lines: string[]; }
interface DisplayToken { isSpace: boolean; chars: { value: string; index: number }[]; }
interface WorkerState { currentMission: Mission | null; targetText: string; typedText: string; progress: number; status: 'IDLE' | 'WORKING' | 'DONE'; cooldown: number; }

// CONFIGURATION DES THÈMES (Avec la nouvelle propriété successClass)
const THEMES_CONFIG = [
    { 
      id: 'DEFAULT', name: 'VS Code Dark', cost: 0, 
      bgClass: 'bg-[#1e1e1e]', textClass: 'text-slate-200', 
      accentClass: 'text-blue-400', cursorClass: 'bg-blue-500', borderClass: 'border-slate-700',
      successClass: 'text-green-400' // Vert classique
    },
    { 
      id: 'MATRIX', name: 'The Matrix', cost: 2500, 
      bgClass: 'bg-black', textClass: 'text-green-700 font-mono', 
      accentClass: 'text-green-400', cursorClass: 'bg-green-500', borderClass: 'border-green-800',
      successClass: 'text-green-400 neon-glow' // Vert Matrix avec lueur
    },
    { 
      id: 'DRACULA', name: 'Dracula', cost: 5000, 
      bgClass: 'bg-[#282a36]', textClass: 'text-[#f8f8f2]', 
      accentClass: 'text-[#bd93f9]', cursorClass: 'bg-[#bd93f9]', borderClass: 'border-[#6272a4]',
      successClass: 'text-[#ff79c6] drop-shadow-md' // Rose Dracula
    },
    { 
      id: 'SOLARIZED', name: 'Solarized Light', cost: 10000, 
      bgClass: 'bg-[#fdf6e3]', textClass: 'text-[#657b83]', 
      accentClass: 'text-[#b58900]', cursorClass: 'bg-[#d33682]', borderClass: 'border-[#93a1a1]',
      successClass: 'text-[#d33682] font-bold' // Magenta Solarized (lisible sur blanc)
    }
];

@Component({
  selector: 'app-freelance-dev-game',
  standalone: false,
  template: `
    <div class="h-full font-sans flex flex-col relative overflow-hidden select-none transition-colors duration-500"
         [ngClass]="[activeTheme.bgClass, activeTheme.textClass]"
         (click)="focusInput()">
      
      <div class="p-4 border-b flex justify-between items-center shadow-md z-10 relative" [ngClass]="activeTheme.borderClass">
        <div class="flex items-center gap-4">
          <div class="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
          <span class="text-sm font-bold opacity-50 hidden sm:block">FreelanceOS v28</span>
          
          <div *ngIf="activeMission" class="flex items-center gap-3">
             <div class="px-3 py-1 rounded-full border text-xs font-bold flex gap-2" [ngClass]="[activeTheme.borderClass, activeTheme.bgClass]">
                <span [ngClass]="activeTheme.accentClass">{{ currentWpm | number:'1.0-0' }} WPM</span>
             </div>
             <button *ngIf="coffeeLevel > 0 && !isCoffeeActive && coffeeAvailable" 
                     (click)="$event.stopPropagation(); drinkCoffee()"
                     class="bg-amber-700 hover:bg-amber-600 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 transition-all animate-bounce">
                ☕ PAUSE
             </button>
             <div *ngIf="isCoffeeActive" class="text-amber-400 text-xs font-black animate-pulse">GELÉ</div>
          </div>
        </div>

        <div class="flex items-center gap-3">
            <button (click)="$event.stopPropagation(); toggleStaff()" 
                    class="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded shadow flex items-center gap-2 transition-all relative">
                <span>👥</span> ÉQUIPE
                <span *ngIf="employees.length > 0" class="absolute -top-1 -right-1 flex h-2 w-2">
                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span class="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
            </button>

            <div class="font-bold font-mono text-lg" [ngClass]="activeTheme.accentClass">
            {{ currentMoney | number:'1.0-0' }} €
            </div>
        </div>
      </div>

      <div class="absolute top-20 right-4 z-20 pointer-events-none flex flex-col gap-2 items-end">
          <div *ngFor="let notif of notifications" class="backdrop-blur px-3 py-1 rounded border text-xs shadow-lg animate-fade-out-up"
               [ngClass]="[activeTheme.borderClass, activeTheme.accentClass, activeTheme.bgClass]">
              {{ notif }}
          </div>
      </div>

      <div *ngIf="!activeMission" class="flex-1 p-8 overflow-y-auto custom-scroll">
        <div class="max-w-4xl mx-auto">
          <h2 class="text-3xl font-black mb-2 tracking-tight flex items-center gap-3">📜 Vos Contrats</h2>
          <p class="opacity-60 mb-8">Vos employés gèrent leurs propres projets en autonomie.</p>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div *ngFor="let mission of availableMissions" 
                 (click)="$event.stopPropagation(); startMission(mission)"
                 class="group relative border rounded-xl p-5 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-xl"
                 [ngClass]="[activeTheme.borderClass, activeTheme.bgClass, getMissionClass(mission.difficulty)]">
              <div class="flex justify-between items-start mb-4">
                <span class="text-2xl">{{ getIcon(mission.difficulty) }}</span>
                <span class="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border"
                      [ngClass]="getDifficultyClass(mission.difficulty)">{{ mission.difficulty }}</span>
              </div>
              <h3 class="font-bold text-lg mb-1 transition-colors group-hover:opacity-80">{{ mission.title }}</h3>
              <div class="mt-4 pt-4 border-t flex justify-between items-center" [ngClass]="activeTheme.borderClass">
                <div class="flex flex-col">
                  <span class="text-[10px] opacity-60 uppercase">Gain</span>
                  <span class="font-bold" [ngClass]="activeTheme.accentClass">{{ calculateReward(mission) | number:'1.0-0' }} €</span>
                </div>
                <div class="flex flex-col items-end">
                  <span class="text-[10px] opacity-60 uppercase">Temps</span>
                  <span class="font-bold">{{ mission.timeLimit }}s</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div *ngIf="activeMission" class="flex-1 flex flex-col relative transition-colors duration-500">
        <div class="absolute inset-0 opacity-10 pointer-events-none" [ngClass]="activeTheme.bgClass"></div>
        
        <div #gameZone class="flex-1 p-8 flex flex-col justify-center items-center relative overflow-hidden">
            <div class="absolute top-10 right-10 flex flex-col items-end transition-all duration-200 z-30" [class.opacity-0]="currentCombo < 2">
                <div class="text-6xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400" [class.from-amber-400]="currentCombo >= 50">x{{ currentCombo }}</div>
                <div class="text-xs font-bold opacity-50 uppercase tracking-widest">COMBO</div>
            </div>

            <div class="relative z-20 w-full max-w-5xl text-center leading-relaxed select-none cursor-text transition-transform duration-100" [class.shake-anim]="hasError">
                <div class="text-4xl font-sans font-medium tracking-normal opacity-80">
                  <span *ngFor="let token of currentDisplayTokens" class="inline-block" [class.whitespace-nowrap]="!token.isSpace">
                      <span *ngFor="let charObj of token.chars">
                          <span *ngIf="charObj.index === userInput.length" class="inline-block w-[3px] h-8 align-middle animate-pulse -mb-1 mr-[1px] rounded-full shadow-[0_0_15px_rgba(59,130,246,1)]" [ngClass]="activeTheme.cursorClass"></span>
                          <span [ngClass]="getCharClass(charObj.index, charObj.value)" class="transition-all duration-150 border-b-2 border-transparent inline-block min-w-[12px] whitespace-pre text-center">{{ (charObj.index < userInput.length) ? userInput[charObj.index] : charObj.value }}</span>
                      </span>
                  </span>
                </div>
                <div *ngIf="isFinishedButWrong" class="mt-8 text-red-500 font-bold text-xl animate-bounce">CORRIGEZ !</div>
            </div>

            <div class="absolute bottom-8 flex flex-col items-center z-30">
                <div class="text-5xl font-mono font-black transition-colors duration-300 drop-shadow-lg" [class.text-red-500]="timeLeft <= 5">{{ timeLeft | number:'1.1-1' }}s</div>
            </div>
            
            <input #hiddenInput type="text" class="absolute opacity-0 top-0 left-0 h-full w-full cursor-text" (input)="onInput($event)" autofocus autocomplete="off" spellcheck="false">
        </div>
      </div>

      <div *ngIf="isStaffOpen" class="absolute inset-0 bg-slate-950/95 z-50 flex items-center justify-center backdrop-blur-sm animate-fade-in" (click)="$event.stopPropagation()">
         <div class="bg-slate-900 border border-slate-700 w-full max-w-4xl h-[85%] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div class="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900">
               <h3 class="font-black text-white text-2xl">👥 GESTION ÉQUIPE</h3>
               <button (click)="toggleStaff()" class="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center transition-colors">✕</button>
            </div>
            
            <div class="flex-1 flex overflow-hidden">
                <div class="w-1/3 bg-slate-950 p-4 border-r border-slate-800 flex flex-col gap-4">
                    
                    <button (click)="startTeamBuilding()"
                            [disabled]="currentMoney < TEAM_BUILDING_COST || isTeamBuildingActive"
                            class="w-full py-4 rounded-xl font-black text-sm uppercase tracking-wider shadow-lg flex flex-col items-center justify-center gap-2 transition-all transform active:scale-95 border border-white/10"
                            [ngClass]="isTeamBuildingActive ? 'bg-green-600 text-white animate-pulse' : 'bg-gradient-to-r from-orange-600 to-red-600 text-white hover:brightness-110'">
                        <span class="text-2xl">🍕</span>
                        <div class="text-center leading-tight">
                            <div>{{ isTeamBuildingActive ? 'PARTY EN COURS !' : 'PIZZA PARTY' }}</div>
                            <div *ngIf="!isTeamBuildingActive" class="text-[10px] opacity-80 font-normal mt-1">{{ TEAM_BUILDING_COST }}€ • 30s • Boost x2.5</div>
                        </div>
                    </button>

                    <div class="bg-slate-900 p-3 rounded border border-slate-800 hover:border-blue-500 transition-colors mt-2">
                        <div class="font-bold text-white">Stagiaire</div>
                        <div class="text-xs text-slate-400 mb-2">Petits contrats.</div>
                        <button (click)="hire(0)" [disabled]="!canHire(0)" class="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white text-xs font-bold rounded">{{ getHireCost(0) }} €</button>
                    </div>
                    <div class="bg-slate-900 p-3 rounded border border-slate-800 hover:border-purple-500 transition-colors">
                        <div class="font-bold text-white">Senior</div>
                        <div class="text-xs text-slate-400 mb-2">Gros contrats.</div>
                        <button (click)="hire(1)" [disabled]="!canHire(1)" class="w-full py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 text-white text-xs font-bold rounded">{{ getHireCost(1) }} €</button>
                    </div>
                </div>
                
                <div class="flex-1 p-6 bg-slate-900 overflow-y-auto custom-scroll">
                    <div *ngIf="employees.length === 0" class="h-full flex flex-col items-center justify-center text-slate-600">
                        <div class="text-4xl mb-2">👻</div>
                        <div>Aucun employé.</div>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div *ngFor="let emp of employees; let i = index" class="bg-slate-800 p-3 rounded-lg border border-slate-700 relative" [class.opacity-50]="emp.isPaused">
                             <div class="flex justify-between items-start mb-2">
                                <div class="flex items-center gap-2">
                                    <span class="text-2xl">{{ emp.role === 'DEV_JUNIOR' ? '👨‍💻' : '🧙‍♂️' }}</span>
                                    <div>
                                        <div class="font-bold text-white text-sm">Dev #{{ i+1 }}</div>
                                        <div class="text-[10px] text-slate-400" *ngIf="getWorkerState(emp.id)?.currentMission">En mission...</div>
                                        <div class="text-[10px] text-slate-600" *ngIf="!getWorkerState(emp.id)?.currentMission">Libre</div>
                                    </div>
                                </div>
                                <div *ngIf="emp.isPaused" class="text-[10px] bg-red-900 text-red-300 px-2 py-0.5 rounded">PAUSE</div>
                                <div *ngIf="!emp.isPaused" class="text-[10px] bg-green-900 text-green-300 px-2 py-0.5 rounded">ACTIF</div>
                             </div>
                             <div class="h-1 w-full bg-black rounded-full mb-2 overflow-hidden" *ngIf="getWorkerState(emp.id) as ws">
                                 <div class="h-full transition-all duration-300" 
                                      [style.width.%]="ws.currentMission ? (ws.typedText.length / ws.targetText.length * 100) : 0"
                                      [ngClass]="isTeamBuildingActive ? 'bg-orange-500' : 'bg-blue-500'"></div>
                             </div>
                             <div class="flex flex-col gap-2">
                                 <button (click)="watchEmployee(emp)" class="w-full py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-bold rounded border border-slate-600 flex items-center justify-center gap-2">👁️ VOIR ÉCRAN</button>
                                 <button (click)="trainEmployee(emp)" [disabled]="currentMoney < getTrainCost(emp)" class="w-full py-1.5 bg-green-700 hover:bg-green-600 disabled:bg-slate-700 text-white text-[10px] font-bold rounded flex justify-between px-2"><span>FORMATION</span><span>{{ getTrainCost(emp) }}€</span></button>
                                 <button (click)="togglePause(emp)" class="w-full py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-bold rounded">{{ emp.isPaused ? 'REPRENDRE' : 'METTRE EN PAUSE' }}</button>
                             </div>
                        </div>
                    </div>
                </div>
            </div>
         </div>
      </div>
      
      <div *ngIf="missionResult" class="absolute inset-0 bg-slate-900/90 z-50 flex items-center justify-center backdrop-blur-md animate-fade-in" (click)="$event.stopPropagation()">
        <div class="bg-slate-800 p-8 rounded-2xl border-2 shadow-2xl max-w-sm w-full text-center">
             <div class="text-6xl mb-4">{{ missionResult === 'SUCCESS' ? '🏆' : '💀' }}</div>
             <h3 class="text-2xl font-black uppercase mb-6" [class.text-green-400]="missionResult === 'SUCCESS'" [class.text-red-400]="missionResult === 'FAIL'">{{ missionResult === 'SUCCESS' ? 'CONTRAT REMPLI' : 'ÉCHEC' }}</h3>
             <div *ngIf="missionResult === 'SUCCESS'" class="bg-green-900/20 p-4 rounded-xl mb-6 border border-green-500/30 w-full">
                <div class="flex flex-col gap-2">
                    <div class="flex justify-between items-center text-sm text-green-200/70"><span>Base</span><span>{{ activeMission?.reward }} €</span></div>
                    <div class="flex justify-between items-center text-sm text-amber-400 font-bold"><span>Combo</span><span>+{{ maxComboReached }} €</span></div>
                    <div *ngIf="screenLevel > 0" class="flex justify-between items-center text-sm text-purple-400 font-bold"><span>Bonus Écran</span><span>+{{ getScreenBonus(activeMission?.reward || 0) | number:'1.0-0' }} €</span></div>
                    <div class="h-px bg-green-500/30 my-1"></div>
                    <div class="flex justify-between items-center text-2xl font-black text-green-400"><span>TOTAL</span><span>+{{ lastReward | number:'1.0-0' }} €</span></div>
                </div>
             </div>
             <button (click)="closeResult()" class="w-full py-4 rounded-xl font-bold uppercase tracking-wider transition-all shadow-lg active:scale-95 bg-slate-700 hover:bg-slate-600 text-white">Continuer ➡️</button>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .custom-scroll::-webkit-scrollbar { width: 6px; } .custom-scroll::-webkit-scrollbar-track { background: transparent; } .custom-scroll::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }
    .shake-anim { animation: shake 0.2s cubic-bezier(.36,.07,.19,.97) both; }
    @keyframes shake { 10%, 90% { transform: translate3d(-2px, 0, 0); } 20%, 80% { transform: translate3d(4px, 0, 0); } 40%, 60% { transform: translate3d(6px, 0, 0); } }
    .neon-glow { color: #4ade80; text-shadow: 0 0 5px #4ade80, 0 0 10px #4ade80; font-weight: 900; transform: scale(1.1); }
    .animate-fade-in { animation: fadeIn 0.3s ease-out; }
    .animate-fade-out-up { animation: fadeOutUp 2s ease-out forwards; }
    @keyframes fadeIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
    @keyframes fadeOutUp { 0% { opacity: 1; transform: translateY(0); } 100% { opacity: 0; transform: translateY(-20px); } }
  `]
})
export class FreelanceDevGameComponent implements OnInit, OnDestroy {
  @ViewChild('hiddenInput') hiddenInput!: ElementRef;
  
  availableMissions: Mission[] = [];
  activeMission: Mission | null = null;
  currentLineIndex = 0;
  currentTargetLine = "";
  currentDisplayTokens: DisplayToken[] = [];
  userInput = "";
  timeLeft = 0;
  timerInterval: any;
  missionResult: 'SUCCESS' | 'FAIL' | null = null;
  lastReward = 0;
  hasError = false;
  currentCombo = 0;
  maxComboReached = 0;
  startTime = 0;
  endTime = 0;
  totalCharsTyped = 0;
  
  // Suppression du setup local (tout est géré globalement)
  isShopOpen = false;
  isStaffOpen = false;

  // SETUP
  chairLevel = 0; screenLevel = 0; coffeeLevel = 0; pcLevel = 0;
  isCoffeeActive = false; coffeeAvailable = true;
  currentMoney = 0;
  contractsCompleted = 0;
  
  // EMPLOYES
  employees: Employee[] = [];
  workerStates: Record<string, WorkerState> = {};
  workerInterval: any;
  notifications: string[] = [];
  watchedEmployee: Employee | null = null;

  // NOUVEAU : On utilise la config globale
  activeTheme = THEMES_CONFIG[0];

  // NOUVEAU : Team Building
  isTeamBuildingActive = false;
  teamBuildingEndTime = 0;
  readonly TEAM_BUILDING_COST = 2000;
  readonly TEAM_BUILDING_DURATION = 30000;

  readonly WORDS_EASY = ["chat", "chien", "ami", "pain", "eau", "mer", "ciel", "mur", "sac", "bus", "lit", "bol", "the", "sel", "coq", "or", "loi", "nez", "vis", "rue", "pin", "pot", "jeu", "gaz", "main", "pied", "joie", "papa", "mama", "cafe"];
  readonly WORDS_HARD = ["voiture", "maison", "enfant", "ecole", "manger", "dormir", "prendre", "parler", "soleil", "jardin", "fleur", "oiseau", "pomme", "table", "chaise", "livre", "crayon", "porte", "fenetre", "arbres", "nuage", "pluie", "neige", "route", "ville", "famille", "musique", "bonheur", "sourire", "liberte", "courage", "vitesse"];
  readonly WORDS_HACKER = ["mainframe", "firewall", "bypass", "encrypt", "socket", "buffer", "overflow", "inject", "root", "sudo", "access", "denied", "proxy", "daemon", "kernel", "panic", "matrix", "cyber", "secure", "token"];

  get isFinishedButWrong(): boolean { return this.userInput.length === this.currentTargetLine.length && this.userInput !== this.currentTargetLine; }
  get currentWpm(): number {
    if (!this.startTime) return 0;
    const end = this.endTime || Date.now();
    const minutes = (end - this.startTime) / 60000;
    if (minutes < 0.001) return 0;
    return Math.floor((this.totalCharsTyped / 5) / minutes);
  }

  constructor(public gameStateService: GameStateService, private soundService: SoundService) {}

  ngOnInit() {
    this.gameStateService.gameState$.subscribe(state => {
        this.currentMoney = state.money;
        if (state.freelanceUpgrades) {
            this.chairLevel = state.freelanceUpgrades.chairLevel;
            this.screenLevel = state.freelanceUpgrades.screenLevel;
            this.coffeeLevel = state.freelanceUpgrades.coffeeLevel;
            this.pcLevel = state.freelanceUpgrades.pcLevel;
            this.contractsCompleted = state.freelanceUpgrades.contractsCompleted || 0;
            
            // NOUVEAU : Récupération du thème actif
            const activeId = state.freelanceUpgrades.activeThemeId;
            const theme = THEMES_CONFIG.find(t => t.id === activeId);
            if (theme) {
                this.activeTheme = theme;
            }
        }
        
        const company = state.companies.find(c => c.id === '2');
        if (company) {
            this.employees = company.employees;
            this.employees.forEach(emp => {
                if (!this.workerStates[emp.id]) {
                    this.workerStates[emp.id] = { currentMission: null, targetText: "", typedText: "", progress: 0, status: 'IDLE', cooldown: 0 };
                }
            });
        }
    });
    this.generateMissions();
    this.startWorkerSimulation();
  }

  ngOnDestroy() { this.stopTimer(); this.stopWatching(); if(this.workerInterval) clearInterval(this.workerInterval); }
  focusInput() { if (!this.isShopOpen && !this.isStaffOpen && !this.watchedEmployee && !this.missionResult && this.activeMission) setTimeout(() => this.hiddenInput?.nativeElement.focus(), 0); }
  toggleShop() { 
      // Le bouton setup dans le header freelance a été supprimé ou redirige vers le shop global ?
      // Dans le header : <button (click)="toggleShop()" ...>SETUP</button> est toujours là.
      // On va le garder mais on peut l'utiliser pour ouvrir le shop global plus tard si on veut.
      // Pour l'instant on garde la logique locale simplifiée.
      this.isShopOpen = !this.isShopOpen; this.isStaffOpen = false; if(!this.isShopOpen) this.focusInput(); 
  }
  toggleStaff() { this.isStaffOpen = !this.isStaffOpen; this.isShopOpen = false; }

  // NOUVEAU : Team Building
  startTeamBuilding() {
    if (this.currentMoney >= this.TEAM_BUILDING_COST && !this.isTeamBuildingActive) {
      this.gameStateService.addMoney(-this.TEAM_BUILDING_COST);
      this.isTeamBuildingActive = true;
      this.teamBuildingEndTime = Date.now() + this.TEAM_BUILDING_DURATION;
      
      this.soundService.playSuccess();
      this.showNotification("🍕 PIZZA PARTY ACTIVÉE ! (+150% Vitesse)");

      setTimeout(() => {
        this.isTeamBuildingActive = false;
        this.showNotification("Fin de la Pizza Party...");
      }, this.TEAM_BUILDING_DURATION);
    }
  }

  getCost(item: string) { return { CHAIR: 2000, SCREEN: 5000, COFFEE: 1500, PC: 20000 }[item] || 0; }
  canBuy(item: any) { return this.currentMoney >= this.getCost(item); } 
  buyItem(item: any) { this.gameStateService.buySetupUpgrade(item as SetupItem, this.getCost(item)); }

  getHireCost(type: number) { const role = type === 0 ? EmployeeRole.DEV_JUNIOR : EmployeeRole.DEV_SENIOR; return this.gameStateService.getNextHireCost('2', role); }
  canHire(type: number) { return this.currentMoney >= this.getHireCost(type); }
  hire(type: number) { const role = type === 0 ? EmployeeRole.DEV_JUNIOR : EmployeeRole.DEV_SENIOR; this.gameStateService.hireEmployee('2', role); }
  getTrainCost(emp: Employee) { return Math.floor(500 * Math.pow(1.5, emp.efficiency)); }
  trainEmployee(emp: Employee) { this.gameStateService.upgradeEmployeeSetup('2', emp.id, this.getTrainCost(emp)); }
  togglePause(emp: Employee) { this.gameStateService.toggleEmployeePause('2', emp.id); }

  drinkCoffee() { if (this.isCoffeeActive || !this.coffeeAvailable) return; this.isCoffeeActive = true; this.coffeeAvailable = false; this.soundService.playPop(); setTimeout(() => { this.isCoffeeActive = false; }, 5000); }

  // IA DES EMPLOYÉS AVEC BOOST TEAM BUILDING
  startWorkerSimulation() {
      if (this.workerInterval) clearInterval(this.workerInterval);
      this.workerInterval = setInterval(() => {
          this.employees.forEach(emp => {
              if (emp.isPaused) return;
              const state = this.workerStates[emp.id];
              if (!state) return;

              if (state.status === 'IDLE') {
                  if (state.cooldown > 0) {
                      // Team building réduit le cooldown aussi
                      state.cooldown -= this.isTeamBuildingActive ? 0.3 : 0.1;
                  } else {
                      const difficulty = emp.role === EmployeeRole.DEV_JUNIOR ? (Math.random() > 0.7 ? 'MEDIUM' : 'EASY') : 'HARD';
                      const mission = this.createMission(0, difficulty as any);
                      state.currentMission = mission;
                      state.targetText = mission.lines[0];
                      state.typedText = "";
                      state.status = 'WORKING';
                  }
              }
              else if (state.status === 'WORKING' && state.targetText) {
                  let chance = emp.role === EmployeeRole.DEV_SENIOR ? 0.3 : 0.1;
                  chance += (emp.efficiency * 0.05);
                  
                  // BOOST TEAM BUILDING
                  if (this.isTeamBuildingActive) chance *= 2.5;

                  if (Math.random() < chance) {
                      state.typedText += state.targetText[state.typedText.length];
                      if (state.typedText.length >= state.targetText.length) {
                          const gain = Math.floor(state.currentMission!.reward * 0.2);
                          this.gameStateService.addMoney(gain);
                          this.showNotification(`+${gain}€ (${emp.role === 'DEV_JUNIOR' ? 'Jr' : 'Sr'})`);
                          state.status = 'IDLE';
                          state.currentMission = null;
                          state.cooldown = 3;
                      }
                  }
              }
          });
      }, 100);
  }

  getWorkerState(id: string): WorkerState | undefined { return this.workerStates[id]; }
  showNotification(text: string) { this.notifications.push(text); setTimeout(() => this.notifications.shift(), 2000); }
  watchEmployee(emp: Employee) { this.watchedEmployee = emp; this.isStaffOpen = false; }
  stopWatching() { this.watchedEmployee = null; this.isStaffOpen = true; }

  generateMissions() { this.availableMissions = []; const bossChance = 0.05 + (this.pcLevel * 0.02); const hackerChance = this.pcLevel > 0 ? 0.1 : 0; for(let i=0; i<3; i++) { const r = Math.random(); if (r < bossChance) this.availableMissions.push(this.createMission(i, 'BOSS')); else if (r < bossChance + hackerChance) this.availableMissions.push(this.createMission(i, 'HACKER')); else { const difficulty = Math.random() > 0.6 ? 'HARD' : (Math.random() > 0.3 ? 'MEDIUM' : 'EASY'); this.availableMissions.push(this.createMission(i, difficulty as any)); } } }
  createMission(id: number, difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'BOSS' | 'HACKER'): Mission { let time = 30; let reward = 100; let lines = 2; let words = 5; if (difficulty === 'BOSS') { time = 45; reward = 5000; lines = 5; words = 10; } else if (difficulty === 'HACKER') { time = 20; reward = 2000; lines = 4; words = 6; } else if (difficulty === 'EASY') { time = 20; reward = 150; lines = 2; words = 4; } else if (difficulty === 'MEDIUM') { time = 35; reward = 400; lines = 3; words = 6; } else { time = 50; reward = 1000; lines = 4; words = 8; } return { id, title: difficulty === 'BOSS' ? 'URGENCE' : (difficulty === 'HACKER' ? 'HACKING' : 'Mission'), description: difficulty === 'HACKER' ? 'Piratage...' : 'Tapez vite.', difficulty, reward, timeLimit: time, lines: this.generateRandomLines(lines, words, difficulty) }; }
  generateRandomLines(linesCount: number, wordsPerLine: number, difficulty: string): string[] { const lines = []; const pool = difficulty === 'HACKER' ? this.WORDS_HACKER : (difficulty === 'HARD' || difficulty === 'BOSS' ? this.WORDS_HARD : this.WORDS_EASY); for(let i=0; i<linesCount; i++) { const words = []; for(let j=0; j<wordsPerLine; j++) words.push(pool[Math.floor(Math.random() * pool.length)]); lines.push(words.join(' ')); } return lines; }
  prepareDisplayTokens(text: string): DisplayToken[] { const tokens: DisplayToken[] = []; let globalIndex = 0; const parts = text.split(/(\s+)/); parts.forEach(part => { if (part.length === 0) return; const chars = []; for (let i = 0; i < part.length; i++) { chars.push({ value: part[i], index: globalIndex }); globalIndex++; } tokens.push({ isSpace: /^\s+$/.test(part), chars: chars }); }); return tokens; }
  startMission(mission: Mission) { this.activeMission = mission; this.currentLineIndex = 0; this.loadLine(mission.lines[0]); this.userInput = ""; this.timeLeft = mission.timeLimit; this.missionResult = null; this.currentCombo = 0; this.maxComboReached = 0; this.totalCharsTyped = 0; this.startTime = Date.now(); this.endTime = 0; this.isCoffeeActive = false; this.coffeeAvailable = true; this.startTimer(); this.soundService.playPop(); setTimeout(() => this.focusInput(), 100); }
  loadLine(line: string) { this.currentTargetLine = line; this.currentDisplayTokens = this.prepareDisplayTokens(line); this.userInput = ""; if (this.hiddenInput) this.hiddenInput.nativeElement.value = ""; }
  startTimer() { this.stopTimer(); this.timerInterval = setInterval(() => { if (this.isCoffeeActive) return; const tick = 0.1 * (1 - (this.chairLevel * 0.2)); this.timeLeft -= tick; if (this.timeLeft <= 0) { this.timeLeft = 0; this.endMission(false); } }, 100); }
  stopTimer() { if (this.timerInterval) clearInterval(this.timerInterval); }
  @HostListener('window:keydown', ['$event']) handleKeyboard(event: KeyboardEvent) { if (!this.activeMission || this.missionResult || this.isShopOpen || this.isStaffOpen || this.watchedEmployee) return; this.focusInput(); }
  onInput(event: any) { if (!this.activeMission || this.missionResult) return; const val = event.target.value; if (val.length > this.currentTargetLine.length) { this.userInput = val.slice(0, this.currentTargetLine.length); event.target.value = this.userInput; } else { this.userInput = val; } if (this.userInput.length > this.totalCharsTyped) { const lastChar = this.userInput[this.userInput.length - 1]; if (lastChar === ' ') this.soundService.playSpace(); else this.soundService.playRandomKey(); this.checkInput(); } this.totalCharsTyped = this.userInput.length; }
  checkInput() { const lastIndex = this.userInput.length - 1; if (lastIndex < 0) return; if (this.userInput[lastIndex] === this.currentTargetLine[lastIndex]) { this.currentCombo++; if(this.currentCombo > this.maxComboReached) this.maxComboReached = this.currentCombo; } else { this.currentCombo = 0; this.triggerError(); } if (this.userInput === this.currentTargetLine) { this.soundService.playSuccess(); setTimeout(() => this.nextLine(), 150); } }
  triggerError() { this.hasError = true; this.soundService.playError(); setTimeout(() => this.hasError = false, 300); }
  nextLine() { this.currentLineIndex++; if (this.activeMission && this.currentLineIndex >= this.activeMission.lines.length) { this.endMission(true); } else if (this.activeMission) { this.loadLine(this.activeMission.lines[this.currentLineIndex]); } }
  calculateReward(mission: Mission) { const screenBonus = mission.reward * (this.screenLevel * 0.5); return mission.reward + screenBonus; }
  getScreenBonus(baseReward: number) { return baseReward * (this.screenLevel * 0.5); }
  endMission(success: boolean) { this.stopTimer(); this.endTime = Date.now(); this.missionResult = success ? 'SUCCESS' : 'FAIL'; if (success && this.activeMission) { const base = this.calculateReward(this.activeMission); const comboBonus = this.maxComboReached; this.lastReward = base + comboBonus; this.gameStateService.addMoney(this.lastReward); this.gameStateService.incrementContractsCompleted(); if(this.activeMission.difficulty === 'BOSS') this.gameStateService.incrementBossBeaten(); this.soundService.playSuccess(); } else { this.soundService.playError(); } }
  closeResult() { this.missionResult = null; this.activeMission = null; this.generateMissions(); }
  
  // MODIFIÉ : Utilise successClass depuis le thème actif
  getCharClass(index: number, char: string): string { 
      if (index >= this.userInput.length) return this.activeTheme.textClass + ' opacity-40'; 
      const typedChar = this.userInput[index]; 
      if (typedChar === char) return (this.activeTheme as any).successClass; 
      if (typedChar === ' ') return 'bg-red-500/50 text-white'; 
      return 'text-red-500 font-bold'; 
  }
  
  getIcon(diff: string) { return diff === 'BOSS' ? '👹' : (diff === 'HACKER' ? '💻' : (diff === 'EASY' ? '🟢' : (diff === 'MEDIUM' ? '🟠' : '🔴'))); }
  getDifficultyClass(diff: string) { if(diff === 'HACKER') return 'border-green-500 text-green-500 bg-green-900/20'; if(diff === 'BOSS') return 'border-red-500 text-red-500 bg-red-900/20 animate-pulse'; return 'border-slate-500 text-slate-500'; }
  getMissionClass(diff: string) { if(diff === 'HACKER') return 'border-green-500 bg-green-900/10'; if(diff === 'BOSS') return 'border-red-500 bg-red-900/10'; return 'border-slate-700 bg-slate-800'; }
}