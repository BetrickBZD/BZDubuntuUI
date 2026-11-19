import GdkPixbuf from 'gi://GdkPixbuf';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup?version=3.0';

import * as Mpris from 'resource:///org/gnome/shell/ui/mpris.js';
import {EventEmitter} from 'resource:///org/gnome/shell/misc/signals.js';

import {averageColor} from '../lib/color.js';

import {PlaybackState} from './playbackState.js';

Gio._promisify(Soup.Session.prototype, 'send_and_read_async');

const CACHE_MAX_AGE = 30 * 24 * 60 * 60; // seconds
// Steps of the dock's progress ring along a cover's edge: about its length
// in px for covers up to 64 px, so it moves by at most a pixel per update
const RING_STEPS = 240;

function sha1(text) {
    return GLib.compute_checksum_for_string(GLib.ChecksumType.SHA1, text, -1);
}

/**
 * Tracks MPRIS players, picks the one to show and caches cover art locally,
 * with a blurred version and its average color for the popup's background.
 * Emits 'changed' whenever the player, its track or the cover changes.
 *
 * `state` is the PlaybackState (position, shuffle, repeat) of the shown
 * player, shared by the popup and the dock's progress ring. It only runs
 * while someone needs it: while a popup holds it (holdState() until
 * releaseState()) or the ring is on ('dock-progress-ring'); for the
 * ring alone only as often as it visibly moves.
 */
export class MediaController extends EventEmitter {
    constructor(settings) {
        super();
        this._settings = settings;
        this.state = new PlaybackState();
        this._holds = 0;
        this._statePlayer = null;
        settings.connectObject('changed::dock-progress-ring', () => this._syncState(), this);

        this._session = new Soup.Session({timeout: 10, user_agent: 'GNOME-Shell-DockMedia/1.0'});
        this._cancellable = new Gio.Cancellable();
        this._cacheDir = GLib.build_filenamev([GLib.get_user_cache_dir(), 'dock-media']);
        GLib.mkdir_with_parents(this._cacheDir, 0o755);
        this._pruneCache();

        this.player = null;
        this.coverPath = null;
        this.blurPath = null;
        this.coverColor = null; // {red, green, blue}, 0-255
        this._coverUrl = null;
        this._pinned = null;
        this._players = new Set();

        this._source = new Mpris.MprisSource();
        this._source.connectObject(
            'player-added', (_s, player) => this._addPlayer(player),
            'player-removed', (_s, player) => this._removePlayer(player),
            this);
    }

    get players() {
        return [...this._players];
    }

    holdState() {
        this._holds++;
        this._syncState();
    }

    releaseState() {
        this._holds = Math.max(0, this._holds - 1);
        this._syncState();
    }

    // Started anew only for another player: the state follows its own
    // player's changes by itself
    _syncState() {
        const wanted = this._holds > 0 || this._settings.get_boolean('dock-progress-ring');
        // A popup shows the time to the second, the ring alone needs less
        this.state.setResolution(this._holds > 0 ? 0 : RING_STEPS);
        const player = wanted ? this.player : null;
        if (player === this._statePlayer)
            return;
        this._statePlayer = player;
        if (player)
            this.state.start(player);
        else
            this.state.stop();
    }

    selectPlayer(player) {
        this._pinned = player;
        this._update();
    }

    _addPlayer(player) {
        this._players.add(player);
        player.connectObject('changed', () => this._update(), this);
        this._update();
    }

    _removePlayer(player) {
        this._players.delete(player);
        player.disconnectObject(this);
        if (this.player === player)
            this.player = null;
        if (this._pinned === player)
            this._pinned = null;
        this._update();
    }

    // Manual choice > playing > previous one > Spotify > any
    _pickPlayer() {
        const players = this.players;
        return this._pinned ??
            players.find(p => p.status === 'Playing') ??
            (players.includes(this.player) ? this.player : null) ??
            players.find(p => p.app?.get_id()?.toLowerCase().includes('spotify')) ??
            players[0] ?? null;
    }

    _update() {
        this.player = this._pickPlayer();
        this._updateCover();
        this._syncState();
        this.emit('changed');
    }

    async _updateCover() {
        const url = this.player?.trackCoverUrl || null;
        if (url === this._coverUrl)
            return;
        this._coverUrl = url;
        this.coverPath = null;
        this.blurPath = null;
        this.coverColor = null;

        if (!url)
            return;

        try {
            const path = await this._resolveCover(url);
            if (url !== this._coverUrl)
                return;
            this.coverPath = path;
            this._processCover(path);
            this.emit('changed');
        } catch (e) {
            if (!e.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                console.warn(`Dock Media: could not load cover ${url}: ${e.message}`);
        }
    }

    async _resolveCover(url) {
        if (url.startsWith('file://'))
            return Gio.File.new_for_uri(url).get_path();
        if (url.startsWith('/'))
            return url;

        const path = GLib.build_filenamev([this._cacheDir, sha1(url)]);
        if (GLib.file_test(path, GLib.FileTest.EXISTS))
            return path;

        const message = Soup.Message.new('GET', url);
        const bytes = await this._session.send_and_read_async(
            message, GLib.PRIORITY_DEFAULT, this._cancellable);
        if (message.get_status() !== Soup.Status.OK)
            throw new Error(`HTTP ${message.get_status()}`);

        GLib.file_set_contents(path, bytes.get_data());
        return path;
    }

    // The cover shrunk to a few pixels gives both, once per track: a cheap
    // blur (bilinear scaling smears the pixels back up; unlike a Clutter
    // effect this keeps rounded corners) and the average color
    _processCover(path) {
        let pixbuf;
        try {
            pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(path, 10, 10, false);
        } catch (e) {
            console.warn(`Dock Media: could not read cover ${path}: ${e.message}`);
            return;
        }
        this.coverColor = averageColor(pixbuf);

        const blurPath = GLib.build_filenamev([this._cacheDir, `${sha1(path)}-blur.png`]);
        try {
            if (!GLib.file_test(blurPath, GLib.FileTest.EXISTS)) {
                pixbuf.scale_simple(120, 120, GdkPixbuf.InterpType.BILINEAR)
                    .savev(blurPath, 'png', [], []);
            }
            this.blurPath = blurPath;
        } catch (e) {
            console.warn(`Dock Media: could not blur cover ${path}: ${e.message}`);
        }
    }

    // Covers of tracks not played for a while are just re-downloaded if needed
    _pruneCache() {
        const dir = Gio.File.new_for_path(this._cacheDir);
        const now = GLib.get_real_time() / GLib.USEC_PER_SEC;
        try {
            const files = dir.enumerate_children('standard::name,time::modified',
                Gio.FileQueryInfoFlags.NONE, null);
            for (const info of files) {
                if (now - info.get_modification_date_time().to_unix() > CACHE_MAX_AGE)
                    dir.get_child(info.get_name()).delete(null);
            }
        } catch (e) {
            console.warn(`Dock Media: could not prune cover cache: ${e.message}`);
        }
    }

    destroy() {
        this._settings.disconnectObject(this);
        this.state.destroy();
        this._statePlayer = null;
        this._cancellable.cancel();
        this._source.disconnectObject(this);
        for (const player of this._players)
            player.disconnectObject(this);
        this._players.clear();
        this._source = null;
        this.player = null;
        this._pinned = null;
    }
}
