import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  standalone: false
  // J'ai supprimé la ligne styleUrl car le fichier n'existait pas
})
export class AppComponent {
  title = 'JEUB2';
}