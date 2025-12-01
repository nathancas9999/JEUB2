import { Injectable } from '@angular/core';
import { GameStateService } from '../../../core/services/game-state.service';
import { SoundService } from '../../../core/services/sound.service';

@Injectable({ providedIn: 'root' })
export class FoodtruckService {
  
  constructor(private gameState: GameStateService, private sound: SoundService) {}

  // --- SONS SPÉCIFIQUES FOODTRUCK ---
  playSteak() { this.sound.playNoise(0.15, 'lowpass', 500, 0.6); } // Pshhh
  playSalad() { this.sound.playNoise(0.05, 'highpass', 2000, 0.3); } // Cric
  playTrash() { this.sound.playNoise(0.2, 'lowpass', 200, 0.5); } // Bam
  playCash() { this.sound.playTone(1200, 'square', 0.1, 0.1); this.sound.playTone(1600, 'square', 0.1, 0.1); }

  // --- ACTIONS ---
  upgradeGrill(cost: number) { this.gameState.buyFoodtruckUpgrade('grill', cost); }
  upgradeMarketing(cost: number) { this.gameState.buyFoodtruckUpgrade('marketing', cost); }
  unlockIngredient(ing: string, cost: number) { this.gameState.unlockIngredient(ing, cost); }
}