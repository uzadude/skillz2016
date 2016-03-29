''' Demo5 '''

def do_turn(game):

    if not game.my_sober_pirates(): return
    pirate = game.my_sober_pirates()[0]
    treasures = game.treasures()
    if treasures:
        treasure = treasures[0]
        destinations = game.get_sail_options(pirate, treasure, 6)
        game.set_sail(pirate, destinations[0])
    elif pirate.treasure_value > 0:
        destinations = game.get_sail_options(pirate, pirate.initial_loc, 1)
        game.set_sail(pirate, destinations[0])
