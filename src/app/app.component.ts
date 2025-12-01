import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  // On pointe bien vers le fichier .component.html qui contient <app-game-shell>
  templateUrl: './app.component.html',
  standalone: false,
  styleUrl: './app.css'
})
// On renomme la classe pour qu'Angular la reconnaisse
export class AppComponent {
  title = 'JEUB2';
}