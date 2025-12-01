import { Component, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CdkDragEnd } from '@angular/cdk/drag-drop';
import { GameStateService } from '../../core/services/game-state.service';
import { SoundService } from '../../core/services/sound.service';

interface TrashItem { id: number; x: number; y: number; type: 'leaf' | 'can' | 'paper'; rotation: number; scale: number; delay: number; }
interface Particle { id: number; x: number; y: number; color: string; speedX: number; speedY: number; life: number; }

@Component({
  selector: 'app-intro-game',
  standalone: false,
  template: `
    <div class="intro-container">
      
      <header class="intro-header" *ngIf="phase === 'PARK' || phase === 'SCRATCH'">
        <div class="flex items-center gap-3">
          <div class="logo-box">P</div>
          <h1 class="text-xl font-bold tracking-tight text-white">JEUB2 <span class="text-xs font-normal text-slate-400 ml-2">Prologue</span></h1>
        </div>
        <div class="money-badge">
          <span class="text-green-400 font-bold text-xl mr-2">{{ currentMoney | number:'1.0-0' }} €</span>
        </div>
      </header>

      <div class="fx-layer">
        <div *ngFor="let p of particles" class="particle"
             [style.left.px]="p.x" [style.top.px]="p.y"
             [style.background-color]="p.color"
             [style.opacity]="p.life"
             [style.transform]="'scale(' + p.life + ')'"></div>
      </div>

      <div *ngIf="phase === 'INTRO_DIALOGUE'" class="scene dialogue-scene fadeIn">
          <div class="rain-layer layer-1"></div>
          <div class="rain-layer layer-2"></div>
          
          <div class="character-container slide-up">
            <div class="character-emoji">🥶</div>
          </div>

          <div class="dialogue-box-container">
            <div class="speaker-name">Moi (Galérien)</div>
            <div class="dialogue-text">{{ displayedDialogue }}<span class="cursor">|</span></div>
            <div class="dialogue-actions" *ngIf="isTextFinished">
                <button class="action-btn" (click)="startPark()">
                    Commencer à chercher... 🗑️
                </button>
            </div>
          </div>
      </div>

      <div *ngIf="phase === 'PARK'" class="scene park-scene fadeIn">
        <div class="rain-layer layer-1"></div>
        <div class="rain-layer layer-2"></div>
        
        <div #binRef class="bin-container" [class.bin-active]="isHoveringBin" [class.bin-eating]="isEating">
          <div class="bin-body"><div class="bin-base"><span class="bin-emoji">🗑️</span></div></div>
          <span class="bin-label">Jette ici !</span>
        </div>

        <div class="trash-zone">
          <div *ngFor="let item of trashItems; trackBy: trackByItemId" 
               class="trash-item" [class.floating-anim]="!isDragging"
               cdkDrag (cdkDragStarted)="onDragStart(item)" (cdkDragEnded)="onDragEnded($event, item)"
               [style.left.%]="item.x" [style.top.%]="item.y"
               [style.transform]="'rotate(' + item.rotation + 'deg) scale(' + item.scale + ')'">
            <div class="trash-shadow"></div>
            <div class="trash-content">{{ getIcon(item.type) }}</div>
            <div *cdkDragPlaceholder></div>
          </div>
        </div>

        <div *ngIf="currentMoney >= 100" class="next-step-container">
             <button class="next-btn pulse-glow" (click)="goToShop()">Aller au Tabac ➡️</button>
        </div>
      </div>

      <div *ngIf="phase === 'SHOP'" class="scene shop-scene fadeIn">
        <div class="shop-bg"><div class="neon-sign">LE BALTO</div></div>
        
        <div class="character-container slide-up">
            <div class="character-emoji">🧔🏻‍♂️</div>
        </div>

        <div class="dialogue-box-container">
            <div class="speaker-name">Gérard (Patron)</div>
            <div class="dialogue-text">{{ displayedDialogue }}<span class="cursor">|</span></div>
            <div class="dialogue-actions" *ngIf="isTextFinished">
                <button class="action-btn" (click)="buyTicket()">
                    <span class="icon">🎫</span> Acheter un ticket (100€)
                </button>
            </div>
        </div>
      </div>

      <div *ngIf="phase === 'SCRATCH'" class="scene scratch-scene fadeIn">
        <div class="ticket zoom-in">
          <div class="ticket-top">
             <div class="ticket-logo">💎 DIAMOND CASH 💎</div>
             <div class="ticket-sub">Grattez pour gagner</div>
          </div>
          <div class="scratch-zone-border">
            <div class="scratch-zone">
              <div class="winner-content"><div class="win-amount">10 000 €</div><div class="win-emoji">🎉 JACKPOT 🎉</div></div>
              <div class="scratch-cover">
                <div *ngFor="let i of scratchGrid" class="scratch-pixel" (mouseenter)="scratch(i)" [class.scratched]="scratched[i]">
                     <span class="pattern" *ngIf="!scratched[i]">$</span>
                </div>
              </div>
            </div>
          </div>
          <div class="ticket-footer">
             <button *ngIf="isRevealed" class="claim-btn pulse" (click)="goToOutro()">
                ENCAISSER LE GAIN 💸
             </button>
          </div>
        </div>
      </div>
      
      <div *ngIf="phase === 'OUTRO_DIALOGUE'" class="scene dialogue-scene fadeIn outro-bg">
          
          <div class="character-container slide-up">
            <div class="character-emoji">🤑</div>
          </div>

          <div class="dialogue-box-container light-theme">
            <div class="speaker-name">Moi (Nouveau Riche)</div>
            <div class="dialogue-text text-black">{{ displayedDialogue }}<span class="cursor">|</span></div>
            <div class="dialogue-actions" *ngIf="isTextFinished">
                <button class="action-btn gold-btn" (click)="finishIntro()">
                   🍔 ACHETER LE FOODTRUCK
                </button>
            </div>
          </div>
      </div>

    </div>
  `,
  styles: [`
    /* === GLOBAL === */
    .intro-container { width: 100vw; height: 100vh; overflow: hidden; background: #0f172a; display: flex; flex-direction: column; font-family: 'Segoe UI', sans-serif; user-select: none; position: absolute; top: 0; left: 0; }
    .intro-header { background: rgba(15, 23, 42, 0.9); border-bottom: 1px solid #1e293b; height: 64px; display: flex; justify-content: space-between; align-items: center; padding: 0 24px; z-index: 50; }
    .logo-box { width: 32px; height: 32px; background: #2563eb; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; }
    .money-badge { background: #020617; padding: 8px 20px; border-radius: 99px; border: 1px solid rgba(22, 163, 74, 0.3); }
    .scene { flex: 1; position: relative; width: 100%; height: 100%; overflow: hidden; }

    /* === DIALOGUES === */
    .dialogue-scene { display: flex; flex-direction: column; align-items: center; justify-content: flex-end; background: #0f172a; }
    .character-container { position: relative; z-index: 10; margin-bottom: -10px; }
    .character-emoji { font-size: 12rem; filter: drop-shadow(0 0 30px rgba(0,0,0,0.5)); }
    
    .dialogue-box-container {
        width: 90%; max-width: 800px; margin-bottom: 40px; z-index: 20;
        background: rgba(15, 23, 42, 0.95); border: 2px solid #475569; border-radius: 8px; padding: 24px; 
        box-shadow: 0 20px 50px rgba(0,0,0,0.6); position: relative; min-height: 160px; display: flex; flex-direction: column;
    }
    
    .outro-bg { background: radial-gradient(circle at center, #fef3c7 0%, #fff7ed 100%); }
    .light-theme { background: rgba(255, 255, 255, 0.95); border-color: #fbbf24; box-shadow: 0 20px 50px rgba(217, 119, 6, 0.2); }
    .light-theme .dialogue-text { color: #1e293b; font-weight: bold; }
    
    .speaker-name { position: absolute; top: -16px; left: 24px; background: #d97706; color: white; padding: 4px 16px; font-weight: bold; font-size: 0.9rem; border-radius: 4px; text-transform: uppercase; }
    .dialogue-text { font-family: monospace; font-size: 1.2rem; color: #e2e8f0; line-height: 1.6; margin-top: 10px; flex: 1; }
    .cursor { animation: blink 1s infinite; color: #d97706; font-weight: bold; }
    
    .dialogue-actions { display: flex; justify-content: flex-end; margin-top: 20px; animation: fadeIn 0.5s; }
    .action-btn { background: linear-gradient(to right, #16a34a, #15803d); color: white; border: 1px solid #4ade80; padding: 12px 24px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 1.1rem; display: flex; align-items: center; gap: 10px; }
    .action-btn:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(34, 197, 94, 0.4); }
    .gold-btn { background: linear-gradient(to right, #f59e0b, #d97706); border-color: #fbbf24; color: #78350f; }

    /* === PARK === */
    .park-scene { background: radial-gradient(circle at 50% 20%, #334155 0%, #1e293b 50%, #020617 100%); }
    .rain-layer { position: absolute; inset: 0; pointer-events: none; background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="40"><line x1="0" y1="0" x2="2" y2="10" stroke="rgba(148, 163, 184, 0.3)" stroke-width="1"/></svg>'); z-index: 5; }
    .layer-1 { animation: rain 0.8s linear infinite; opacity: 0.6; background-size: 20px 40px; }
    .layer-2 { animation: rain 1.5s linear infinite; opacity: 0.3; background-size: 40px 80px; transform: scale(1.5); }
    @keyframes rain { from { background-position: 0 0; } to { background-position: 20px 100vh; } }

    .trash-zone { position: absolute; inset: 0; z-index: 30; }
    .trash-item { position: absolute; width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; cursor: grab; touch-action: none; transition: transform 0.1s; }
    .trash-content { font-size: 3.5rem; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.4)); position: relative; z-index: 2; }
    .trash-shadow { position: absolute; bottom: 5px; left: 15%; width: 70%; height: 10px; background: black; opacity: 0.3; filter: blur(4px); border-radius: 50%; z-index: 1; transition: all 0.2s; }
    .trash-item:active .trash-shadow { transform: scale(0.5); opacity: 0.1; bottom: -20px; }
    .floating-anim { animation: float 3s ease-in-out infinite; }
    @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }

    .bin-container { position: absolute; bottom: 40px; right: 40px; width: 140px; height: 160px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; z-index: 25; transition: transform 0.2s; }
    .bin-body { font-size: 6rem; filter: drop-shadow(0 10px 20px rgba(0,0,0,0.5)); }
    .bin-active { transform: scale(1.1); }
    .bin-eating .bin-body { transform: scaleY(0.8) scaleX(1.2); }
    .bin-label { font-weight: bold; color: #cbd5e1; background: rgba(0,0,0,0.6); padding: 4px 12px; border-radius: 12px; }
    .next-step-container { position: absolute; bottom: 100px; width: 100%; display: flex; justify-content: center; z-index: 200; }
    .next-btn { padding: 15px 40px; background: linear-gradient(45deg, #f59e0b, #d97706); color: white; font-weight: 900; font-size: 1.3rem; border: none; border-radius: 50px; cursor: pointer; box-shadow: 0 10px 20px rgba(217, 119, 6, 0.4); text-transform: uppercase; }
    .pulse-glow { animation: pulseGlow 2s infinite; }
    @keyframes pulseGlow { 0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.7); } 70% { box-shadow: 0 0 0 20px rgba(245, 158, 11, 0); } 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); } }

    /* === SHOP & OTHERS === */
    .shop-scene { background: linear-gradient(to bottom, #2a0a0a, #1a0505); display: flex; flex-direction: column; align-items: center; justify-content: flex-end; }
    .shop-bg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
    .neon-sign { position: absolute; top: 15%; left: 50%; transform: translateX(-50%); font-family: monospace; font-weight: 900; font-size: 4rem; color: #ff4d4d; text-shadow: 0 0 20px #ff0000; border: 4px solid #ff4d4d; padding: 10px 30px; border-radius: 20px; box-shadow: 0 0 30px rgba(255, 0, 0, 0.4); animation: flicker 3s infinite; }
    @keyframes flicker { 0%, 100% { opacity: 1; } 50% { opacity: 0.8; } 52% { opacity: 0.2; } 54% { opacity: 0.8; } }

    .scratch-scene { background: #0f172a; display: flex; justify-content: center; align-items: center; }
    .ticket { width: 360px; background: #f8fafc; border-radius: 12px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); border: 1px solid #94a3b8; }
    .ticket-top { background: #1e1b4b; padding: 20px; text-align: center; border-bottom: 4px solid #fbbf24; }
    .ticket-logo { font-family: 'Impact', sans-serif; font-size: 2rem; color: #fbbf24; letter-spacing: 1px; }
    .ticket-sub { color: #94a3b8; font-size: 0.8rem; text-transform: uppercase; margin-top: 5px; }
    .scratch-zone-border { padding: 20px; background: #e2e8f0; }
    .scratch-zone { position: relative; width: 100%; height: 200px; border: 2px dashed #94a3b8; background: white; border-radius: 8px; overflow: hidden; }
    .winner-content { width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; background: radial-gradient(circle, #fef3c7 0%, #fffbeb 100%); }
    .win-amount { font-size: 3.5rem; font-weight: 900; color: #16a34a; }
    .win-emoji { font-size: 1.5rem; margin-top: 10px; animation: pulse 1s infinite; }
    .scratch-cover { position: absolute; inset: 0; display: grid; grid-template-columns: repeat(10, 1fr); grid-template-rows: repeat(6, 1fr); }
    .scratch-pixel { background: #94a3b8; border: 1px solid #64748b; display: flex; justify-content: center; align-items: center; cursor: crosshair; }
    .scratch-pixel:nth-child(odd) { background: #cbd5e1; }
    .scratch-pixel.scratched { opacity: 0; pointer-events: none; }
    .ticket-footer { padding: 15px; text-align: center; background: #f1f5f9; }
    .claim-btn { width: 100%; background: #16a34a; color: white; font-weight: bold; padding: 12px; border: none; border-radius: 6px; font-size: 1.2rem; cursor: pointer; }

    .slide-up { animation: slideUp 0.8s ease-out; } @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
    .fadeIn { animation: fadeIn 1s; } @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
    .particle { position: absolute; width: 8px; height: 8px; border-radius: 50%; pointer-events: none; z-index: 200; }
  `]
})
export class IntroGameComponent implements OnInit, OnDestroy {
  @ViewChild('binRef') binRef!: ElementRef;

