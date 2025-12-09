import { Injectable } from '@angular/core';
import { Auth, user, User, GoogleAuthProvider, signInWithPopup, signOut } from '@angular/fire/auth';
import { Firestore, doc, setDoc, getDoc, collection, query, orderBy, limit, getDocs, addDoc, runTransaction, onSnapshot, where, deleteDoc } from '@angular/fire/firestore';
import { Observable, from, Subject, BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';
import { GameState, Holding } from '../../models/game-models';

export interface MarketItem {
  id?: string; sellerId: string; sellerName: string; type: string; price: number; timestamp: number; rarity?: 'COMMON' | 'RARE' | 'LEGENDARY'; 
}

export interface PublicEvent { text: string; timestamp: number; type: 'WIN' | 'INFO' | 'JACKPOT'; }

export interface GameInvite {
    id?: string;
    fromId: string;
    fromName: string;
    toId: string;
    gameType: 'BLACKJACK';
    amount: number;
    timestamp: number;
}

@Injectable({ providedIn: 'root' })
export class FirebaseService {
  
  user$: Observable<User | null>;
  currentUserId: string | null = null;
  authInstance: Auth;
  
  publicEvents$ = new BehaviorSubject<string[]>(["Bienvenue sur JEUB2 Online • En attente de gagnants..."]);
  invites$ = new BehaviorSubject<GameInvite[]>([]);

  constructor(private auth: Auth, private firestore: Firestore) {
    this.authInstance = auth;
    this.user$ = user(this.auth);
    this.user$.subscribe(u => {
      this.currentUserId = u?.uid || null;
      if (u) {
          console.log('✅ Connecté:', u.uid);
          this.listenToInvites(u.uid);
      }
    });
    this.listenToPublicEvents();
  }

  // --- GESTION DES INVITATIONS (NOTIFICATIONS) ---
  private listenToInvites(userId: string) {
      // Écoute les invitations adressées à l'utilisateur courant
      const q = query(collection(this.firestore, 'invites'), where('toId', '==', userId));
      onSnapshot(q, (snapshot) => {
          const invites = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as GameInvite));
          this.invites$.next(invites);
      });
  }

  async sendInvite(targetId: string, targetName: string, gameType: 'BLACKJACK', amount: number, myUsername: string) {
      if (!this.currentUserId) return;
      await addDoc(collection(this.firestore, 'invites'), {
          fromId: this.currentUserId,
          fromName: myUsername,
          toId: targetId,
          gameType,
          amount,
          timestamp: Date.now()
      });
  }

  async acceptInvite(invite: GameInvite) {
      if (invite.id) await deleteDoc(doc(this.firestore, 'invites', invite.id));
      // Ici on pourrait initialiser une vraie session multijoueur
      return true;
  }

  async declineInvite(invite: GameInvite) {
      if (invite.id) await deleteDoc(doc(this.firestore, 'invites', invite.id));
  }

  // --- JOUEURS EN LIGNE ---
  async getOnlinePlayers(): Promise<any[]> {
      try {
          const q = query(collection(this.firestore, 'players'), orderBy('lastUpdated', 'desc'), limit(20));
          const snap = await getDocs(q);
          
          return snap.docs
              .map(d => ({ id: d.id, ...d.data() })) // On récupère l'ID Firebase
              .filter((p: any) => p.username !== 'Anonyme' && p.username && p.id !== this.currentUserId)
              .map((p: any) => ({
                  id: p.id,
                  username: p.username,
                  title: p.user?.title || 'Joueur',
                  money: p.money,
                  avatarId: p.user?.avatarId || '👤'
              }));
      } catch (e) { return []; }
  }

  // --- TICKER ---
  private listenToPublicEvents() {
      const q = query(collection(this.firestore, 'public_events'), orderBy('timestamp', 'desc'), limit(10));
      onSnapshot(q, (snapshot) => {
          const events = snapshot.docs.map(d => d.data() as PublicEvent).map(e => e.text);
          if (events.length > 0) this.publicEvents$.next(events);
      });
  }

  async logPublicEvent(text: string, type: 'WIN' | 'INFO' | 'JACKPOT' = 'INFO') {
      try { await addDoc(collection(this.firestore, 'public_events'), { text, type, timestamp: Date.now() }); } catch (e) { }
  }

  // --- AUTH & SAVE ---
  async loginGoogle() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    return await signInWithPopup(this.auth, provider);
  }

  async logout() { return await signOut(this.auth); }

  async saveProgress(state: GameState) {
    if (!this.currentUserId) return;
    const userRef = doc(this.firestore, 'players', this.currentUserId);
    try {
      await setDoc(userRef, {
        username: state.user?.username || 'Anonyme',
        money: state.money,
        // ... (Le reste des champs pour la sauvegarde)
        user: state.user,
        companies: state.companies,
        employees: state.employees || [],
        foodtruckUpgrades: state.foodtruckUpgrades,
        freelanceUpgrades: state.freelanceUpgrades,
        foodtruckMastery: state.foodtruckMastery,
        dailyStats: state.dailyStats,
        achievements: state.achievements,
        gems: state.gems || 0,
        day: state.day,
        timeOfDay: state.timeOfDay,
        hasCompletedIntro: state.hasCompletedIntro,
        leaderboardStats: {
          money: state.money,
          username: state.user?.username || 'Anonyme',
          creationDate: state.user?.creationDate || Date.now(),
          stats: state.stats || {}
        },
        lastUpdated: Date.now() // Important pour le statut "En ligne"
      }, { merge: true });
    } catch (e) { }
  }

  async loadProgress(): Promise<GameState | null> {
    if (!this.currentUserId) return null;
    try {
      const snap = await getDoc(doc(this.firestore, 'players', this.currentUserId));
      if (snap.exists()) return snap.data() as GameState;
      return null;
    } catch (e) { return null; }
  }

  getLeaderboard() {
    const q = query(collection(this.firestore, 'players'), orderBy('leaderboardStats.money', 'desc'), limit(50));
    return from(getDocs(q)).pipe(map(s => s.docs.map(d => ({ id: d.id, ...d.data()['leaderboardStats'] }))));
  }

  getHoldings() {
      const q = query(collection(this.firestore, 'holdings'), orderBy('totalValuation', 'desc'), limit(20));
      return from(getDocs(q)).pipe(map(s => s.docs.map(d => ({ id: d.id, ...d.data() } as Holding))));
  }

  async createHolding(name: string, leaderName: string) {
      if(!this.currentUserId) return;
      const holding: Holding = { id: '', name, leaderName, totalValuation: 0, membersCount: 1, icon: '🏢' };
      const ref = await addDoc(collection(this.firestore, 'holdings'), holding);
      return ref.id;
  }

  getMarketItems() {
    const q = query(collection(this.firestore, 'market'), orderBy('timestamp', 'desc'), limit(50));
    return from(getDocs(q)).pipe(map(s => s.docs.map(d => ({ id: d.id, ...d.data() } as MarketItem))));
  }

  async sellItem(item: MarketItem) { await addDoc(collection(this.firestore, 'market'), item); }

  async buyItem(item: MarketItem): Promise<string> {
    if (!item.id) return 'ERROR';
    const itemRef = doc(this.firestore, 'market', item.id);
    try {
      await runTransaction(this.firestore, async (transaction) => {
        const sfDoc = await transaction.get(itemRef);
        if (!sfDoc.exists()) throw "SOLD";
        transaction.delete(itemRef);
      });
      return 'SUCCESS';
    } catch (e) { return 'SOLD'; }
  }
}