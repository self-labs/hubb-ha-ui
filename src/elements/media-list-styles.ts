import { css } from 'lit';

/**
 * The look of a list under "Tocar algo": the heading, the rows with a cover or a note, a line that says
 * there is nothing. Shared by the Spotify of Music Assistant and by what a player lists itself.
 */
export const listStyles = css`
  :host {
    display: block;
    font-family: var(--hubb-font);
    color: var(--hubb-text);
  }
  .label,
  .section {
    margin: 16px 2px 8px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--hubb-text-2);
  }
  .section {
    margin-top: 12px;
  }
  .item {
    all: unset;
    box-sizing: border-box;
    width: 100%;
    min-height: 52px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px 2px;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .art {
    flex: none;
    width: 44px;
    height: 44px;
    border-radius: 8px;
    object-fit: cover;
  }
  .note {
    display: grid;
    place-items: center;
    background: var(--hubb-surface-2);
  }
  .note svg {
    width: 20px;
    height: 20px;
    fill: var(--hubb-text-2);
  }
  .words {
    min-width: 0;
    display: grid;
  }
  .name,
  .sub {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .name {
    font-size: 14px;
    font-weight: 700;
  }
  .sub {
    font-size: 12px;
    color: var(--hubb-text-2);
  }
  .none {
    margin: 12px 2px;
    font-size: 13px;
    color: var(--hubb-text-2);
  }
  .item:focus-visible {
    outline: 2px solid var(--hubb-focus);
    outline-offset: 2px;
  }
`;
