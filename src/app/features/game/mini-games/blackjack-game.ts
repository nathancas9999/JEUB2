import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { GameStateService } from '../../../core/services/game-state.service';
import { SoundService } from '../../../core/services/sound.service';
import { FirebaseService } from '../../../core/services/firebase.service';
import { trigger, transition, style, animate, query, stagger, keyframes, state } from '@angular/animations';
import { Subscription } from 'rxjs';

interface Card { suit: string; value: string; numValue: number; isRed: boolean; id: string; isFaceDown?: boolean; }
interface FlyingChip { id: number; value: number; startX: number; startY: number; targetX: number; targetY: number; }
interface Seat { 
    id: number; 
    hand: Card[]; 
    bet: number; 
    score: number; 
    status: 'EMPTY' | 'BETTING' | 'PLAYING' | 'BUST' | 'STAND' | 'BLACKJACK' | 'WIN' | 'LOSE' | 'PUSH'; 
    isBot: boolean; 
    name: string; 
    avatar?: string;
    resultMessage?: string; 
    resultAmount?: number; 
}

type GameStatus = 'BETTING' | 'PLAYING' | 'DEALER_TURN' | 'RESULT';

@Component({
  selector: 'app-blackjack-game',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('chipsIn', [
      transition(':enter', [
        query('.chip-btn', [
          style({ opacity: 0, transform: 'translateY(50px) scale(0.5)' }),
          stagger(50, [
            animate('400ms cubic-bezier(0.23, 1, 0.32, 1)', style({ opacity: 1, transform: 'translateY(0) scale(1)' }))
          ])
        ])
      ])
    ]),
    trigger('cardDeal', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translate(200px, -200px) rotate(45deg) scale(0.5)' }),
        animate('500ms cubic-bezier(0.175, 0.885, 0.32, 1.1)', style({ opacity: 1, transform: 'translate(0, 0) rotate(0) scale(1)' }))
      ])
    ]),
    trigger('cardFlip', [
      state('face-down', style({ transform: 'rotateY(0)' })),
      state('face-up', style({ transform: 'rotateY(180deg)' })),
      transition('face-down => face-up', [
        animate('600ms cubic-bezier(0.455, 0.03, 0.515, 0.955)')
      ])
    ]),
    trigger('scorePop', [
      transition(':increment', [
        animate('200ms ease-in-out', keyframes([
          style({ transform: 'scale(1)', offset: 0 }),
          style({ transform: 'scale(1.5)', offset: 0.5 }),
          style({ transform: 'scale(1)', offset: 1 })
        ]))
      ])
    ]),
    trigger('modalPop', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.8) translateY(20px)' }),
        animate('0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)', style({ opacity: 1, transform: 'scale(1) translateY(0)' }))
      ])
    ])
  ],
  template: `
    <div class="h-full flex flex-col font-sans select-none relative overflow-hidden text-slate-200 shadow-[inset_0_0_150px_rgba(0,0,0,0.9)] transition-colors duration-1000"
         [class.bg-[#0f172a]]="!isSpotlightMode"
         [class.bg-[#05080f]]="isSpotlightMode">
      
      <div class="absolute top-0 left-0 w-full bg-black/60 backdrop-blur-sm border-b border-white/5 h-8 flex items-center overflow-hidden z-30">
          <div class="whitespace-nowrap animate-marquee flex gap-8">
             <span *ngFor="let msg of tickerMessages" class="text-xs font-mono font-bold text-green-400 flex items-center gap-2">
                <span class="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span> {{ msg }}
             </span>
          </div>
      </div>

      <div class="absolute -top-10 -right-10 w-40 h-60 bg-slate-900 border border-slate-700 rounded-xl rotate-12 shadow-2xl z-0 deck-stack">
         <div class="absolute inset-0 bg-red-900/20 rounded-xl"></div>
         <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-slate-700 font-black opacity-20 text-4xl rotate-90">JEUB2</div>
      </div>
      
      <div class="absolute inset-0 pointer-events-none transition-opacity duration-1000" [class.opacity-0]="!isSpotlightMode" [class.opacity-100]="isSpotlightMode">
          <div class="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-amber-500/10 blur-[100px] rounded-full mix-blend-screen"></div>
      </div>

      <div class="absolute top-[-50px] right-[20%] w-32 h-32 z-50 pointer-events-none transition-transform duration-300"
           [style.transform]="dealerHandTransform">
           <div class="w-full h-full bg-white rounded-full opacity-10 blur-xl"></div>
           <div class="text-6xl absolute top-0 left-0 drop-shadow-2xl">🧤</div>
      </div>

      <div class="flex justify-between items-start z-30 mt-10 mb-4 px-6 relative">
        <div class="flex flex-col bg-slate-950/80 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-xl transition-all hover:border-white/20 group relative overflow-hidden">
          <div *ngIf="isOwner" class="absolute inset-0 bg-amber-500/10 pointer-events-none animate-pulse"></div>
          <div class="flex items-center gap-2 mb-1">
              <span class="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">{{ isOwner ? '👑 PROPRIÉTAIRE' : 'Votre Solde' }}</span>
              <div class="flex gap-1">
                  <span *ngFor="let b of badges" class="text-xs" [title]="b.name">{{ b.icon }}</span>
              </div>
          </div>
          <span class="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300 font-mono filter drop-shadow">{{ currentMoney | number:'1.0-0' }} €</span>
          <button *ngIf="sessionWinnings > 1000000 && !isOwner" (click)="buyCasino()" 
                  class="mt-2 text-[10px] bg-gradient-to-r from-amber-600 to-amber-500 text-white font-black px-3 py-1.5 rounded hover:scale-105 transition-transform shadow-lg animate-bounce border border-amber-400/50">
             🏰 RACHETER LE CASINO (1M€)
          </button>
        </div>

        <div class="flex gap-4">
            <button (click)="openDuelLobby()" class="px-4 py-2 rounded-xl border text-xs font-bold transition-all shadow-lg backdrop-blur-md"
                    [class]="isDuelMode ? 'bg-purple-600/80 border-purple-400 text-white shadow-purple-500/20' : 'bg-slate-900/50 border-slate-600 text-slate-400 hover:bg-slate-800'">
                {{ isDuelMode ? '⚔️ DUEL (ONLINE)' : '👤 SOLO' }}
            </button>
            <button (click)="toggleStats()" class="w-10 h-10 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center hover:bg-slate-700 text-xl shadow-lg">
                📝
            </button>
        </div>
      </div>

      <div class="flex-1 flex flex-col relative z-10 min-h-0 transition-all duration-700" [class.blur-sm]="globalStatus === 'RESULT' && winAmount > 0">
        
        <div class="flex flex-col items-center h-48 relative justify-end mt-4">
           <div class="flex items-center gap-3 mb-4 z-10 transition-opacity duration-300" [class.opacity-0]="dealerHand.length === 0">
              <span class="text-xs font-black uppercase tracking-widest text-slate-500 drop-shadow-md">Croupier</span>
              <span class="bg-slate-900 text-slate-200 text-xs font-bold px-3 py-1 rounded-full border border-slate-700 shadow-lg min-w-[2rem] text-center" [@scorePop]="dealerScore">
                {{ dealerScoreDisplay }}
              </span>
           </div>
           <div class="flex justify-center -space-x-14 perspective-1000">
              <div *ngFor="let card of dealerHand; let i = index" class="card-wrapper w-[90px] h-[126px]" @cardDeal>
                  <div *ngIf="!card.isFaceDown" class="card-inner w-full h-full relative rounded-xl shadow-2xl bg-slate-100 border border-slate-300 overflow-hidden transform transition-transform hover:-translate-y-4 hover:rotate-1"
                       [class.text-red-600]="card.isRed" [class.text-slate-900]="!card.isRed">
                      <div class="absolute top-2 left-2 text-lg font-black leading-none">{{ card.value }}<br><span class="text-xl">{{ card.suit }}</span></div>
                      <div class="absolute inset-0 flex items-center justify-center text-6xl opacity-90">{{ card.suit }}</div>
                      <div class="absolute bottom-2 right-2 text-lg font-black leading-none rotate-180">{{ card.value }}<br><span class="text-xl">{{ card.suit }}</span></div>
                  </div>
                  <div *ngIf="card.isFaceDown" class="flip-container w-full h-full relative">
                      <div class="flipper w-full h-full relative transition-transform duration-700 transform-style-3d" [class.flipped]="cardRevealed">
                          <div class="front w-full h-full absolute top-0 left-0 backface-hidden rounded-xl border-2 border-white/80 bg-gradient-to-br from-red-700 to-red-900 shadow-2xl flex items-center justify-center overflow-hidden">
                              <div class="absolute inset-0 pattern-grid opacity-30"></div>
                              <div class="w-12 h-12 rounded-full border-2 border-white/20"></div>
                          </div>
                          <div class="back w-full h-full absolute top-0 left-0 backface-hidden rounded-xl bg-slate-100 border border-slate-300 shadow-2xl flex items-center justify-center rotate-y-180"
                               [class.text-red-600]="card.isRed" [class.text-slate-900]="!card.isRed">
                              <div class="absolute top-2 left-2 text-lg font-black leading-none">{{ card.value }}<br><span class="text-xl">{{ card.suit }}</span></div>
                              <div class="text-6xl">{{ card.suit }}</div>
                              <div class="absolute bottom-2 right-2 text-lg font-black leading-none rotate-180">{{ card.value }}<br><span class="text-xl">{{ card.suit }}</span></div>
                          </div>
                      </div>
                  </div>
              </div>
           </div>
        </div>

        <div class="flex-1"></div>

        <div class="grid grid-cols-3 gap-4 px-4 h-56 items-end mb-8 relative">
            <div *ngFor="let seat of seats; let i = index" 
                 (click)="addToBet($event, i)"
                 class="relative flex flex-col items-center justify-end h-full transition-all duration-300 rounded-xl hover:bg-white/5 cursor-pointer border border-transparent hover:border-white/10"
                 [class.opacity-50]="activeSeatIndex !== null && activeSeatIndex !== i && seat.status !== 'EMPTY'"
                 [class.scale-105]="activeSeatIndex === i">
                
                <button *ngIf="seat.status === 'EMPTY'" (click)="$event.stopPropagation(); occupySeat(i)" 
                        class="w-20 h-20 rounded-full border-2 border-dashed border-slate-600 flex items-center justify-center text-slate-500 hover:border-slate-400 hover:text-slate-300 transition-colors mb-8 group flex-col gap-1">
                    <span class="text-2xl group-hover:scale-110 transition-transform">➕</span>
                    <span class="text-[9px] font-bold">REJOINDRE</span>
                </button>

                <div *ngIf="seat.status === 'BETTING'" class="flex flex-col items-center mb-8 animate-fade-in w-full">
                    <div class="text-[10px] font-bold uppercase text-slate-500 mb-1 flex items-center gap-1">
                        <span *ngIf="seat.avatar" class="text-sm">{{ seat.avatar }}</span> 
                        <span *ngIf="seat.isBot" class="text-xs">🤖</span> {{ seat.name }}
                    </div>
                    <div class="relative group">
                        <div class="w-16 h-16 rounded-full border-4 border-dashed border-amber-500/30 bg-amber-900/20 flex items-center justify-center animate-pulse-slow group-hover:border-green-500/50 transition-colors"></div>
                        <div class="absolute inset-0 flex items-center justify-center font-black text-amber-400 text-sm lg:text-lg drop-shadow-md">
                            {{ seat.bet | number:'1.0-0' }}
                        </div>
                        <div class="absolute -top-8 left-1/2 -translate-x-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button (click)="$event.stopPropagation(); clearBet(i)" *ngIf="seat.bet > 0" class="bg-red-600/80 hover:bg-red-500 text-white text-[10px] px-2 py-1 rounded shadow">Effacer</button>
                        </div>
                    </div>
                    <div *ngIf="!seat.isBot" class="text-[9px] text-slate-600 mt-1 uppercase tracking-wider">Cliquer pour miser</div>
                </div>

                <div *ngIf="['PLAYING', 'STAND', 'BUST', 'BLACKJACK', 'WIN', 'LOSE', 'PUSH'].includes(seat.status)" class="flex flex-col items-center w-full">
                    <div *ngIf="seat.resultMessage && winAmount === 0" @handEntry class="absolute -top-10 z-50 flex flex-col items-center pointer-events-none">
                        <div class="text-2xl font-black text-white stroke-text shadow-xl"
                             [class.text-green-400]="seat.status === 'WIN'"
                             [class.text-red-500]="seat.status === 'LOSE'"
                             [class.text-amber-400]="seat.status === 'BLACKJACK'">
                            {{ seat.resultMessage }}
                        </div>
                    </div>

                    <div class="flex justify-center -space-x-10 mb-2 z-20 perspective-1000 min-h-[100px]">
                        <div *ngFor="let card of seat.hand" class="card-wrapper w-[70px] h-[98px]" @cardDeal>
                            <div class="card-inner w-full h-full relative rounded-lg shadow-md bg-slate-100 border border-slate-300 overflow-hidden"
                                 [class.text-red-600]="card.isRed" [class.text-slate-900]="!card.isRed">
                                <div class="absolute top-1 left-1 text-xs font-black leading-none">{{ card.value }}<br>{{ card.suit }}</div>
                                <div class="absolute inset-0 flex items-center justify-center text-4xl opacity-90">{{ card.suit }}</div>
                                <div class="absolute bottom-1 right-1 text-xs font-black leading-none rotate-180">{{ card.value }}<br>{{ card.suit }}</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex items-center gap-2 z-10">
                        <span class="text-[10px] font-bold uppercase text-slate-500">{{ seat.name }}</span>
                        <span class="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow border border-blue-400">
                            {{ seat.score }}
                        </span>
                    </div>
                </div>

                <div *ngIf="activeSeatIndex === i" class="absolute -bottom-2 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-b-[15px] border-b-yellow-400 animate-bounce"></div>
            </div>
        </div>
      </div>

      <div *ngIf="isLobbyOpen" class="absolute inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-black/80 animate-fade-in" (click)="closeLobby()">
          <div class="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden" (click)="$event.stopPropagation()">
              <div class="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                  <h3 class="font-black text-white text-lg">⚔️ JOUEURS EN LIGNE</h3>
                  <button (click)="closeLobby()" class="text-slate-400 hover:text-white">✕</button>
              </div>
              <div class="max-h-96 overflow-y-auto p-4 custom-scroll">
                  <div *ngIf="onlinePlayers.length === 0" class="text-center text-slate-500 py-8">
                      Aucun joueur trouvé... 😴<br>
                      <span class="text-xs">Attendez qu'ils se connectent !</span>
                  </div>
                  <div *ngFor="let p of onlinePlayers" 
                       (click)="challengePlayer(p)"
                       class="flex items-center justify-between p-3 rounded-xl bg-slate-800 hover:bg-purple-900/30 border border-slate-700 hover:border-purple-500 cursor-pointer transition-all mb-2 group">
                      <div class="flex items-center gap-3">
                          <div class="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-xl shadow-inner">{{ p.avatarId }}</div>
                          <div>
                              <div class="font-bold text-white group-hover:text-purple-300">{{ p.username }}</div>
                              <div class="text-[10px] text-slate-400">{{ p.title }} • {{ p.money | number:'1.0-0' }}€</div>
                          </div>
                      </div>
                      <button class="bg-purple-600 text-white text-xs font-bold px-3 py-1.5 rounded hover:bg-purple-500 shadow-lg">INVITER</button>
                  </div>
              </div>
          </div>
      </div>

      <div *ngIf="globalStatus === 'RESULT' && winAmount > 0" class="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div class="bg-black/80 backdrop-blur-xl border border-amber-500/30 p-10 rounded-3xl shadow-2xl flex flex-col items-center gap-4 pointer-events-auto max-w-lg w-full mx-4" @modalPop>
              <div class="text-center">
                  <div class="text-amber-400 text-sm font-bold uppercase tracking-[0.5em] mb-2">Résultat de la manche</div>
                  <div class="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 via-amber-500 to-amber-700 filter drop-shadow-[0_5px_5px_rgba(0,0,0,0.5)]">
                      VICTOIRE
                  </div>
              </div>
              <div class="w-full h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent my-2"></div>
              <div class="flex flex-col items-center gap-1">
                  <div class="text-slate-400 text-xs uppercase tracking-widest">Gains Totaux</div>
                  <div class="text-5xl font-mono font-black text-green-400 text-shadow-glow">
                      +{{ winAmount | number:'1.0-0' }} €
                  </div>
              </div>
              <button (click)="resetRound()" class="mt-6 w-full py-4 bg-white text-black font-black text-xl rounded-xl hover:scale-105 transition-transform shadow-xl active:scale-95 uppercase tracking-wider">
                  Continuer
              </button>
          </div>
      </div>

      <div class="mt-auto relative h-40 flex items-center justify-center z-40 bg-gradient-to-t from-black/90 via-black/80 to-transparent">
        <div *ngFor="let fc of flyingChips" 
             class="fixed pointer-events-none z-[100] transition-all duration-500 ease-in-out"
             [style.left.px]="fc.startX" [style.top.px]="fc.startY" [class.flying-target]="fc.targetX > 0">
             <div class="w-12 h-12 rounded-full shadow-2xl animate-spin-slow" [ngClass]="getChipStyle(fc.value)">
                <div class="w-full h-full rounded-full border-2 border-dashed border-white/30 flex items-center justify-center font-black text-[10px]">{{ fc.value | number:'1.0-0' }}</div>
             </div>
        </div>

        <div *ngIf="globalStatus === 'BETTING'" @chipsIn class="flex flex-col items-center gap-3 w-full px-4">
           <div class="flex gap-3 justify-center w-full overflow-x-auto pb-2 scrollbar-hide">
              <button *ngFor="let chip of chips" 
                      (click)="selectChip(chip)"
                      [class.ring-4]="selectedChip === chip"
                      [class.ring-white]="selectedChip === chip"
                      [disabled]="currentMoney < chip"
                      class="chip-btn group relative w-14 h-14 lg:w-16 lg:h-16 shrink-0 rounded-full transition-transform active:scale-90 hover:-translate-y-2 duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                      [ngClass]="getChipShadow(chip)">
                  <div class="absolute inset-0 rounded-full translate-y-1 brightness-75" [ngClass]="getChipBg(chip)"></div>
                  <div class="absolute inset-0 rounded-full flex items-center justify-center border-[3px] border-dashed border-white/40 shadow-inner" [ngClass]="getChipBg(chip)">
                      <span class="font-black text-[10px] lg:text-xs drop-shadow-md z-10">{{ chip | number:'1.0-0' }}</span>
                  </div>
              </button>
           </div>
           <div class="flex gap-4 w-full justify-center">
               <button (click)="allIn()" class="px-6 py-2 bg-red-900/50 border border-red-500/50 hover:bg-red-800 text-red-200 font-bold uppercase text-xs rounded-lg transition-colors">🔥 TAPIS</button>
               <button (click)="startRound()" [disabled]="!canStartRound()"
                       class="px-12 py-3 bg-gradient-to-r from-green-600 to-emerald-500 text-white font-black uppercase text-sm rounded-xl shadow-lg hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 border-b-4 border-green-800 active:border-b-0 active:translate-y-1">DISTRIBUER</button>
           </div>
        </div>

        <div *ngIf="globalStatus === 'PLAYING' && activeSeatIndex !== null && !seats[activeSeatIndex].isBot" class="flex gap-6 animate-fade-in-up pb-4">
           <button (click)="hit()" class="action-btn bg-slate-800 hover:bg-slate-700 text-white border-slate-600">
              <div class="text-2xl mb-1">👇</div><div class="text-[10px] font-black uppercase tracking-wider">Carte</div>
           </button>
           <button (click)="stand()" class="action-btn bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.4)]">
              <div class="text-2xl mb-1">✋</div><div class="text-[10px] font-black uppercase tracking-wider">Rester</div>
           </button>
           <button *ngIf="canDouble" (click)="double()" class="action-btn bg-amber-500 hover:bg-amber-400 text-amber-950 border-amber-300">
              <div class="text-2xl mb-1">💰</div><div class="text-[10px] font-black uppercase tracking-wider">Doubler</div>
           </button>
        </div>
        
        <div *ngIf="globalStatus === 'RESULT' && winAmount === 0" class="pb-4">
            <button (click)="resetRound()" class="px-10 py-3 bg-white text-slate-900 font-black text-lg rounded-xl hover:scale-105 transition-transform shadow-xl active:scale-95">NOUVELLE MANCHE 🎲</button>
        </div>
      </div>
      
      <div *ngIf="showStats" class="absolute right-4 bottom-32 bg-yellow-50 text-slate-900 p-4 rounded-sm shadow-2xl rotate-2 w-48 font-mono text-xs border border-slate-300 z-50 animate-fade-up">
          <div class="font-bold border-b border-slate-400 pb-1 mb-2 flex justify-between">
              <span>SESSION LOG</span>
              <span class="cursor-pointer" (click)="toggleStats()">✕</span>
          </div>
          <div class="space-y-1 max-h-32 overflow-y-auto">
              <div class="flex justify-between" *ngFor="let log of sessionLogs">
                  <span>{{ log.result }}</span>
                  <span [class.text-green-600]="log.amount > 0" [class.text-red-600]="log.amount < 0">{{ log.amount > 0 ? '+' : ''}}{{ log.amount }}</span>
              </div>
          </div>
          <div class="border-t border-slate-400 pt-1 mt-2 font-bold flex justify-between">
              <span>TOTAL</span>
              <span [class.text-green-600]="sessionWinnings >= 0" [class.text-red-600]="sessionWinnings < 0">{{ sessionWinnings }} €</span>
          </div>
      </div>
    </div>
  `,
  styles: [`
    .table-mat { background: radial-gradient(circle at 50% 30%, #1e293b 0%, #020617 100%); }
    .pattern-grid { background-image: radial-gradient(#fff 1px, transparent 1px); background-size: 10px 10px; }
    .perspective-1000 { perspective: 1000px; }
    .transform-style-3d { transform-style: preserve-3d; }
    .backface-hidden { backface-visibility: hidden; }
    .rotate-y-180 { transform: rotateY(180deg); }
    .flipper.flipped { transform: rotateY(180deg); }
    .action-btn { @apply w-24 h-24 rounded-2xl border-b-4 active:border-b-0 active:translate-y-1 transition-all flex flex-col items-center justify-center shadow-2xl; }
    .animate-fade-in-up { animation: fadeInUp 0.4s ease-out; }
    @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    .stroke-text { -webkit-text-stroke: 1px rgba(0,0,0,0.5); }
    .animate-marquee { animation: marquee 20s linear infinite; }
    @keyframes marquee { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }
    .scrollbar-hide::-webkit-scrollbar { display: none; }
    .text-shadow-glow { text-shadow: 0 0 20px rgba(74, 222, 128, 0.5); }
    .animate-fade-in { animation: fadeIn 0.3s ease-out; }
    .animate-fade-in-down { animation: fadeInDown 0.5s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
    @keyframes fadeInDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
  `]
})
export class BlackjackGameComponent implements OnInit, OnDestroy {
  
