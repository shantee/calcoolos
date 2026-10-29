import '../i18n/page';
import '@fontsource-variable/bricolage-grotesque';
import '../styles/accueil.css';
import '../styles/plateforme.css';
import { topbar } from '../platform/topbar';
import { demarrerSuivi } from '../platform/suivi';

demarrerSuivi(window.location.pathname.endsWith('confidentialite.html') ? 'confidentialite' : 'autre');

void topbar('autre');
