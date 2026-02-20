import { Player, world, system, Direction } from '@minecraft/server'
import { ActionFormData, ModalFormData } from '@minecraft/server-ui'

world.beforeEvents.itemUse.subscribe(data => {
    const player = data.source
    const item = data.itemStack
    if (!(player instanceof Player)) return
    if (!item || item.typeId !== 'drk:lock_land') return
    const pos1 = player.getDynamicProperty('lockpos1')
    const pos2 = player.getDynamicProperty('lockpos2')
    if (pos1 && pos2) {
        system.run(() => {
            confirmLand(player)
        })
        return
    }
    if (!player.isSneaking) {
        system.run(() => {
            showMainMenu(player)
        })
        return
    }
    
})

world.beforeEvents.playerInteractWithBlock.subscribe(data => {
    const player = data.player
    const block = data.block
    const face = data.blockFace
    const item = data.itemStack

    if (!(player instanceof Player)) return
    if (!item || item.typeId !== 'drk:lock_land') return

    let { x, y, z } = block.location
    switch (face) {
        case Direction.down:
            y -= 1
            break
        case Direction.up:
            y += 1
            break
        case Direction.north:
            z -= 1
            break
        case Direction.south:
            z += 1
            break
        case Direction.west:
            x -= 1
            break
        case Direction.east:
            x += 1
            break
    }
    saveLand(player, { x, y, z })
})

/**
 * 
 * @param {Player} player 
 */
function showMainMenu(player) {
    const form = new ActionFormData()
}

/**
 * 
 * @param {Player} player 
 */
function saveLand(player, pos) {
    const pos1 = player.getDynamicProperty('lockpos1')
    const pos2 = player.getDynamicProperty('lockpos2')

    if (!pos1) {
        player.setDynamicProperty('lockpos1', pos)
        player.sendMessage(`Position 1 set to (${pos.x}, ${pos.y}, ${pos.z})`)
        return
    }
    if (!pos2) {
        player.setDynamicProperty('lockpos2', pos)
        player.sendMessage(`Position 2 set to (${pos.x}, ${pos.y}, ${pos.z})`)
        return
    }
}

/**
 * 
 * @param {Player} player 
 */
function confirmLand(player) {
    const form = new ModalFormData()
}