  globalStatus: GameStatus = 'BETTING';
  currentMoney = 0;
  myUsername = 'Moi';
  
  seats: Seat[] = [
      { id: 0, hand: [], bet: 0, score: 0, status: 'EMPTY', isBot: true, name: 'Siège 1' },
      { id: 1, hand: [], bet: 0, score: 0, status: 'BETTING', isBot: false, name: 'Vous' },
      { id: 2, hand: [], bet: 0, score: 0, status: 'EMPTY', isBot: false, name: 'Siège 3' }
  ];
  
  activeSeatIndex: number | null = null;
  dealerHand: Card[] = [];
  cardRevealed = false;
  deck: Card[] = [];
  
  chips = [100, 1000, 10000, 100000, 1000000];
  selectedChip = 100;
  flyingChips: FlyingChip[] = [];
  
  isSpotlightMode = false;
  isDuelMode = false;
  isLobbyOpen = false;
  onlinePlayers: any[] = [];
  isOwner = false;
  dealerHandTransform = 'translate(0,0)';
  
  showStats = false;
  sessionLogs: { result: string, amount: number }[] = [];
  sessionWinnings = 0;
  tickerMessages: string[] = ["Bienvenue au Casino Royal • Installez-vous !"];
  private tickerSub!: Subscription;
  badges: { name: string, icon: string }[] = [];

