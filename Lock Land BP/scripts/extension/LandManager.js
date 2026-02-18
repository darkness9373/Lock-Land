import { world } from '@minecraft/server';

export class LandManager {
    constructor() {
        this.maxClaimsDefault = 5;
        this.maxClaimsAdminKey = 'lockland_max_claims';
    }

    /**
     * Get max claims allowed per player
     * @returns {number}
     */
    getMaxClaims() {
        return world.getDynamicProperty(this.maxClaimsAdminKey) ?? this.maxClaimsDefault;
    }

    /**
     * Set max claims allowed per player (requires admin)
     * @param {number} amount 
     */
    setMaxClaims(amount) {
        world.setDynamicProperty(this.maxClaimsAdminKey, amount);
    }

    /**
     * Save a land claim with format: Land_playerName_index
     * @param {string} ownerName - Player's name
     * @param {object} location1 - Vector3 {x, y, z}
     * @param {object} location2 - Vector3 {x, y, z}
     * @param {array} permission - Array of player names with permission
     * @returns {object|null} - The saved land data or null if fails
     */
    saveLand(ownerName, location1, location2, permission = [], name = null, dimension = null) {
        // Get player's current land count
        const countKey = `Land_${ownerName}_count`;
        let count = world.getDynamicProperty(countKey) ?? 0;
        
        // Check if player reached max claims
        if (count >= this.getMaxClaims()) {
            return null;
        }
        
        const landId = `Land_${ownerName}_${count}`;
        
        // Normalize coordinates
        const minX = Math.min(location1.x, location2.x);
        const maxX = Math.max(location1.x, location2.x);
        const minY = Math.min(location1.y, location2.y);
        const maxY = Math.max(location1.y, location2.y);
        const minZ = Math.min(location1.z, location2.z);
        const maxZ = Math.max(location1.z, location2.z);
        
        const landData = {
            id: landId,
            location1: { x: minX, y: minY, z: minZ },
            location2: { x: maxX, y: maxY, z: maxZ },
            owner: ownerName,
            permission: permission,
            name: name ?? `${ownerName}'s Land ${count + 1}`,
            dimension: dimension ?? (location1 && location1.dimension ? location1.dimension : null)
        };
        
        world.setDynamicProperty(landId, JSON.stringify(landData));
        world.setDynamicProperty(countKey, count + 1);
        return landData;
    }

    /**
     * Get all lands owned by a player
     * @param {string} ownerName 
     * @returns {array}
     */
    getPlayerLands(ownerName) {
        const countKey = `Land_${ownerName}_count`;
        const count = world.getDynamicProperty(countKey) ?? 0;
        const lands = [];
        
        for (let i = 0; i < count; i++) {
            const landId = `Land_${ownerName}_${i}`;
            const data = world.getDynamicProperty(landId);
            if (data) {
                try {
                    lands.push(JSON.parse(data));
                } catch {
                    // Invalid data, skip
                }
            }
        }
        
        return lands;
    }

    /**
     * Get a specific land by ID
     * @param {string} landId 
     * @returns {object|null}
     */
    getLandById(landId) {
        const data = world.getDynamicProperty(landId);
        if (!data) return null;
        try {
            return JSON.parse(data);
        } catch {
            return null;
        }
    }

    /**
     * Check if two areas overlap
     * @param {object} loc1a - {x, y, z}
     * @param {object} loc2a - {x, y, z}
     * @param {object} loc1b - {x, y, z}
     * @param {object} loc2b - {x, y, z}
     * @returns {boolean}
     */
    checkOverlap(loc1a, loc2a, loc1b, loc2b) {
        const minXa = Math.min(loc1a.x, loc2a.x);
        const maxXa = Math.max(loc1a.x, loc2a.x);
        const minYa = Math.min(loc1a.y, loc2a.y);
        const maxYa = Math.max(loc1a.y, loc2a.y);
        const minZa = Math.min(loc1a.z, loc2a.z);
        const maxZa = Math.max(loc1a.z, loc2a.z);
        
        const minXb = Math.min(loc1b.x, loc2b.x);
        const maxXb = Math.max(loc1b.x, loc2b.x);
        const minYb = Math.min(loc1b.y, loc2b.y);
        const maxYb = Math.max(loc1b.y, loc2b.y);
        const minZb = Math.min(loc1b.z, loc2b.z);
        const maxZb = Math.max(loc1b.z, loc2b.z);
        
        return !(maxXa < minXb || minXa > maxXb ||
                 maxYa < minYb || minYa > maxYb ||
                 maxZa < minZb || minZa > maxZb);
    }

