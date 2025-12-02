import { Injectable } from '@angular/core';
import { Auth, signInAnonymously, user, User, GoogleAuthProvider, signInWithPopup, signOut, signInWithCustomToken } from '@angular/fire/auth';
import { Firestore, doc, setDoc, getDoc, collection, query, orderBy, limit, getDocs, addDoc, deleteDoc, runTransaction, where } from '@angular/fire/firestore';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { GameState, Holding } from '../../models/game-models';

declare var __initial_auth_token: string | undefined;

export interface MarketItem {
  id?: string;
  sellerId: string;
  sellerName: string;
  type: string;
  price: number;
  timestamp: number;
  rarity?: 'COMMON' | 'RARE' | 'LEGENDARY'; 
}

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  
  user$: Observable<User | null>;
  currentUserId: string | null = null;
  authInstance: Auth;

  constructor(private auth: Auth, private firestore: Firestore) {
    this.authInstance = auth;
    this.user$ = user(this.auth);
    this.user$.subscribe(u => {
      this.currentUserId = u?.uid || null;
      if (u) console.log('✅ Connecté:', u.uid);
    });
    this.initAuth();
  }

  async initAuth() {
    try {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(this.auth, __initial_auth_token);
      }
    } catch (e) { console.warn('Auth auto failed'); }
  }

  async loginAnonymous() { return await signInAnonymously(this.auth); }
  
  async loginGoogle() {
    try {
      const provider = new GoogleAuthProvider();
      return await signInWithPopup(this.auth, provider);
    } catch (e: any) {
      console.warn('Google Auth Error', e);
      throw e;
    }
  }

  async logout() { return await signOut(this.auth); }

  // --- SAUVEGARDE ---
  async saveProgress(state: GameState) {
    if (!this.currentUserId) return;
    const userRef = doc(this.firestore, 'players', this.currentUserId);
    try {
      await setDoc(userRef, {
        ...state,
        leaderboardStats: {
          money: state.money, // MODIFICATION : On utilise state.money (Solde Actuel) au lieu de totalMoneyEarned
          prestige: state.freelanceUpgrades?.bossBeaten || 0,
          username: state.user?.username || 'Anonyme',
          creationDate: state.user?.creationDate || Date.now(),
          holdingId: state.user?.holdingId || null,
          stats: state.stats || {}
        },
        lastUpdated: Date.now()
      }, { merge: true });
    } catch (e) { console.error(e); }
  }

  async loadProgress(): Promise<GameState | null> {
    if (!this.currentUserId) return null;
    try {
      const snap = await getDoc(doc(this.firestore, 'players', this.currentUserId));
      return snap.exists() ? (snap.data() as GameState) : null;
    } catch (e) { return null; }
  }

  getLeaderboard() {
    const q = query(collection(this.firestore, 'players'), orderBy('leaderboardStats.money', 'desc'), limit(50));
    return from(getDocs(q)).pipe(map(s => s.docs.map(d => ({ id: d.id, ...d.data()['leaderboardStats'] }))));
  }

  // --- HOLDINGS (GUILDES) ---
  getHoldings() {
      const q = query(collection(this.firestore, 'holdings'), orderBy('totalValuation', 'desc'), limit(20));
      return from(getDocs(q)).pipe(map(s => s.docs.map(d => ({ id: d.id, ...d.data() } as Holding))));
  }

  async createHolding(name: string, leaderName: string) {
      if(!this.currentUserId) return;
      const holding: Holding = {
          id: '', name, leaderName, totalValuation: 0, membersCount: 1, icon: '🏢'
      };
      const ref = await addDoc(collection(this.firestore, 'holdings'), holding);
      return ref.id;
  }

  // --- MARCHÉ ---
  getMarketItems() {
    const q = query(collection(this.firestore, 'market'), orderBy('timestamp', 'desc'), limit(50));
    return from(getDocs(q)).pipe(map(s => s.docs.map(d => ({ id: d.id, ...d.data() } as MarketItem))));
  }

  async sellItem(item: MarketItem) {
    await addDoc(collection(this.firestore, 'market'), item);
  }

  async buyItem(item: MarketItem): Promise<string> {
    if (!item.id) return 'ERROR';
    
    // Feature 21: Sniper Protection (10s cooldown)
    if (Date.now() - item.timestamp < 10000) {
        return 'SNIPER_PROTECTION';
    }

    const itemRef = doc(this.firestore, 'market', item.id);
    try {
      await runTransaction(this.firestore, async (transaction) => {
        const sfDoc = await transaction.get(itemRef);
        if (!sfDoc.exists()) throw "SOLD";
        transaction.delete(itemRef);
      });
      return 'SUCCESS';
    } catch (e) {
      return 'SOLD';
    }
  }
}