import { world, Player, system, BlockPermutation, Vector3, Dimension } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import Tag from "./extension/Tag"
import LandManager from "./extension/LandManager"
import Protection from "./extension/Protection"

// Handle item use - sneak to set positions
world.beforeEvents.itemUse.subscribe(data => {
    const player = data.source
    if (!(player instanceof Player)) return;
    const item = data.itemStack
    if (!item || item.typeId !== "drk:lock_land") return;
    
    // Check if player is sneaking
    if (!player.isSneaking) {
        // Not sneaking: Show main menu
        system.run(() => {
            showMainMenu(player);
        });
        return;
    }
    
    // Sneaking: Set positions
    setPosition(player);
})

/**
 * Set position when sneaking with Lock Land item
 * @param {Player} player 
 */
function setPosition(player) {
    const playerName = player.name;
    const playerLands = LandManager.getPlayerLands(playerName);
    const maxClaims = LandManager.getMaxClaims();
    
    // Check if player reached max claims
    if (playerLands.length >= maxClaims) {
        player.sendMessage(`§c[Lock Land] You have reached the maximum land claims (§f${maxClaims}§c).`);
        player.sendMessage(`§c[Lock Land] Delete a claim first to create a new one.`);
        return;
    }
    
    const location = player.location;
    
    // Check if this is the first position
    if (!player.hasTag('lockland_pos1')) {
        Tag.add(player, 'lockland_pos1');
        player.setDynamicProperty('locklandPos1', JSON.stringify(location));
        player.sendMessage(`§a[Lock Land] §bPosition 1 set: §f${Math.floor(location.x)}, ${Math.floor(location.y)}, ${Math.floor(location.z)}`);
        
        // Start particle visualization
        startParticleVisualization(player);
        return;
    }
    
    // This is the second position
    if (player.hasTag('lockland_pos1') && !player.hasTag('lockland_pos2')) {
        Tag.add(player, 'lockland_pos2');
        player.setDynamicProperty('locklandPos2', JSON.stringify(location));
        player.sendMessage(`§a[Lock Land] §bPosition 2 set: §f${Math.floor(location.x)}, ${Math.floor(location.y)}, ${Math.floor(location.z)}`);
        
        // Stop particle visualization by removing the tag that controls it
        Tag.remove(player, 'lockland_show_particles');
        
        // Show confirmation form
        system.run(() => {
            showConfirmationForm(player);
        });
        return;
    }
}

/**
 * Main menu
 * @param {Player} player
 */
function showMainMenu(player) {
    const form = new ActionFormData()
        .title('§6Lock Land - Menu')
        .body('Select an option:')
        .button('§2Manage Lands')
        .button('§3Permissions');

    if (player.hasTag && player.hasTag('admin')) {
        form.button('§4Admin');
    }

    form.show(player).then(result => {
        if (result.canceled) return;
        if (result.selection === 0) {
            showLandMenu(player);
        } else if (result.selection === 1) {
            showPermissionList(player);
        } else if (result.selection === 2) {
            showAdminMenu(player);
        }
    });
}

function showPermissionList(player) {
    const lands = LandManager.getPlayerLands(player.name);
    if (lands.length === 0) {
        player.sendMessage('§c[Lock Land] You have no lands to manage permissions for.');
        return;
    }

    const form = new ActionFormData()
        .title('§6Lock Land - Permissions')
        .body('Select a land to manage permissions:');

    lands.forEach(land => form.button(`${land.name || land.id} — ${land.owner}`));
    form.button('§a↩ Back');

    form.show(player).then(result => {
        if (result.canceled) return;
        if (result.selection >= 0 && result.selection < lands.length) {
            showPermissionMenu(player, lands[result.selection]);
        }
    });
}

