import { world, Player} from '@minecraft/server'

export class WorldDatabase {
    /**
     * 
     * @param {string} identifier 
     */
    constructor(identifier) {
        this.id = identifier;
    }
    /**
     * 
     * @param {string | boolean | number} value 
     */
    set(value) {
        world.setDynamicProperty(this.id, value)
    }
    get() {
        return world.getDynamicProperty(this.id);
    }
    remove() {
        world.setDynamicProperty(this.id, undefined)
    }
}

export class PlayerDatabase {
    /**
     * 
     * @param {string} identifier 
     * @param {Player} player 
     */
    constructor(player, identifier) {
        this.id = identifier;
        this.player = player
    }
    /**
     * 
     * @param {string | boolean | number} value 
     */
    set(value) {
        this.player.setDynamicProperty(this.id, value)
    }
    get() {
        return this.player.getDynamicProperty(this.id) ?? undefined
    }
    remove() {
        this.player.setDynamicProperty(this.id, undefined)
    }
}