  phase: string = 'INTRO_DIALOGUE';
  currentMoney = 0;
  particles: Particle[] = [];

  // ETAT PARC
  trashItems: TrashItem[] = [];
  isHoveringBin = false;
  isEating = false;
  isDragging = false;

  // ETAT DIALOGUE
  currentDialogueText = "";
  displayedDialogue = "";
  isTextFinished = false;
  private typeWriterInterval: any;

  // TEXTES (MISE A JOUR)
  introText = "Il pleut encore... J'en ai marre de cette vie de galère. J'ai froid, j'ai faim. Si seulement je pouvais trouver 100 balles pour tenter ma chance au loto...";
  shopText = "Alors mon petit... Une sale journée hein ? T'es tout trempé. T'as enfin réuni les 100 balles ? Allez, prends ce ticket, c'est ta chance.";
  outroText = "C'est... C'est pas possible... 10.000 EUROS ?! J'AI GAGNÉ ! Adieu la rue ! Je sais ce que je vais faire... Je vais racheter ce vieux Foodtruck abandonné au coin de la rue. C'est le début de mon empire !";

  // ETAT SCRATCH
  scratchGrid = Array.from({length: 60}, (_, i) => i); 
  scratched: boolean[] = new Array(60).fill(false);
  isRevealed = false;