  constructor(
      private gameState: GameStateService, 
      private sound: SoundService, 
      private cdr: ChangeDetectorRef,
      private firebase: FirebaseService
  ) {}

  ngOnInit() {
    this.gameState.gameState$.subscribe(state => {
      this.currentMoney = state.money;
      if(state.user) this.myUsername = state.user.username;
      this.updateBadges();
      this.cdr.markForCheck();
    });
    this.createDeck();
    this.seats[0].status = 'EMPTY';

    this.tickerSub = this.firebase.publicEvents$.subscribe(events => {
        if (events && events.length > 0) {
            this.tickerMessages = events;
            this.cdr.markForCheck();
        }
    });
  }

  ngOnDestroy() {
      if (this.tickerSub) this.tickerSub.unsubscribe();
  }

  // --- LOGIQUE ---

  createDeck() {
    const suits = ['♠', '♥', '♦', '♣'];
    const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    this.deck = [];
    for(let k=0; k<4; k++) {
        for (const suit of suits) {
            for (const value of values) {
                let num = parseInt(value);
                if (isNaN(num)) num = value === 'A' ? 11 : 10;
                this.deck.push({ suit, value, numValue: num, isRed: suit === '♥' || suit === '♦', id: k+suit+value+Math.random(), isFaceDown: false });
            }
        }
    }
    this.deck.sort(() => Math.random() - 0.5);
  }

