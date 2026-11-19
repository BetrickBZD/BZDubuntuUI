import {EventEmitter} from 'resource:///org/gnome/shell/misc/signals.js';

/**
 * Popup boxes of any module that should get the liquid glass look, so
 * modules don't need to know about the appearance module. Actors leave the
 * registry by themselves when destroyed. Emits 'added' and 'removed'.
 */
class GlassTargets extends EventEmitter {
    constructor() {
        super();
        this._actors = new Set();
    }

    get actors() {
        return [...this._actors];
    }

    add(actor) {
        if (this._actors.has(actor))
            return;
        this._actors.add(actor);
        actor.connectObject('destroy', () => this.remove(actor), this);
        this.emit('added', actor);
    }

    remove(actor) {
        if (!this._actors.delete(actor))
            return;
        actor.disconnectObject(this);
        this.emit('removed', actor);
    }
}

export const glassTargets = new GlassTargets();