function showAdminMenu(player) {
    const form = new ActionFormData()
        .title('§6Lock Land - Admin')
        .body('Admin actions:')
        .button('§eList All Lands')
        .button('§cDelete All Lands')
        .button('§a↩ Back');

    form.show(player).then(result => {
        if (result.canceled) return;
        if (result.selection === 0) {
            showAllLandsAdminList(player);
        } else if (result.selection === 1) {
            // Confirm delete all
            const confirm = new ActionFormData()
                .title('Confirm Delete All')
                .body('Are you sure you want to delete ALL lands in the world?')
                .button('§cYes, delete all')
                .button('§aCancel');
            confirm.show(player).then(cres => {
                if (cres.canceled) return;
                if (cres.selection === 0) {
                    // Efficiently delete all lands at once
                    const count = LandManager.deleteAllLands();
                    player.sendMessage(`§a[Lock Land] ${count} lands deleted.`);
                }
            });
        }
    });
}

function showAllLandsAdminList(player) {
    const lands = LandManager.getAllLands();
    if (lands.length === 0) {
        player.sendMessage('§c[Lock Land] No lands found.');
        return;
    }

    const form = new ActionFormData().title('§6All Lands').body('Select a land:');
    lands.forEach(land => form.button(`${land.name || land.id}\n§7${land.owner}`));
    form.button('§a↩ Back');

    form.show(player).then(result => {
        if (result.canceled) return;
        if (result.selection >= 0 && result.selection < lands.length) {
            adminLandDetailForm(player, lands[result.selection]);
        }
    });
}

function adminLandDetailForm(player, land) {
    const loc1 = land.location1;
    const loc2 = land.location2;
    const size = {
        x: Math.abs(Math.round(loc2.x) - Math.round(loc1.x)) + 1,
        y: Math.abs(Math.round(loc2.y) - Math.round(loc1.y)) + 1,
        z: Math.abs(Math.round(loc2.z) - Math.round(loc1.z)) + 1
    };
    const area = size.x * size.z;

    const form = new ActionFormData()
        .title('§6Lock Land - Admin View')
        .body(
            `§bOwner: §f${land.owner}\n` +
            `§bName: §f${land.name || 'N/A'}\n` +
            `§bSize: §f${size.x}×${size.y}×${size.z} | Area: ${area}m²\n`
        )
        .button('§a↪ Teleport')
        .button('§cDelete Land')
        .button('§a↩ Back');

    form.show(player).then(result => {
        if (result.canceled) return;
        if (result.selection === 0) {
            // Teleport to center
            const cx = Math.floor((loc1.x + loc2.x) / 2) + 0.5;
            const cy = Math.floor((loc1.y + loc2.y) / 2);
            const cz = Math.floor((loc1.z + loc2.z) / 2) + 0.5;
                try {
                    const dest = findSafeTeleportLocation(player.dimension, loc1, loc2);
                    if (dest) {
                        try {
                            if (land.dimension) {
                                try {
                                    const dim = world.getDimension ? world.getDimension(land.dimension) : null;
                                    if (dim) dest.dimension = dim;
                                } catch (e) {}
                            }
                            if (player.tryTeleport) {
                                const ok = player.tryTeleport(dest);
                                if (ok) player.sendMessage('§a[Lock Land] Teleported to land.');
                                else player.sendMessage('§c[Lock Land] Teleport attempt failed.');
                            } else {
                                player.teleport(dest);
                                player.sendMessage('§a[Lock Land] Teleported to land.');
                            }
                        } catch (e) {
                            player.sendMessage('§c[Lock Land] Teleport failed: ' + e);
                        }
                    } else {
                        player.sendMessage('§c[Lock Land] No safe teleport location found.');
                    }
                } catch (e) {
                    player.sendMessage('§c[Lock Land] Teleport failed: ' + e);
                }
        } else if (result.selection === 1) {
            LandManager.deleteLand(land.id);
            player.sendMessage('§a[Lock Land] Land deleted.');
        }
    });
}

/**
 * Start particle visualization cuboid
 * @param {Player} player 
 */
function startParticleVisualization(player) {
    // Add tag that global particle loop will use to display visualization
    Tag.add(player, 'lockland_show_particles');
}

/**
 * Draw cuboid outline with particles
 * @param {Dimension} dimension 
 * @param {number} minX 
 * @param {number} minY 
 * @param {number} minZ 
 * @param {number} maxX 
 * @param {number} maxY 
 * @param {number} maxZ 
 */
