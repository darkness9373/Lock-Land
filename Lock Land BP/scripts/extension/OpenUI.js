import { world, system, Player, EntityComponentTypes } from '@minecraft/server'
import { FormCancelationReason } from '@minecraft/server-ui'


class OpenUI {
    /**
     * 
     * @param {string} tag - The entity tag that the hit entity must have for the UI to open.
     * @param {Function} form - A callback function that will be executed to open the UI for the player.
     */
    entity(tag, form) {
        world.afterEvents.entityHitEntity.subscribe(data => {
            const entity = data.hitEntity;
            const player = data.damagingEntity;
            if (!(player instanceof Player)) return;
            if (!entity.hasTag(tag)) return;
            
            let inv = player.getComponent(EntityComponentTypes.Inventory).container;
            let item = inv.getItem(player.selectedSlotIndex)
            const blocked = ['variant', 'size', 'look', 'direction']
            if (item && item.typeId === 'minecraft:stick' && blocked.includes(item.nameTag)) {
                return;
            }
            system.run(() => {
                form(player)
            })
        })
    }
    
    /**
     * 
     * @template T
     * @param {Player} player 
     * @param {{ show(player: Player): Promise<T>}} form 
     * @param {number} timeout 
     * @param {number} interval 
     * @returns  {Promise<T>}
     */
    async force(player, form, timeout = Infinity, interval = 5) {
        const startTick = system.currentTick;
        while (system.currentTick - startTick < timeout) {
            const response = await form.show(player);
            if (response.cancelationReason !== FormCancelationReason.UserBusy) {
                return response;
            }
            await this.wait(interval)
        }
        throw new Error(`Timed out after ${timeout} ticks`)
    }
    wait(ticks) {
        return new Promise((resolve) => system.runTimeout(resolve, ticks))
    }
}


export default new OpenUI();