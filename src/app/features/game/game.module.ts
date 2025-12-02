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
import { TitleScreenComponent } from './title-screen.component';

@NgModule({
  declarations: [
    GameShellComponent,
    IntroGameComponent,
    FoodtruckGameComponent,
    FactoryGameComponent,
    ClothingStoreGameComponent,
    FreelanceDevGameComponent,
    EmployeeManagerComponent,
    TitleScreenComponent 
  ],
  imports: [
    CommonModule, 
    DragDropModule,
    FormsModule
  ],
  exports: [
    GameShellComponent
  ]
})
export class GameModule { }