function drawCuboidParticles(dimension, minX, minY, minZ, maxX, maxY, maxZ) {
    const corners = [
        { x: minX, y: minY, z: minZ },
        { x: maxX, y: minY, z: minZ },
        { x: minX, y: maxY, z: minZ },
        { x: maxX, y: maxY, z: minZ },
        { x: minX, y: minY, z: maxZ },
        { x: maxX, y: minY, z: maxZ },
        { x: minX, y: maxY, z: maxZ },
        { x: maxX, y: maxY, z: maxZ }
    ];
    
    // Draw edges
    const edges = [
        [0, 1], [2, 3], [4, 5], [6, 7],  // Parallel to X
        [0, 2], [1, 3], [4, 6], [5, 7],  // Parallel to Y
        [0, 4], [1, 5], [2, 6], [3, 7]   // Parallel to Z
    ];
    
    edges.forEach(edge => {
        const p1 = corners[edge[0]];
        const p2 = corners[edge[1]];
        drawLineParticles(dimension, p1, p2);
    });
}

/**
 * Draw a line between two points using particles
 * @param {Dimension} dimension 
 * @param {object} p1 - {x, y, z}
 * @param {object} p2 - {x, y, z}
 */
function drawLineParticles(dimension, p1, p2) {
    const steps = 16;
    
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = p1.x + (p2.x - p1.x) * t;
        const y = p1.y + (p2.y - p1.y) * t;
        const z = p1.z + (p2.z - p1.z) * t;
        
        // Spawn particle at this location
        dimension.spawnParticle('minecraft:redstone_ore_dust_particle', { x, y, z }, {
            brightness: { block: 15, sky: 15 }
        });
    }
}

/**
 * Find a safe teleport location inside the given land box.
 * Tries the center column and searches downward for a solid block with
 * two air blocks above and no lava/water.
 * @param {Dimension} dimension
 * @param {object} loc1
 * @param {object} loc2
 * @returns {Vector3|null}
 */
function findSafeTeleportLocation(dimension, loc1, loc2) {
    const minX = Math.min(loc1.x, loc2.x);
    const maxX = Math.max(loc1.x, loc2.x);
    const minY = Math.min(loc1.y, loc2.y);
    const maxY = Math.max(loc1.y, loc2.y);
    const minZ = Math.min(loc1.z, loc2.z);
    const maxZ = Math.max(loc1.z, loc2.z);

    const cx = Math.floor((minX + maxX) / 2) + 0.5;
    const cz = Math.floor((minZ + maxZ) / 2) + 0.5;

    // search from top down within a reasonable range
    const top = Math.min(maxY + 5, 256);
    const bottom = Math.max(minY - 5, 1);

    function getId(b) {
        if (!b) return null;
        return b.typeId || b.id || (b.permutation && b.permutation.type && b.permutation.type.id) || null;
    }

    for (let y = top; y >= bottom; y--) {
        try {
            const below = dimension.getBlock({ x: Math.floor(cx), y: y - 1, z: Math.floor(cz) });
            const at = dimension.getBlock({ x: Math.floor(cx), y: y, z: Math.floor(cz) });
            const above = dimension.getBlock({ x: Math.floor(cx), y: y + 1, z: Math.floor(cz) });

            const belowId = getId(below);
            const atId = getId(at);
            const aboveId = getId(above);

            const isAir = id => !id || id.includes('air');
            const isLiquid = id => id && (id.includes('lava') || id.includes('water'));

            if (!isAir(belowId) && !isLiquid(belowId) && isAir(atId) && isAir(aboveId)) {
                return new Vector3(cx, y, cz);
            }
        } catch (e) {
            // ignore API differences and continue
        }
    }

    // fallback: place at top of the land box
    const fallbackY = Math.min(maxY + 1, 256);
    return new Vector3(cx, fallbackY, cz);
}

