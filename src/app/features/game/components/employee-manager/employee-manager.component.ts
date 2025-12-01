import { Component, Input } from '@angular/core';
import { GameStateService } from '../../../../core/services/game-state.service';
import { Company, EmployeeRole, EmployeeConfig } from '../../../../models/game-models';

@Component({
  selector: 'app-employee-manager',
  standalone: false,
  template: `
    <div class="manager-card">
      <div class="manager-header">
        <h4>👥 Staff & Salaires</h4>
        <p class="subtitle">Effectifs de {{ company.name }}</p>
      </div>

      <div class="roles-list">
        <div *ngFor="let role of availableRoles" class="role-card">
          
          <div class="role-info">
            <div class="role-title">{{ getStats(role).name }}</div>
            <div class="role-details">
              <span class="count" [class.maxed]="getCount(role) >= 20">
                {{ getCount(role) }} / 20
              </span>
              <span class="salary-info">
                Masse Salariale: <span class="text-red-400">-{{ getTotalDailyCost(role) | number:'1.0-0' }}€ /j</span>
              </span>
            </div>
            <div class="bonus-info">
              {{ getStats(role).description }}
            </div>
          </div>

          <button (click)="hire(role)"
                  [disabled]="getCount(role) >= 20"
                  class="hire-btn">
            <div class="btn-label">RECRUTER</div>
            <div class="btn-cost">{{ getNextCost(role) | number:'1.0-0' }} €</div>
            <div class="btn-sub">Salaire: -{{ getNextSalary(role) }}€/j</div>
          </button>

        </div>
      </div>
      
      <div class="manager-footer">
        <div class="total-daily">
          TOTAL SALAIRES: <span class="text-red-500 font-bold">-{{ getCompanyTotalDailyCost() | number:'1.0-0' }} € / Jour</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .manager-card { background: #1e293b; border-radius: 12px; border: 1px solid #334155; overflow: hidden; display: flex; flex-direction: column; height: 100%; }
    .manager-header { padding: 15px; background: #0f172a; border-bottom: 1px solid #334155; }
    h4 { margin: 0; color: white; font-size: 1.2rem; }
    .subtitle { margin: 0; color: #64748b; font-size: 0.8rem; }
    
    .roles-list { padding: 15px; flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; }
    .role-card { background: #334155; padding: 10px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #475569; }
    
    .role-title { color: #60a5fa; font-weight: bold; font-size: 1rem; }
    .role-details { font-size: 0.8rem; color: #94a3b8; margin-top: 2px; }
    .count { color: white; font-weight: bold; margin-right: 10px; }
    .count.maxed { color: #ef4444; }
    .bonus-info { font-size: 0.75rem; color: #cbd5e1; margin-top: 4px; font-style: italic; }

    .hire-btn { 
      background: #16a34a; border: none; padding: 8px 12px; border-radius: 6px; color: white; cursor: pointer; 
      display: flex; flex-direction: column; align-items: flex-end; min-width: 90px; transition: all 0.2s;
    }
    .hire-btn:hover { background: #15803d; transform: translateY(-1px); }
    .hire-btn:active { transform: translateY(1px); }
    .hire-btn:disabled { background: #475569; cursor: not-allowed; opacity: 0.7; transform: none; }
    
    .btn-label { font-size: 0.7rem; font-weight: bold; opacity: 0.8; }
    .btn-cost { font-size: 0.9rem; font-weight: bold; }
    .btn-sub { font-size: 0.65rem; color: #bbf7d0; }

    .manager-footer { padding: 15px; background: #0f172a; border-top: 1px solid #334155; text-align: center; font-size: 0.9rem; color: #94a3b8; }
  `]
})
export class EmployeeManagerComponent {
  @Input() company!: Company;
  @Input() availableRoles: EmployeeRole[] = [];

  constructor(private gameState: GameStateService) {}

  getStats(role: EmployeeRole): EmployeeConfig {
    return this.gameState.getEmployeeConfig(role);
  }

  getCount(role: EmployeeRole): number {
    if (!this.company || !this.company.employees) return 0;
    return this.company.employees.filter(e => e.role === role).length;
  }

  getNextCost(role: EmployeeRole): number {
    return this.gameState.getNextHireCost(this.company.id, role);
  }

  // CORRECTION : Cette méthode calcule le salaire futur
  getNextSalary(role: EmployeeRole): number {
    const config = this.getStats(role);
    // Salaire fixe pour l'instant (comme défini dans le service)
    // Si tu veux une augmentation exponentielle du salaire aussi :
    // const count = this.getCount(role);
    // return Math.floor(config.baseDailySalary * Math.pow(config.salaryFactor, count));
    return config.baseDailySalary;
  }

  getTotalDailyCost(role: EmployeeRole): number {
    if (!this.company || !this.company.employees) return 0;
    return this.company.employees
      .filter(e => e.role === role)
      .reduce((sum, e) => sum + e.dailySalary, 0);
  }

  getCompanyTotalDailyCost(): number {
    if (!this.company || !this.company.employees) return 0;
    return this.company.employees.reduce((sum, e) => sum + e.dailySalary, 0);
  }

  hire(role: EmployeeRole) {
    this.gameState.hireEmployee(this.company.id, role);
  }
}