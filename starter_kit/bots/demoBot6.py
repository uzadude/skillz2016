''' Demo6 '''

def do_turn(game):

    #if game.turn == 10: raise Exception('Stop')
    pirates = game.my_sober_pirates()
    treasures = game.treasures()
    enemies = game.enemy_pirates_with_treasures()

    attacked, actions = do_attack(game, pirates, enemies)
    do_collect(game, pirates, treasures, attacked, actions)


def do_collect(game, pirates, treasures, attacked, actions):
  
    remained_actions = game.actions_per_turn - actions
    
    for pirate in game.my_pirates_with_treasures():
        if remained_actions == 0: return

        destinations = game.get_sail_options(pirate, pirate.initial_loc, 1)
        game.set_sail(pirate, destinations[0])
        remained_actions -= 1 #only one step is allowed when carrying treasure

    if not treasures: return

    for i, pirate in enumerate(pirates):
        if remained_actions == 0: return
        if attacked[i]: continue
        if pirate.treasure_value > 0: continue

        distances = [game.distance(pirate, treasure) for treasure in treasures]
        val, idx = min((val, idx) for (idx, val) in enumerate(distances))

        destinations = game.get_sail_options(pirate, treasures[idx], remained_actions)
        actions = min(remained_actions, game.distance(pirate, destinations[0]))

        game.set_sail(pirate, destinations[0])
        remained_actions -= actions


def do_attack(game, pirates, enemies):

    actions = 0
    attacked = []
    for pirate in pirates:
        attacked.append(False)
        if pirate.treasure_value > 0: continue

        for enemy in enemies:
            if game.in_range(pirate, enemy):
                if pirate.reload_turns > 0: continue
                game.attack(pirate, enemy)
                attacked[-1] = True
            else:
                destinations = game.get_sail_options(pirate, enemy, game.actions_per_turn - actions)
                game.set_sail(pirate, destinations[0])
                actions += min(game.actions_per_turn - actions, game.distance(pirate, destinations[0]))
            break

    return attacked, actions