// Global particle loop: update visualizations for players who set pos1
system.runInterval(() => {
    world.getPlayers().forEach(player => {
        if (!player.hasTag('lockland_show_particles')) return;

        const pos1Str = player.getDynamicProperty('locklandPos1');
        if (!pos1Str) {
            Tag.remove(player, 'lockland_show_particles');
            return;
        }

        try {
            const pos1 = JSON.parse(pos1Str);
            const playerPos = player.location;

            const minX = Math.min(pos1.x, playerPos.x);
            const maxX = Math.max(pos1.x, playerPos.x);
            const minY = Math.min(pos1.y, playerPos.y);
            const maxY = Math.max(pos1.y, playerPos.y);
            const minZ = Math.min(pos1.z, playerPos.z);
            const maxZ = Math.max(pos1.z, playerPos.z);

            drawCuboidParticles(player.dimension, minX, minY, minZ, maxX, maxY, maxZ);
        } catch (e) {
            // ignore
        }
    });
}, 1);

/**
 * Show confirmation form to create the land claim
 * @param {Player} player 
 */
function showConfirmationForm(player) {
    const pos1Str = player.getDynamicProperty('locklandPos1');
    const pos2Str = player.getDynamicProperty('locklandPos2');
    
    if (!pos1Str || !pos2Str) {
        resetLandSelection(player);
        player.sendMessage("§c[Lock Land] Error: Positions not found.");
        return;
    }
    
    const pos1 = JSON.parse(pos1Str);
    const pos2 = JSON.parse(pos2Str);
    
    // Check for overlap with existing lands
    const overlappingLands = LandManager.checkOverlapWithExisting(pos1, pos2);
    
    // Calculate size (use integer coordinates)
    const size = {
        x: Math.abs(Math.round(pos2.x) - Math.round(pos1.x)) + 1,
        y: Math.abs(Math.round(pos2.y) - Math.round(pos1.y)) + 1,
        z: Math.abs(Math.round(pos2.z) - Math.round(pos1.z)) + 1
    };
    const area = size.x * size.z;
    
    let bodyText = 
        `§bPosition 1: §f${Math.floor(pos1.x)}, ${Math.floor(pos1.y)}, ${Math.floor(pos1.z)}\n` +
        `§bPosition 2: §f${Math.floor(pos2.x)}, ${Math.floor(pos2.y)}, ${Math.floor(pos2.z)}\n\n` +
        `§bSize: §f${size.x}×${size.y}×${size.z}\n` +
        `§bArea: §f${area}m²\n`;
    
    // Add warning if overlapping
    if (overlappingLands.length > 0) {
        bodyText += `\n§c⚠ WARNING: This area overlaps with:\n`;
        overlappingLands.forEach(land => {
            bodyText += `§7• ${land.owner}'s land\n`;
        });
        bodyText += `§c\nYou cannot claim this area!`;
    } else {
        bodyText += `\n§aThis area is clear for claiming.`;
    }
    
    const form = new ActionFormData()
        .title("§6Lock Land - Confirm")
        .body(bodyText)
        .button(overlappingLands.length > 0 ? "§7✗ Blocked" : "§a✓ Confirm")
        .button("§c✗ Cancel");
    
    form.show(player).then(result => {
        if (result.canceled) {
            resetLandSelection(player);
            player.sendMessage("§c[Lock Land] Land claim cancelled.");
            return;
        }
        
        if (result.selection === 0) {
            // Confirm button
            if (overlappingLands.length > 0) {
                // Cannot claim - overlap detected
                player.sendMessage(`§c[Lock Land] Cannot claim land - overlaps with existing claims!`);
                resetLandSelection(player);
                return;
            }
            
            // Confirm - save the land
            // Ask for a name using modal
            const defaultName = `${player.name}'s Land`;
            const nameForm = new ModalFormData()
                .title('§6Lock Land - Name')
                .textField('Enter a name for this land', 'My Land', { defaultValue: defaultName });

            nameForm.show(player).then(nResult => {
                if (nResult.canceled) {
                    resetLandSelection(player);
                    player.sendMessage('§c[Lock Land] Land claim cancelled.');
                    return;
                }
                const landName = nResult.formValues[0] || defaultName;
                try {
                    const dimId = player.dimension && player.dimension.id ? player.dimension.id : null;
                    const savedLand = LandManager.saveLand(player.name, pos1, pos2, [], landName, dimId);
                    if (!savedLand) {
                        player.sendMessage(`§c[Lock Land] Cannot save land - you've reached the maximum claims limit!`);
                        resetLandSelection(player);
                        return;
                    }
                    resetLandSelection(player);
                    player.sendMessage(`§a[Lock Land] Land claim saved successfully!`);
                    player.sendMessage(`§b[Lock Land] This area is now protected.`);
                } catch (error) {
                    player.sendMessage(`§c[Lock Land] Error saving land: ${error}`);
                    resetLandSelection(player);
                }
            });
        } else {
            // Cancel button - delete saved positions
            resetLandSelection(player);
            player.sendMessage("§c[Lock Land] Land claim cancelled.");
        }
    });
}

