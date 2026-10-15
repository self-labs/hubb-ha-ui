import { LitElement, nothing } from 'lit';
import { basePath, navigate } from '../actions/navigate';
import { define } from '../elements/define';

/**
 * Stands where a room the resident does not see would be. Home Assistant keeps the index of the open
 * view when the dashboard rebuilds, so every area keeps a view for everyone; landing here (the room
 * open on the phone was just hidden) sends the resident home.
 */
export class HubbRedirectCard extends LitElement {
  setConfig(_config: unknown): void {
    // Nothing to read: the card only leaves.
  }

  connectedCallback(): void {
    super.connectedCallback();
    navigate(`${basePath()}/home`, { replace: true });
  }

  render() {
    return nothing;
  }
}

define('hubb-redirect-card', HubbRedirectCard);
