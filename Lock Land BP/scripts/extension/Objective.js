import { world } from '@minecraft/server'


class Objective {
  /**
   * @param {string} objective
   */
  add(objective) {
    let ensure = world.scoreboard.getObjective(objective)
    if (!ensure) {
      world.scoreboard.addObjective(objective)
    }
  }
  /**
   * @param {string} objective
   */
  remove(objective) {
    let ensure = world.scoreboard.getObjective(objective)
    if (ensure) {
      world.removeObjective(objective)
    }
  }
}

export default new Objective()