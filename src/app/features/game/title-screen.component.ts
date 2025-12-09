import { Component } from '@angular/core';
import { FirebaseService } from '../../core/services/firebase.service';
import { GameStateService } from '../../core/services/game-state.service';
import { SoundService } from '../../core/services/sound.service';

@Component({
  selector: 'app-title-screen',
  standalone: false,
  template: `
    <div class="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center relative overflow-hidden font-sans select-none">
      
      <div class="absolute inset-0 opacity-20 pointer-events-none">
        <div class="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,_#3b82f6_0%,_transparent_50%)] animate-pulse"></div>
        <div class="grid-bg absolute inset-0"></div>
      </div>

      <div class="z-10 flex flex-col items-center gap-8 animate-fade-in-up" *ngIf="!isChoosingName">
        
        <div class="relative group cursor-default">
           <h1 class="text-8xl md:text-9xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400 drop-shadow-2xl">
             JEUB2
           </h1>
           <div class="absolute -top-4 -right-8 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded rotate-12 shadow-lg">
             ONLINE EDITION
           </div>
           <div class="text-center text-slate-500 font-mono text-sm tracking-[0.5em] mt-2 uppercase">Devenez le CEO ultime</div>
        </div>

        <div class="flex flex-col items-center gap-4 mt-8">
            <button (click)="login()" 
                    class="group relative px-8 py-4 bg-white text-slate-900 font-black text-xl rounded-full shadow-[0_0_40px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_rgba(255,255,255,0.5)] hover:scale-105 transition-all duration-300 flex items-center gap-3">
                <span class="text-2xl">G</span>
                <span>SE CONNECTER AVEC GOOGLE</span>
                <div class="absolute inset-0 rounded-full border-2 border-white opacity-0 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500"></div>
            </button>
            
            <p class="text-red-400 font-bold text-xs mt-4 max-w-xs text-center bg-red-900/20 p-2 rounded border border-red-500/30" *ngIf="errorMessage">
                ❌ {{ errorMessage }}
            </p>
            
            <p class="text-slate-600 text-xs mt-4 max-w-xs text-center" *ngIf="!errorMessage">
               Reprenez votre partie là où vous l'avez laissée.
            </p>
        </div>

      </div>

      <div *ngIf="isChoosingName" class="z-20 bg-slate-900 border border-slate-700 p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-6 animate-fade-in max-w-md w-full mx-4">
          <div class="text-4xl">👋</div>
          <h2 class="text-2xl font-black text-white text-center">Nouveau CEO détecté !</h2>
          <p class="text-slate-400 text-center text-sm">Aucune sauvegarde trouvée. Choisissez votre pseudo :</p>
          
          <input type="text" [(ngModel)]="chosenUsername" placeholder="Votre Pseudo..." 
                 class="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white font-bold text-center focus:border-blue-500 focus:outline-none transition-colors"
                 (keyup.enter)="confirmName()">
          
          <button (click)="confirmName()" [disabled]="!chosenUsername"
                  class="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold rounded-lg transition-all">
              COMMENCER L'AVENTURE 🚀
          </button>
      </div>
      
      <div class="absolute bottom-4 text-slate-700 text-xs font-mono">v1.1.0 • Save Cloud Sync</div>
    </div>
  `,
  styles: [`
    .grid-bg { 
      background-image: linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
      background-size: 50px 50px;
    }
    .animate-fade-in-up { animation: fadeInUp 1s ease-out; }
    .animate-fade-in { animation: fadeIn 0.5s ease-out; }
    @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
  `]
})
export class TitleScreenComponent {
  
  isChoosingName = false;
  chosenUsername = '';
  pendingUser: any = null;
  errorMessage = '';

  constructor(
    private firebase: FirebaseService, 
    private gameState: GameStateService,
    private sound: SoundService
  ) {}

  async login() {
    this.sound.playSoftPop();
    this.errorMessage = '';
    
    try {
      await this.firebase.loginGoogle();
      
      const user = this.firebase.authInstance.currentUser;
      if (user) {
          // On vérifie s'il y a déjà une sauvegarde Cloud
          const hasSave = await this.gameState.checkIfUserHasSave(user);
          
          if (hasSave) {
              // ANCIEN JOUEUR : On charge et on lance
              console.log("💾 Sauvegarde trouvée ! Chargement...");
              await this.gameState.loadCloudDataForUser(user);
              // Le gameStateService va mettre à jour le state, et le GameShell va automatiquement switcher
          } else {
              // NOUVEAU JOUEUR : On demande le pseudo
              console.log("🆕 Nouvelle partie détectée.");
              this.pendingUser = user;
              this.chosenUsername = user.displayName || ''; 
              this.isChoosingName = true;
          }
      }

    } catch (e: any) {
      console.error("Erreur Login", e);
      if (e.code === 'auth/popup-closed-by-user') {
          this.errorMessage = "Connexion annulée.";
      } else {
          this.errorMessage = "Erreur connexion : " + e.message;
      }
      this.sound.playError();
    }
  }

  async confirmName() {
      if (!this.chosenUsername.trim()) return;
      this.sound.playSuccess();
      if (this.pendingUser) {
          await this.gameState.initializeNewUser(this.pendingUser, this.chosenUsername);
      }
      // Une fois initialisé, le GameShell prendra le relais
  }
}