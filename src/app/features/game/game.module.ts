import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';

// Composants
import { GameShellComponent } from './game-shell.component';
import { IntroGameComponent } from './intro-game.component';
import { FoodtruckGameComponent } from './mini-games/foodtruck-game.component';
import { FactoryGameComponent } from './mini-games/factory-game.component';
import { ClothingStoreGameComponent } from './mini-games/clothing-store-game.component';
import { FreelanceDevGameComponent } from './mini-games/freelance-dev-game.component';
import { EmployeeManagerComponent } from './components/employee-manager/employee-manager.component';

@NgModule({
  declarations: [
    GameShellComponent,
    IntroGameComponent,
    FoodtruckGameComponent,
    FactoryGameComponent,
    ClothingStoreGameComponent,
    FreelanceDevGameComponent,
    EmployeeManagerComponent
  ],
  imports: [
    CommonModule, // Crucial pour les pipes | number et | async
    DragDropModule,
    FormsModule
  ],
  exports: [
    GameShellComponent
  ]
})
export class GameModule { }

export interface FoodtruckUpgrades {
  grillLevel: number;
  marketingLevel: number;
  serviceLevel: number;
  unlockedIngredients: string[];
  maxServiceReached: number;
  hasKeyboard: boolean; // NOUVEAU : Upgrade Clavier
}

// NOUVEAU : Stats pour le bilan
export interface DailyStats {
  revenue: number;
  expenses: number;
  customersServed: number;
}

export interface GameState {
  // ... (tout le reste pareil)
  dailyStats: DailyStats; // NOUVEAU
}