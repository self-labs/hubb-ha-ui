import './cards/error-card';
import './cards/light-card';
import './screens/home-screen';
import './screens/room-screen';
import './screens/scenes-screen';
import './strategy/hubb-strategy';
import { ensureFont } from './theme/font';
import { VERSION } from './version';

ensureFont();

window.customCards = window.customCards ?? [];
if (!window.customCards.some((c) => c.type === 'hubb-light-card')) {
  window.customCards.push({
    type: 'hubb-light-card',
    name: 'Hubb: luz',
    description: 'Um card de luz da Hubb: toque para ligar e desligar, toque longo para intensidade e cor.',
  });
}

console.info(
  `%c HUBB-HA-UI %c ${VERSION} `,
  'background:#293a44;color:#e3e0d9;font-weight:700',
  'background:#e3e0d9;color:#293a44',
);