  drawCard(isFaceDown = false): Card {
    if (this.deck.length < 20) this.createDeck();
    const card = this.deck.pop()!;
    card.isFaceDown = isFaceDown;
    this.animateDealerHand();
    return card;
  }

  animateDealerHand() {
      this.dealerHandTransform = 'translate(-50px, 50px)';
      setTimeout(() => { this.dealerHandTransform = 'translate(0,0)'; this.cdr.markForCheck(); }, 150);
  }

  // --- LOBBY & DUEL ---

  async openDuelLobby() {
      if (this.globalStatus !== 'BETTING') return;
      this.isLobbyOpen = true;
      this.onlinePlayers = await this.firebase.getOnlinePlayers();
      this.cdr.markForCheck();
  }

  closeLobby() { this.isLobbyOpen = false; }

  challengePlayer(player: any) {
      // 1. Envoyer la notification via Firebase
      this.firebase.sendInvite(player.id, player.username, 'BLACKJACK', 10000, this.myUsername);
      
      // 2. Simuler son arrivée locale (le temps qu'on implémente le vrai PVP temps réel)
      this.seats[0].status = 'BETTING';
      this.seats[0].isBot = true; // Pour l'instant on garde l'IA pour jouer à sa place
      this.seats[0].name = player.username;
      this.seats[0].avatar = player.avatarId;
      this.seats[0].bet = Math.min(player.money, 5000); 
      
      this.isDuelMode = true;
      this.closeLobby();
      this.sound.playSuccess();
      alert(`Invitation envoyée à ${player.username} ! (Il sera joué par l'IA en attendant)`);
  }

