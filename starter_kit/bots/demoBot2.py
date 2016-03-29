''' Demo2 '''

def do_turn(game):
    pirate = next_pirate(game)
    treasure = next_treasure(game)
    do_collect(game, pirate, treasure)
    if pirate.treasure_value == 0:
        do_attack(game, pirate)


def next_pirate(game):
    return game.my_pirates()[0]


def next_treasure(game):
    return game.treasures()[0]


def do_collect(game, pirate, treasure):
    if pirate.treasure_value == 0:
        destinations = game.get_sail_options(pirate, treasure.location, game.actions_per_turn)
    else:
        destinations = game.get_sail_options(pirate, pirate.initial_loc, 1)
    game.set_sail(pirate, destinations[0])


def do_attack(game, pirate):
    for enemy in game.enemy_pirates():
        if game.in_range(pirate, enemy):
            game.attack(pirate, enemy)
            return