/**
 * Show land menu when not sneaking
 * @param {Player} player 
 */
function showLandMenu(player) {
    const lands = LandManager.getPlayerLands(player.name);
    const maxClaims = LandManager.getMaxClaims();
    
    if (lands.length === 0) {
        player.sendMessage("§c[Lock Land] You don't have any land claims yet.");
        player.sendMessage(`§b[Lock Land] Sneak and right-click to create one (max §f${maxClaims}§b).`);
        return;
    }
    
    const form = new ActionFormData()
        .title("§6Lock Land - My Claims")
        .body(`§bYour lands: §f${lands.length}§b/§f${maxClaims}\n\n`);
    
    lands.forEach((land, index) => {
        const loc1 = land.location1;
        const loc2 = land.location2;
        const size = {
            x: Math.abs(Math.round(loc2.x) - Math.round(loc1.x)) + 1,
            y: Math.abs(Math.round(loc2.y) - Math.round(loc1.y)) + 1,
            z: Math.abs(Math.round(loc2.z) - Math.round(loc1.z)) + 1
        };
        const area = size.x * size.z;
        
        form.button(
            `${land.name ? `§b${land.name}\n` : `Land #${index + 1}\n`}` +
            `§7Size: ${size.x}×${size.y}×${size.z} | Area: ${area}m²`
        );
    });
    
    form.show(player).then(result => {
        if (result.canceled) return;
        
        if (result.selection >= 0 && result.selection < lands.length) {
            const selectedLand = lands[result.selection];
            showLandDetailForm(player, selectedLand);
        }
    });
}

/**
 * Show detailed info for a specific land
 * @param {Player} player 
 * @param {object} land 
 */
function showLandDetailForm(player, land) {
    const loc1 = land.location1;
    const loc2 = land.location2;
    const size = {
        x: Math.abs(Math.round(loc2.x) - Math.round(loc1.x)) + 1,
        y: Math.abs(Math.round(loc2.y) - Math.round(loc1.y)) + 1,
        z: Math.abs(Math.round(loc2.z) - Math.round(loc1.z)) + 1
    };
    const area = size.x * size.z;
    
    const form = new ActionFormData()
        .title("§6Lock Land - Details")
        .body(
            `§bCoordinates:\n` +
            `§fMin: §7${loc1.x}, ${loc1.y}, ${loc1.z}\n` +
            `§fMax: §7${loc2.x}, ${loc2.y}, ${loc2.z}\n\n` +
            `§bSize: §f${size.x}×${size.y}×${size.z}\n` +
            `§bArea: §f${area}m²\n\n` +
            `§bPermissions: §f${land.permission.length}§b player(s)`
        )
        .button("§a↪ Teleport")
        .button("§3⚙ Manage Permissions")
        .button("§c🗑 Delete Claim")
        .button("§a↩ Back");
    
    form.show(player).then(result => {
        if (result.canceled) return;
        
        if (result.selection === 0) {
            // Teleport (owner or admin)
            const loc1 = land.location1;
            const loc2 = land.location2;
            try {
                const dest = findSafeTeleportLocation(player.dimension, loc1, loc2);
                        if (dest) {
                        // Only allow teleport if owner or admin
                        if (player.name === land.owner || (player.hasTag && player.hasTag('admin'))) {
                            try {
                                // attach dimension if present
                                if (land.dimension) {
                                    try {
                                        const dim = world.getDimension ? world.getDimension(land.dimension) : null;
                                        if (dim) dest.dimension = dim;
                                    } catch (e) {}
                                }
                                if (player.tryTeleport) {
                                    const ok = player.tryTeleport(dest);
                                    if (!ok) player.sendMessage('§c[Lock Land] Teleport attempt failed.');
                                } else {
                                    player.teleport(dest);
                                }
                            } catch (e) {
                                player.sendMessage('§c[Lock Land] Teleport failed.');
                            }
                        } else {
                            player.sendMessage('§c[Lock Land] You can only teleport to your own land.');
                        }
                } else {
                    player.sendMessage('§c[Lock Land] No safe teleport location found.');
                }
            } catch (e) {
                player.sendMessage('§c[Lock Land] Teleport failed.');
            }
        } else if (result.selection === 1) {
            showPermissionMenu(player, land);
        } else if (result.selection === 2) {
            // Delete - only owner or admin
            if (player.name === land.owner || (player.hasTag && player.hasTag('admin'))) {
                confirmDelete(player, land);
            } else {
                player.sendMessage('§c[Lock Land] You do not have permission to delete this land.');
            }
        } else if (result.selection === 3) {
            showLandMenu(player);
        }
    });
}