  toggleDuelMode() {
      if (this.globalStatus !== 'BETTING') return;
      if (!this.isDuelMode) {
          this.openDuelLobby();
      } else {
          this.isDuelMode = false;
          this.seats[0].status = 'EMPTY';
          this.seats[0].bet = 0;
          this.seats[0].isBot = false;
      }
  }

  occupySeat(index: number) {
      this.seats[index].status = 'BETTING';
      this.seats[index].name = `Moi (${index+1})`;
      this.seats[index].isBot = false;
  }

  selectChip(val: number) { this.selectedChip = val; }

  addToBet(event: MouseEvent, seatIndex: number) {
      if (this.currentMoney < this.selectedChip) { this.sound.playError(); return; }
      if (this.seats[seatIndex].status !== 'BETTING' || this.seats[seatIndex].isBot) return;

      const chipId = Date.now();
      this.flyingChips.push({ id: chipId, value: this.selectedChip, startX: event.clientX, startY: event.clientY, targetX: 0, targetY: 0 });
      
      this.gameState.addMoney(-this.selectedChip);
      this.seats[seatIndex].bet += this.selectedChip;
      this.sound.playNoise(0.05, 'lowpass', 400, 0.4);
      
      setTimeout(() => this.flyingChips = this.flyingChips.filter(c => c.id !== chipId), 400);
  }
  
