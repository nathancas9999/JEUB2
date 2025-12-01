import { Injectable } from '@angular/core';
import { GameStateService } from '../../../core/services/game-state.service';
import { SoundService } from '../../../core/services/sound.service';
import { SetupItem } from '../../../models/game-models';

@Injectable({ providedIn: 'root' })
export class FreelanceService {
  
  constructor(private gameState: GameStateService, private sound: SoundService) {}

  // --- SONS SPÉCIFIQUES FREELANCE ---
  playKeystroke() { 
      // Son "Clack" aléatoire
      this.sound.playTone(300 + Math.random()*100, 'triangle', 0.08, 0.1, (Math.random()*40)-20, 1000);
      // Petit bruit de contact
      this.sound.playNoise(0.02, 'lowpass', 2000, 0.05);
  }
  
  playSpace() {
      // Son "Thock" grave
      this.sound.playTone(120, 'square', 0.15, 0.2, (Math.random()*20)-10, 400);
      this.sound.playNoise(0.1, 'bandpass', 300, 0.1);
  }

  playSuccess() { this.sound.playTone(523, 'sine', 0.2, 0.1); setTimeout(() => this.sound.playTone(1046, 'sine', 0.3, 0.1), 100); }
  playError() { this.sound.playTone(150, 'sawtooth', 0.3, 0.1); }

  // --- ACTIONS SPÉCIFIQUES FREELANCE ---
  buySetup(item: SetupItem, cost: number) { this.gameState.buySetupUpgrade(item, cost); }
  
  // Les employés travaillent et rapportent de l'argent
  // Appelée par le composant freelance toutes les X secondes
  processPassiveWork(juniorCount: number, seniorCount: number) {
      let gain = 0;
      if (juniorCount > 0) gain += (juniorCount * 5); // Juniors rapportent un peu
      if (seniorCount > 0) gain += (seniorCount * 25); // Seniors rapportent beaucoup
      
      if (gain > 0) this.gameState.addMoney(gain);
      return gain;
  }
}