  constructor(private gameState: GameStateService, private sound: SoundService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.sound.startRainAmbience();
    this.startDialogue(this.introText);
  }
  
  ngOnDestroy() { 
    this.sound.stopRainAmbience();
    if (this.typeWriterInterval) clearInterval(this.typeWriterInterval);
  }

  startDialogue(text: string) {
    this.currentDialogueText = text;
    this.displayedDialogue = "";
    this.isTextFinished = false;
    let i = 0;
    if (this.typeWriterInterval) clearInterval(this.typeWriterInterval);
    this.typeWriterInterval = setInterval(() => {
      if (i < this.currentDialogueText.length) {
        this.displayedDialogue += this.currentDialogueText.charAt(i);
        if (i % 3 === 0) this.sound.playKeystroke();
        i++;
        this.cdr.detectChanges();
      } else {
        clearInterval(this.typeWriterInterval);
        this.isTextFinished = true;
        this.cdr.detectChanges();
      }
    }, 30);
  }

  startPark() {
    this.phase = 'PARK';
    this.spawnTrashWave();
  }

  goToShop() {
    this.phase = 'SHOP';
    this.sound.stopRainAmbience(); 
    setTimeout(() => this.startDialogue(this.shopText), 800);
  }

  buyTicket() {
    this.currentMoney = 0;
    this.phase = 'SCRATCH';
    this.sound.playPop();
  }