  clearBet(index: number) {
      if (this.seats[index].bet > 0 && !this.seats[index].isBot) {
          this.gameState.addMoney(this.seats[index].bet);
          this.seats[index].bet = 0;
          this.sound.playSoftPop();
      } else if (index !== 1) {
          this.seats[index].status = 'EMPTY';
      }
  }

  allIn() {
      if (this.currentMoney <= 0) return;
      const seat = this.seats[1];
      if (seat.status === 'BETTING') {
          const amount = this.currentMoney;
          this.gameState.addMoney(-amount);
          seat.bet += amount;
          this.sound.playCash();
      }
  }

  canStartRound() { return this.seats.some(s => s.status === 'BETTING' && s.bet > 0); }

  // --- JEU ---

  startRound() {
      this.globalStatus = 'PLAYING';
      this.dealerHand = [];
      this.cardRevealed = false;
      this.isSpotlightMode = false;
      this.winAmount = 0;
      
      this.seats.forEach(s => {
          if(s.status === 'BETTING' && s.bet > 0) {
              s.status = 'PLAYING'; s.hand = []; s.score = 0; s.resultMessage = '';
          } else if (s.status === 'BETTING') {
              s.status = 'EMPTY';
          }
      });

      let step = 0;
      const interval = setInterval(() => {
          step++;
          if (step === 1) this.seats.forEach(s => { if(s.status === 'PLAYING') s.hand.push(this.drawCard()); });
          if (step === 2) this.dealerHand.push(this.drawCard());
          if (step === 3) this.seats.forEach(s => { if(s.status === 'PLAYING') s.hand.push(this.drawCard()); });
          if (step === 4) this.dealerHand.push(this.drawCard(true));

          this.updateScores();
          this.sound.playNoise(0.02, 'highpass', 1200, 0.2);
          this.cdr.markForCheck();

          if (step === 4) {
              clearInterval(interval);
              setTimeout(() => this.checkBlackjacks(), 500);
          }
      }, 400);
  }