/**
 * Show permission management menu
 * @param {Player} player 
 * @param {object} land 
 */
function showPermissionMenu(player, land) {
    const form = new ActionFormData()
        .title("§6Lock Land - Permissions")
        .body(`§bPlayers with access: §f${land.permission.length}\n\n`);
    
    if (land.permission.length > 0) {
        form.body(land.permission.map(p => `§7• ${p}`).join('\n') + "\n\n");
    } else {
        form.body("§8No players have access yet.\n\n");
    }
    
    form.button("§a➕ Add Player")
     .button("§c➖ Remove Player")
     .button("§a↩ Back");
    
    form.show(player).then(result => {
        if (result.canceled) return;
        
        if (result.selection === 0) {
            // Add player - show form
            showAddPermissionForm(player, land);
        } else if (result.selection === 1) {
            // Remove player - show list
            if (land.permission.length === 0) {
                player.sendMessage("§c[Lock Land] No players to remove.");
                showPermissionMenu(player, land);
                return;
            }
            showRemovePermissionForm(player, land);
        } else if (result.selection === 2) {
            // Back
            showLandDetailForm(player, land);
        }
    });
}

/**
 * Show form to add a player to permission list
 * @param {Player} player 
 * @param {object} land 
 */
function showAddPermissionForm(player, land) {
    // Get all online players
    const allPlayers = world.getAllPlayers();
    
    // Filter players: exclude owner and players who already have permission
    const availablePlayers = allPlayers.filter(p => {
        return p.name !== land.owner && !land.permission.includes(p.name);
    });
    
    if (availablePlayers.length === 0) {
        player.sendMessage("§c[Lock Land] No players available to add.");
        showPermissionMenu(player, land);
        return;
    }
    
    const form = new ActionFormData()
        .title("§6Lock Land - Add Player")
        .body("§bSelect a player to add:\n\n");
    
    availablePlayers.forEach(p => {
        form.button(`§a+ ${p.name}`);
    });
    
    form.button("§a↩ Back");
    
    form.show(player).then(result => {
        if (result.canceled) {
            showPermissionMenu(player, land);
            return;
        }
        
        // Back button
        if (result.selection === availablePlayers.length) {
            showPermissionMenu(player, land);
            return;
        }
        
        const playerToAdd = availablePlayers[result.selection];
        
        // Add permission
        if (LandManager.addPermission(land.id, playerToAdd.name)) {
            // Refresh land data
            const updatedLand = LandManager.getLandById(land.id);
            player.sendMessage(`§a[Lock Land] §f${playerToAdd.name}§a has been added to permissions.`);
            showPermissionMenu(player, updatedLand);
        } else {
            player.sendMessage(`§c[Lock Land] Failed to add permission.`);
            showAddPermissionForm(player, land);
        }
    });
}

/**
 * Show form to remove a player from permission list
 * @param {Player} player 
 * @param {object} land 
 */
