import { system, Player } from '@minecraft/server';


class Tag {
    /**
     * 
     * @param {Player} player 
     * @param {string} tag 
     */
    add(player, tag) {
        system.run(() => {
            return player.addTag(tag)
        })
    }
    /**
     * 
     * @param {Player} player 
     * @param {string} tag
     */
    remove(player, tag) {
        system.run(() => {
            return player.removeTag(tag)
        })
    }
    /**
     * 
     * @param {Player} player 
     */
    list(player) {
        return player.getTags()
    }
}

export default new Tag();