  updateScores() {
      this.seats.forEach(s => s.score = this.calculateScore(s.hand));
  }

  get dealerScore() { 
      if (this.globalStatus === 'PLAYING' && this.dealerHand.length >= 2 && !this.cardRevealed) return this.calculateScore([this.dealerHand[0]]);
      return this.calculateScore(this.dealerHand); 
  }
  get dealerScoreDisplay() { return this.dealerScore; }

  get winAmount() {
      return this.seats.reduce((acc, s) => acc + (s.resultAmount || 0), 0);
  }
  set winAmount(v: number) { }

  checkBlackjacks() {
      let allDone = true;
      this.seats.forEach(s => {
          if (s.status === 'PLAYING' && s.score === 21) {
              s.status = 'BLACKJACK';
              this.sound.playSuccess();
          }
          if (s.status === 'PLAYING') allDone = false;
      });
      
      if (allDone) this.startDealerTurn();
      else this.nextTurn();
  }

  nextTurn() {
      const nextIndex = this.seats.findIndex((s, i) => s.status === 'PLAYING' && (this.activeSeatIndex === null || i > this.activeSeatIndex));
      
      if (nextIndex !== -1) {
          this.activeSeatIndex = nextIndex;
          if (this.seats[nextIndex].isBot) {
              setTimeout(() => this.playBotTurn(nextIndex), 500);
          }
      } else {
          this.activeSeatIndex = null;
          this.startDealerTurn();
      }
      this.cdr.markForCheck();
  }

  get canDouble() { 
      if (this.activeSeatIndex === null) return false;
      const s = this.seats[this.activeSeatIndex];
      return s.hand.length === 2 && this.currentMoney >= s.bet;
  }

  hit() {
      if (this.activeSeatIndex === null) return;
      const seat = this.seats[this.activeSeatIndex];
      seat.hand.push(this.drawCard());
      this.updateScores();
      this.sound.playNoise(0.02, 'highpass', 1500, 0.15);
      
      if (seat.score > 21) {
          seat.status = 'BUST';
          seat.resultMessage = 'SAUTÉ !';
          this.sound.playError();
          setTimeout(() => this.nextTurn(), 800);
      }
  }

  stand() {
      if (this.activeSeatIndex === null) return;
      this.seats[this.activeSeatIndex].status = 'STAND';
      this.nextTurn();
  }

  double() {
      if (this.activeSeatIndex === null) return;
      const seat = this.seats[this.activeSeatIndex];
      this.gameState.addMoney(-seat.bet);
      seat.bet *= 2;
      seat.hand.push(this.drawCard());
      this.updateScores();
      this.sound.playCash();
      
      if (seat.score > 21) {
          seat.status = 'BUST';
          seat.resultMessage = 'SAUTÉ !';
      } else {
          seat.status = 'STAND';
      }
      setTimeout(() => this.nextTurn(), 1000);
  }

  async playBotTurn(index: number) {
      let seat = this.seats[index];
      while (seat.score < 17) {
          await new Promise(r => setTimeout(r, 1000));
          seat.hand.push(this.drawCard());
          this.updateScores();
          this.cdr.markForCheck();
      }
      if (seat.score > 21) seat.status = 'BUST'; else seat.status = 'STAND';
      await new Promise(r => setTimeout(r, 500));
      this.nextTurn();
  }

  async startDealerTurn() {
      this.globalStatus = 'DEALER_TURN';
      this.isSpotlightMode = true;
      this.activeSeatIndex = null;
      
      this.cardRevealed = true;
      this.sound.playNoise(0.1, 'lowpass', 600, 0.3);
      await new Promise(r => setTimeout(r, 600));
      this.dealerHand[1].isFaceDown = false;
      this.cdr.markForCheck();

      while (this.dealerScore < 17) {
          await new Promise(r => setTimeout(r, 1000));
          this.dealerHand.push(this.drawCard());
          this.sound.playNoise(0.02, 'highpass', 1200, 0.2);
          this.cdr.markForCheck();
      }

      await new Promise(r => setTimeout(r, 500));
      this.resolveRound();
  }