function showRemovePermissionForm(player, land) {
    const form = new ActionFormData()
        .title("§6Lock Land - Remove Player")
        .body("§bSelect a player to remove:\n\n");
    
    land.permission.forEach(p => {
        form.button(`§c✕ ${p}`);
    });
    
    form.button("§a↩ Back");
    
    form.show(player).then(result => {
        if (result.canceled) {
            showPermissionMenu(player, land);
            return;
        }
        
        // Back button
        if (result.selection === land.permission.length) {
            showPermissionMenu(player, land);
            return;
        }
        
        const playerToRemove = land.permission[result.selection];
        
        // Remove permission
        if (LandManager.removePermission(land.id, playerToRemove)) {
            // Refresh land data
            const updatedLand = LandManager.getLandById(land.id);
            player.sendMessage(`§a[Lock Land] §f${playerToRemove}§a has been removed from permissions.`);
            showPermissionMenu(player, updatedLand);
        } else {
            player.sendMessage(`§c[Lock Land] Failed to remove permission.`);
            showRemovePermissionForm(player, land);
        }
    });
}

/**
 * Confirm deletion
 * @param {Player} player 
 * @param {object} land 
 */
function confirmDelete(player, land) {
    const form = new ActionFormData()
        .title("§6Lock Land - Confirm Delete")
        .body("§c⚠ Are you sure? This cannot be undone!\n\nAll protections will be removed.")
        .button("§c✓ Delete")
        .button("§a✗ Cancel");
    
    form.show(player).then(result => {
        if (result.canceled) return;
        
        if (result.selection === 0) {
            if (LandManager.deleteLand(land.id)) {
                player.sendMessage(`§a[Lock Land] Land claim deleted.`);
            } else {
                player.sendMessage(`§c[Lock Land] Failed to delete land claim.`);
            }
        } else {
            showLandDetailForm(player, land);
        }
    });
}

/**
 * Reset player's land selection
 * @param {Player} player 
 */
function resetLandSelection(player) {
    Tag.remove(player, 'lockland_pos1');
    Tag.remove(player, 'lockland_pos2');
    Tag.remove(player, 'lockland_show_particles');
    player.setDynamicProperty('locklandPos1', undefined);
    player.setDynamicProperty('locklandPos2', undefined);
}

// Block breaking protection
world.beforeEvents.playerBreakBlock.subscribe(data => {
    const player = data.player;
    const block = data.block;
    
    const land = Protection.checkRestriction(player, Math.floor(block.location.x), Math.floor(block.location.y), Math.floor(block.location.z));
    
    if (land) {
        Protection.notifyRestricted(player, land);
        data.cancel = true;
    }
});

// Block placement protection
world.afterEvents.playerPlaceBlock.subscribe(data => {
    const player = data.player;
    const block = data.block;
    
    const land = Protection.checkRestriction(player, Math.floor(block.location.x), Math.floor(block.location.y), Math.floor(block.location.z));
    
    if (land) {
        Protection.notifyRestricted(player, land);
        // Remove the block that was just placed
        block.setPermutation(BlockPermutation.resolve("minecraft:air"));
    }
});

// Block interaction protection (chests, doors, signs, etc)
world.beforeEvents.playerInteractWithBlock.subscribe(data => {
    const player = data.player;
    const block = data.block;
    
    const land = Protection.checkRestriction(player, Math.floor(block.location.x), Math.floor(block.location.y), Math.floor(block.location.z));
    
    if (land) {
        Protection.notifyRestricted(player, land);
        data.cancel = true;
    }
});

// Apply weakness effect to players in protected lands
system.runInterval(() => {
    world.getPlayers().forEach(player => {
        const land = LandManager.checkPointInLand(
            Math.floor(player.location.x),
            Math.floor(player.location.y),
            Math.floor(player.location.z)
        );
        
        // If player is in a land they don't own
        if (land && !LandManager.hasPermission(player.name, land)) {
            // Apply weakness effect for 1 second (reapplied by the interval)
            player.addEffect('weakness', 1, { amplifier: 254, showParticles: false });
        }
    });
}, 10); // Check every 10 ticks (0.5 seconds)

