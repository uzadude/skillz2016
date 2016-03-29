''' Demo4 '''

def do_turn(game):
    
    pirates = game.my_sober_pirates()
    treasures = game.treasures() 
    
    do_collect(game, pirates, treasures)


def do_collect(game, pirates, treasures):
  
    remained_actions = game.actions_per_turn
    
    for pirate in game.my_pirates_with_treasures():
        if remained_actions == 0: return

        #destinations = game.get_directions(pirate, pirate.initial_loc)
        destinations = game.get_sail_options(pirate, pirate.initial_loc, 1)
        game.set_sail(pirate, destinations[0])
        remained_actions -= 1 #only one step is allowed when carrying treasure

    for pirate in game.my_pirates_without_treasures():
        if remained_actions == 0: return
        if not treasures: return

        distances = [game.distance(pirate, treasure) for treasure in treasures]
        val, idx = min((val, idx) for (idx, val) in enumerate(distances))

        destinations = game.get_sail_options(pirate, treasures[idx], remained_actions)
        actions = min(remained_actions, game.distance(pirate, destinations[0]))
        #actions = min(remained_actions, len(destinations))

        game.set_sail(pirate, destinations[0])
        remained_actions -= actions