  resolveRound() {
      this.globalStatus = 'RESULT';
      const dScore = this.dealerScore;
      const dealerBust = dScore > 21;
      const dealerBlackjack = dScore === 21 && this.dealerHand.length === 2;

      this.seats.forEach(s => {
          if (s.status === 'EMPTY' || s.status === 'BETTING') return;

          let win = 0;
          s.resultAmount = 0;
          
          if (s.status === 'BUST') {
              this.logSession(`Siège ${s.id} Bust`, -s.bet);
          }
          else if (s.status === 'BLACKJACK') {
              if (dealerBlackjack) {
                  s.status = 'PUSH'; s.resultMessage = 'EGALITÉ'; win = s.bet;
                  this.logSession(`Siège ${s.id} Push`, 0);
              } else {
                  s.status = 'WIN'; s.resultMessage = 'BLACKJACK !!'; win = s.bet * 2.5;
                  this.sound.playCash();
              }
          }
          else {
              if (dealerBlackjack) {
                  s.status = 'LOSE'; s.resultMessage = 'PERDU';
              } else if (dealerBust) {
                  s.status = 'WIN'; s.resultMessage = 'GAGNÉ'; win = s.bet * 2;
              } else if (s.score > dScore) {
                  s.status = 'WIN'; s.resultMessage = 'GAGNÉ'; win = s.bet * 2;
              } else if (s.score === dScore) {
                  s.status = 'PUSH'; s.resultMessage = 'EGALITÉ'; win = s.bet;
                  this.logSession(`Siège ${s.id} Push`, 0);
              } else {
                  s.status = 'LOSE'; s.resultMessage = 'PERDU';
              }
          }

          if (win > 0) {
              this.gameState.addMoney(win);
              s.resultAmount = win;
              if (win > s.bet) {
                  this.logSession(`Siège ${s.id} Gain`, win - s.bet);
                  if (win > 50000) {
                      this.gameState.gameState$.subscribe(gs => {
                          this.firebase.logPublicEvent(`🔥 ${gs.user?.username} a raflé ${win}€ au Casino !`, 'JACKPOT');
                      }).unsubscribe();
                  }
              }
          } else if (win === 0 && s.status !== 'PUSH') {
              this.logSession(`Siège ${s.id} Perte`, -s.bet);
          }
      });
      
      this.cdr.markForCheck();
  }

  resetRound() {
      this.globalStatus = 'BETTING';
      this.isSpotlightMode = false;
      this.activeSeatIndex = null;
      this.dealerHand = [];
      
      this.seats.forEach(s => {
          if (s.status !== 'EMPTY') {
              s.status = 'BETTING';
              s.hand = [];
              s.score = 0;
              s.resultMessage = '';
              s.resultAmount = 0;
              s.bet = 0;
          }
      });
  }

  calculateScore(hand: Card[]): number {
    let score = 0;
    let aces = 0;
    for (const card of hand) {
      if (card.isFaceDown) continue;
      score += card.numValue;
      if (card.value === 'A') aces++;
    }
    while (score > 21 && aces > 0) { score -= 10; aces--; }
    return score;
  }

  getChipBg(value: number) {
    if (value === 100) return 'bg-slate-400 text-slate-900';
    if (value === 1000) return 'bg-emerald-600 text-white';
    if (value === 10000) return 'bg-blue-600 text-white';
    if (value === 100000) return 'bg-purple-600 text-white';
    return 'bg-black text-amber-400 border-amber-400';
  }
  getChipShadow(value: number) {
    if (value === 100) return 'shadow-[0_4px_0_#94a3b8]';
    if (value === 1000) return 'shadow-[0_4px_0_#065f46]';
    if (value === 10000) return 'shadow-[0_4px_0_#1e3a8a]';
    if (value === 100000) return 'shadow-[0_4px_0_#581c87]';
    return 'shadow-[0_4px_0_#78350f]';
  }
  getChipStyle(value: number) { return this.getChipBg(value) + ' border-2 border-white/20'; }

  logSession(res: string, amount: number) {
      this.sessionLogs.unshift({ result: res, amount });
      this.sessionWinnings += amount;
  }
  toggleStats() { this.showStats = !this.showStats; }

  updateBadges() {
      this.badges = [];
      if (this.sessionWinnings > 10000) this.badges.push({ name: 'High Roller', icon: '🐳' });
      if (this.sessionWinnings > 50000) this.badges.push({ name: 'Shark', icon: '🦈' });
      if (this.sessionWinnings > 1000000) this.badges.push({ name: 'Legend', icon: '👑' });
  }

  buyCasino() {
      this.isOwner = true;
      this.sound.playSuccess();
      this.firebase.logPublicEvent("👑 LE CASINO VIENT D'ÊTRE RACHETÉ ! Respect au nouveau Boss ! 👑", 'JACKPOT');
      alert("FÉLICITATIONS ! Vous êtes maintenant le propriétaire du Casino Royal !");
  }
}