import { Component } from '@angular/core';
import { KlarWordmarkComponent } from '../../shared/brand/klar-wordmark.component';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { KlarButtonComponent } from '../../shared/ui/klar-button.component';
import { KlarInputComponent } from '../../shared/ui/klar-input.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [KlarWordmarkComponent, KlarIconComponent, KlarButtonComponent, KlarInputComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {}
