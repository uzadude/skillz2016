''' Demo1 '''

def do_turn(game):
    pirate = game.my_pirates()[0]
    treasure = find_closest_treasure(game, pirate)
    do_collect(game, pirate, treasure)

def find_closest_treasure(game, pirate):
    distances = [game.distance(pirate, treasure) for treasure in game.treasures()]
    val, idx = min((val, idx) for (idx, val) in enumerate(distances))
    return game.treasures()[idx]

def do_collect(game, pirate, treasure):
    if pirate.treasure_value == 0:
        destinations = game.get_sail_options(pirate, treasure.location, game.actions_per_turn)
    else:
        destinations = game.get_sail_options(pirate, pirate.initial_loc, 1)
    game.set_sail(pirate, destinations[0])

