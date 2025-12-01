import { Component } from '@angular/core';
import { GameStateService } from '../../../core/services/game-state.service';

@Component({
  selector: 'app-factory-game',
  standalone: false,
  template: `
    <div class="p-8 bg-slate-800 rounded-xl border border-slate-700 text-white flex flex-col items-center shadow-xl">
      <h3 class="text-2xl font-bold mb-8 text-blue-400">🏭 Ligne d'Assemblage</h3>
      
      <div class="relative w-56 h-56 mb-8 cursor-pointer transition-transform active:scale-95" (click)="work()">
        <div class="absolute inset-0 rounded-full border-8 border-slate-700 bg-slate-900"></div>
        <div class="absolute inset-0 rounded-full bg-blue-600 opacity-50 transition-all duration-75"
             [style.clip-path]="'inset(' + (100 - progressPercent) + '% 0 0 0)'"></div>
        
        <div class="absolute inset-0 flex flex-col items-center justify-center z-10 select-none">
          <span class="text-4xl font-black">{{ progressPercent }}%</span>
          <span class="text-xs text-slate-400 uppercase mt-1">Assemblage</span>
        </div>
      </div>

      <button (click)="work()" 
              class="w-full max-w-xs py-4 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-bold text-xl uppercase tracking-wider shadow-lg border-b-4 border-orange-800 active:border-0 active:translate-y-1 transition-all">
        PRODUIRE (+{{ itemValue }}€)
      </button>
    </div>
  `
})
export class FactoryGameComponent {
  progress = 0;
  maxProgress = 15; 
  itemValue = 150; 

  constructor(private gameState: GameStateService) {}

  get progressPercent(): number { 
    return Math.floor((this.progress / this.maxProgress) * 100); 
  }

  work() {
    this.progress++;
    if (this.progress >= this.maxProgress) {
      this.finishItem();
    }
  }

  finishItem() {
    this.gameState.addMoney(this.itemValue);
    this.progress = 0;
  }
}