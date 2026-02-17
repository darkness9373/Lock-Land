import { world, Player, BlockPermutation } from '@minecraft/server';
import LandManager from './LandManager.js';

export class Protection {
    /**
     * Check if a player can interact with a location
     * @param {Player} player 
     * @param {number} x 
     * @param {number} y 
     * @param {number} z 
     * @returns {object|null} - Land data if player is restricted, null if allowed
     */
    static checkRestriction(player, x, y, z) {
        const land = LandManager.checkPointInLand(x, y, z);
        
        if (!land) {
            // Not in a protected area
            return null;
        }
        
        // Check if player has permission
        if (LandManager.hasPermission(player.name, land)) {
            // Player has permission, allow
            return null;
        }
        
        // Player is restricted
        return land;
    }

    /**
     * Check if player can break blocks
     * @param {Player} player 
     * @param {number} x 
     * @param {number} y 
     * @param {number} z 
     * @returns {boolean} - true if allowed, false if restricted
     */
    static canBreakBlock(player, x, y, z) {
        return this.checkRestriction(player, x, y, z) === null;
    }

    /**
     * Check if player can place blocks
     * @param {Player} player 
     * @param {number} x 
     * @param {number} y 
     * @param {number} z 
     * @returns {boolean} - true if allowed, false if restricted
     */
    static canPlaceBlock(player, x, y, z) {
        return this.checkRestriction(player, x, y, z) === null;
    }

    /**
     * Check if player can interact with entity (hit/attack)
     * @param {Player} player 
     * @param {number} x 
     * @param {number} y 
     * @param {number} z 
     * @returns {boolean} - true if allowed, false if restricted
     */
    static canInteractEntity(player, x, y, z) {
        return this.checkRestriction(player, x, y, z) === null;
    }

    /**
     * Check if player can interact with container/block UI
     * @param {Player} player 
     * @param {number} x 
     * @param {number} y 
     * @param {number} z 
     * @returns {boolean} - true if allowed, false if restricted
     */
    static canInteractBlock(player, x, y, z) {
        return this.checkRestriction(player, x, y, z) === null;
    }

    /**
     * Notify player they can't interact
     * @param {Player} player 
     * @param {object} land 
     */
    static notifyRestricted(player, land) {
        player.sendMessage(`§c[Lock Land] This area is protected by §f${land.owner}§c.`);
    }
}

export default Protection;