// Explosion protection - cancel creeper, TNT, crystal, and fireball explosions that damage protected lands
world.afterEvents.entityDie.subscribe(data => {
    const entity = data.deadEntity;
    const location = entity.location;
    
    let explosionRadius = 0;
    
    // Map entity types to explosion radius
    if (entity.typeId === 'minecraft:creeper') {
        explosionRadius = 6;
    } else if (entity.typeId === 'minecraft:tnt' || entity.typeId === 'minecraft:tnt_minecart') {
        explosionRadius = 5;
    } else if (entity.typeId === 'minecraft:end_crystal') {
        explosionRadius = 6;
    } else {
        return; // Not an explosion entity
    }
    
    // Check if explosion would damage protected land
    const affectedLand = Protection.checkExplosionDamage(location.x, location.y, location.z, explosionRadius);
    
    if (affectedLand) {
        world.sendMessage(`§c[Lock Land] Explosion prevented in protected land: §f${affectedLand.name}`);
    }
});

// Projectile protection - cancel fireballs and other projectiles that land in protected areas
world.afterEvents.projectileHit.subscribe(data => {
    const projectile = data.projectile;
    let explosionRadius = 0;
    
    // Map projectile types to explosion radius
    if (projectile.typeId === 'minecraft:fireball') {
        explosionRadius = 5;
    } else if (projectile.typeId === 'minecraft:small_fireball') {
        explosionRadius = 3;
    } else {
        return;
    }
    
    const location = projectile.location;
    
    // Check if explosion would damage protected land
    const affectedLand = Protection.checkExplosionDamage(location.x, location.y, location.z, explosionRadius);
    
    if (affectedLand) {
        // Kill the projectile to prevent explosion
        projectile.kill();
        world.sendMessage(`§c[Lock Land] Fireball cancelled in protected land: §f${affectedLand.name}`);
    }
});

// Monitor active TNT and Creeper to prevent primed explosions in protected lands
system.runInterval(() => {
    // Monitor all dimensions
    const dimensions = ['overworld', 'nether', 'the_end'];
    
    for (const dimName of dimensions) {
        try {
            const dimension = world.getDimension(dimName);
            
            // Check TNT entities (including TNT that may explode and reach protected lands)
            for (const entity of dimension.getEntities({ type: 'minecraft:tnt' })) {
                try {
                    const location = entity.location;
                    const fx = Math.floor(location.x);
                    const fy = Math.floor(location.y);
                    const fz = Math.floor(location.z);
                    
                    // Check if TNT is in a protected land
                    const landInside = LandManager.checkPointInLand(fx, fy, fz);
                    if (landInside) {
                        entity.kill();
                        continue;
                    }
                    
                    // Check if TNT explosion would reach any protected land (radius 5 blocks)
                    const landReach = Protection.checkExplosionDamage(location.x, location.y, location.z, 5);
                    if (landReach) {
                        entity.kill();
                    }
                } catch (e) {}
            }
            
            // Check Creeper entities (including those that may explode and reach protected lands)
            for (const entity of dimension.getEntities({ type: 'minecraft:creeper' })) {
                try {
                    const location = entity.location;
                    const fx = Math.floor(location.x);
                    const fy = Math.floor(location.y);
                    const fz = Math.floor(location.z);
                    
                    // Check if Creeper is in a protected land
                    const landInside = LandManager.checkPointInLand(fx, fy, fz);
                    if (landInside) {
                        entity.kill();
                        continue;
                    }
                    
                    // Check if Creeper explosion would reach any protected land (radius 6 blocks)
                    const landReach = Protection.checkExplosionDamage(location.x, location.y, location.z, 6);
                    if (landReach) {
                        entity.kill();
                    }
                } catch (e) {}
            }
            
            // Check End Crystal entities
            for (const entity of dimension.getEntities({ type: 'minecraft:end_crystal' })) {
                try {
                    const location = entity.location;
                    const fx = Math.floor(location.x);
                    const fy = Math.floor(location.y);
                    const fz = Math.floor(location.z);
                    
                    // Check if End Crystal is in a protected land or explosion would reach
                    const landInside = LandManager.checkPointInLand(fx, fy, fz);
                    const landReach = Protection.checkExplosionDamage(location.x, location.y, location.z, 6);
                    
                    if (landInside || landReach) {
                        entity.kill();
                    }
                } catch (e) {}
            }
        } catch (e) {}
    }
}, 2); // Check every tick