import { NgModule, LOCALE_ID } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations'; // 👈 IMPORTANT POUR LES ANIMATIONS
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';

// Imports Firebase
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { environment } from '../environments/environment';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { GameModule } from './features/game/game.module';

// Enregistrement de la langue française
registerLocaleData(localeFr);

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule, // 👈 AJOUTÉ ICI
    AppRoutingModule,
    GameModule // Contient le Blackjack et les autres jeux
  ],
  providers: [
    { provide: LOCALE_ID, useValue: 'fr-FR' },
    // Configuration Firebase
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideAuth(() => getAuth()),
    provideFirestore(() => getFirestore())
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }