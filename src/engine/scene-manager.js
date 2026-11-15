// Holds the registered scenes and switches between them.
// A scene is an object with optional hooks:
//   enter(params, ui)  -> may be async; `ui` is a fresh DOM layer for this scene
//   exit()
//   update(dt)
//   render(ctx, display, alpha)

export class SceneManager {
  constructor(game, uiRoot) {
    this.game = game;
    this.uiRoot = uiRoot;
    this.factories = new Map();
    this.current = null;
    this.currentName = '';
    this.switching = false;
  }

  register(name, factory) {
    this.factories.set(name, factory);
  }

  async go(name, params = {}) {
    const factory = this.factories.get(name);
    if (!factory) throw new Error(`Unknown scene: ${name}`);
    // A tap while a screen is still loading is not lost: it runs right after.
    if (this.switching) { this.pending = [name, params]; return; }
    this.switching = true;
    try {
      if (this.current && this.current.exit) await this.current.exit();
      this.uiRoot.replaceChildren();
      const ui = document.createElement('div');
      ui.className = `scene scene--${name}`;
      ui.style.cssText = 'position:absolute;inset:0;pointer-events:none';
      this.uiRoot.appendChild(ui);
      const scene = factory(this.game);
      this.current = scene;
      this.currentName = name;
      if (scene.enter) await scene.enter(params, ui);
    } finally {
      this.switching = false;
      if (this.pending) {
        const [n, p] = this.pending;
        this.pending = null;
        this.go(n, p);
      }
    }
  }

  update(dt) {
    if (this.current && this.current.update) this.current.update(dt);
  }

  render(ctx, display, alpha) {
    if (this.current && this.current.render) this.current.render(ctx, display, alpha);
  }
}
