import { world, Entity, system } from '@minecraft/server'

class Score {
    /**
     * 
     * @param {Entity} entity 
     * @param {string} objective 
     * @param {number} amount 
     */
    add(entity, objective, amount) {
        let obj = world.scoreboard.getObjective(objective)
        if (!obj) {
            system.run(() => {
                world.scoreboard.addObjective(objective)
            })
        }
        system.run(() => {
            return world.scoreboard.getObjective(objective).addScore(entity, amount)
        })
    }
    /**
     * 
     * @param {Entity} entity 
     * @param {string} objective 
     * @returns 
     */
    get(entity, objective) {
        let obj = world.scoreboard.getObjective(objective)
        if (!obj) {
            system.run(() => {
                world.scoreboard.addObjective(objective)
            })
        }
        try {
            let score = obj.getScore(entity)
            return score ?? 0;
        } catch (error) {
            return 0;
        }
    }
    /**
     * @param {Entity} entity
     * @param {string} objective
     * @param {number} amount
     */
    remove(entity, objective, amount) {
        let obj = world.scoreboard.getObjective(objective)
        if (!obj) {
            system.run(() => {
                world.scoreboard.addObjective(objective)
            })
        }
        system.run(() => {
            return world.scoreboard.getObjective(objective).setScore(entity, this.get(entity, objective) - amount)
        })
    }
    /**
     * @param {Entity} entity
     * @param {string} objective
     */
    reset(entity, objective) {
        system.run(() => {
            return world.scoreboard.getObjective(objective).removeParticipant(entity)
        })
    }
    /**
     * @param {Entity} entity
     * @param {string} objective
     * @param {number} amount
     */
    set(entity, objective, amount) {
        let obj = world.scoreboard.getObjective(objective)
        if (!obj) {
            system.run(() => {
                world.scoreboard.addObjective(objective)
            })
        }
        system.run(() => {
            return world.scoreboard.getObjective(objective).setScore(entity, amount)
        })
    }
}

export default new Score();