    /**
     * Check if a new land overlaps with existing lands
     * @param {object} location1 
     * @param {object} location2 
     * @returns {array} - Array of overlapping lands
     */
    checkOverlapWithExisting(location1, location2) {
        const overlapping = [];
        
        for (const key of world.getDynamicPropertyIds()) {
            if (key.startsWith('Land_') && !key.endsWith('_count')) {
                const data = world.getDynamicProperty(key);
                try {
                    const land = JSON.parse(data);
                    if (land.location1 && land.location2) {
                        if (this.checkOverlap(location1, location2, land.location1, land.location2)) {
                            overlapping.push(land);
                        }
                    }
                } catch {
                    // Invalid data, skip
                }
            }
        }
        
        return overlapping;
    }

    /**
     * Delete a land claim
     * @param {string} landId 
     * @returns {boolean}
     */
    deleteLand(landId) {
        const land = this.getLandById(landId);
        if (!land) return false;
        const owner = land.owner;
        const countKey = `Land_${owner}_count`;
        let count = world.getDynamicProperty(countKey) ?? 0;

        // If count is zero just clear and return
        if (count <= 0) {
            world.setDynamicProperty(landId, undefined);
            world.setDynamicProperty(countKey, 0);
            return true;
        }

        // Parse index from id (Land_owner_index)
        const parts = landId.split('_');
        const index = parseInt(parts[parts.length - 1]);

        // Shift subsequent lands down to fill the gap
        for (let i = index; i < count - 1; i++) {
            const nextKey = `Land_${owner}_${i + 1}`;
            const curKey = `Land_${owner}_${i}`;
            const nextData = world.getDynamicProperty(nextKey);
            world.setDynamicProperty(curKey, nextData);
        }

        // Remove last entry and decrement count
        const lastKey = `Land_${owner}_${count - 1}`;
        world.setDynamicProperty(lastKey, undefined);
        world.setDynamicProperty(countKey, count - 1);

        return true;
    }

    /**
     * Get a player's first land (for backward compatibility)
     * @param {string} ownerName 
     * @returns {object|null}
     */
    getLand(ownerName) {
        const lands = this.getPlayerLands(ownerName);
        return lands.length > 0 ? lands[0] : null;
    }

    /**
     * Check if a point is inside any land claim
     * @param {number} x 
     * @param {number} y 
     * @param {number} z 
     * @returns {object|null} - The land object if point is inside
     */
    checkPointInLand(x, y, z) {
        for (const key of world.getDynamicPropertyIds()) {
            if (key.startsWith('Land_') && !key.endsWith('_count')) {
                const data = world.getDynamicProperty(key);
                try {
                    const land = JSON.parse(data);
                    const loc1 = land.location1;
                    const loc2 = land.location2;
                    
                    if (x >= loc1.x && x <= loc2.x &&
                        y >= loc1.y && y <= loc2.y &&
                        z >= loc1.z && z <= loc2.z) {
                        return land;
                    }
                } catch {
                    // Invalid data, skip
                }
            }
        }
        
        return null;
    }

    /**
     * Get all lands in the world
     * @returns {array}
     */
    getAllLands() {
        const lands = [];
        for (const key of world.getDynamicPropertyIds()) {
            if (key.startsWith('Land_') && !key.endsWith('_count')) {
                const data = world.getDynamicProperty(key);
                if (!data) continue;
                try {
                    const land = JSON.parse(data);
                    lands.push(land);
                } catch {
                    // skip invalid
                }
            }
        }
        return lands;
    }

    /**
     * Delete all lands in the world efficiently (without reindexing)
     * @returns {number} - Number of lands deleted
     */
    deleteAllLands() {
        let count = 0;
        const keysToRemove = [];
        for (const key of world.getDynamicPropertyIds()) {
            if (key.startsWith('Land_')) {
                keysToRemove.push(key);
            }
        }
        for (const key of keysToRemove) {
            world.setDynamicProperty(key, undefined);
            count++;
        }
        return count;
    }

    /**
     * Add a player to the permission list
     * @param {string} landId 
     * @param {string} playerName 
     * @returns {boolean}
     */
    addPermission(landId, playerName) {
        const land = this.getLandById(landId);
        if (!land) return false;
        
        if (!land.permission.includes(playerName)) {
            land.permission.push(playerName);
            world.setDynamicProperty(landId, JSON.stringify(land));
        }
        return true;
    }

    /**
     * Remove a player from the permission list
     * @param {string} landId 
     * @param {string} playerName 
     * @returns {boolean}
     */
    removePermission(landId, playerName) {
        const land = this.getLandById(landId);
        if (!land) return false;
        
        land.permission = land.permission.filter(p => p !== playerName);
        world.setDynamicProperty(landId, JSON.stringify(land));
        return true;
    }

    /**
     * Check if a player has permission in a land
     * @param {string} playerName 
     * @param {object} land 
     * @returns {boolean}
     */
    hasPermission(playerName, land) {
        if (playerName === land.owner) return true;
        return land.permission && land.permission.includes(playerName);
    }
}

export default new LandManager();
