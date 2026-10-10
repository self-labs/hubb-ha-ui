/** Registers a custom element once, so loading the module twice (tests, a HACS reload) is harmless. */
export function define(name: string, ctor: CustomElementConstructor): void {
  if (!customElements.get(name)) customElements.define(name, ctor);
}
