import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

// eslint-disable-next-line no-console -- Angular Logger unavailable at bootstrap time
bootstrapApplication(AppComponent, appConfig).catch(console.error);