  goToOutro() {
    this.phase = 'OUTRO_DIALOGUE';
    this.sound.playSuccess(); 
    setTimeout(() => this.startDialogue(this.outroText), 800);
  }

  finishIntro() {
    this.gameState.completeIntro();
  }

  trackByItemId(i: number, item: TrashItem) { return item.id; }
  spawnTrashWave() {
    this.trashItems = [];
    for (let i = 0; i < 40; i++) {
      this.trashItems.push({ 
        id: Math.random(), x: Math.random()*80+10, y: Math.random()*70+10, 
        type: Math.random()>0.6?'can':(Math.random()>0.3?'paper':'leaf'), 
        rotation: Math.random()*360, scale: 1, delay: Math.random()*2 
      });
    }
  }
  onDragStart(item: TrashItem) { 
    this.isDragging = true;
    if(item.type === 'can') this.sound.playCanSound();
    else if(item.type === 'paper') this.sound.playPaperSound();
    else this.sound.playLeafSound();
  }
  onDragEnded(event: CdkDragEnd, item: TrashItem) {
    this.isDragging = false; this.isHoveringBin = false;
    const d = event.dropPoint; const r = this.binRef.nativeElement.getBoundingClientRect();
    if (d.x >= r.left-50 && d.x <= r.right+50 && d.y >= r.top-50 && d.y <= r.bottom+50) this.cleanTrash(item); else event.source.reset();
  }
  cleanTrash(item: TrashItem) {
    this.trashItems = this.trashItems.filter(t => t.id !== item.id);
    this.sound.playTrashInBin();
    this.isEating = true; setTimeout(() => this.isEating = false, 200);
    const r = this.binRef.nativeElement.getBoundingClientRect();
    this.spawnParticles(r.left+r.width/2, r.top+r.height/2, '#22c55e');
    this.currentMoney += 10; 
    if (this.trashItems.length === 0 && this.currentMoney < 100) setTimeout(() => this.spawnTrashWave(), 500);
  }
  getIcon(t: string) { return t==='can'?'🥫':(t==='paper'?'🥡':'🍂'); }

  scratch(index: number) {
    if (!this.scratched[index]) {
      this.scratched[index] = true;
      if (Math.random() > 0.5) this.sound.playScratchSound();
      if (this.scratched.filter(x => x).length > 36 && !this.isRevealed) { 
          this.isRevealed = true; this.sound.playSuccess(); this.spawnConfetti(); 
      }
    }
  }

  spawnParticles(x: number, y: number, c: string) { for(let i=0; i<8; i++) this.particles.push({ id: Math.random(), x, y, color: c, speedX: (Math.random()-0.5)*15, speedY: (Math.random()-1)*15, life: 1 }); this.animateParticles(); }
  spawnConfetti() { for(let i=0; i<50; i++) this.particles.push({ id: Math.random(), x: window.innerWidth/2, y: window.innerHeight/2, color: ['#f00', '#0f0', '#00f', '#ff0'][Math.floor(Math.random()*4)], speedX: (Math.random()-0.5)*25, speedY: (Math.random()-0.5)*25, life: 1 }); this.animateParticles(); }
  animateParticles() { if(this.particles.length===0)return; this.particles.forEach(p => { p.x+=p.speedX; p.y+=p.speedY; p.life-=0.03; }); this.particles=this.particles.filter(p=>p.life>0); if(this.particles.length>0) requestAnimationFrame(()=>this.animateParticles()); }
}