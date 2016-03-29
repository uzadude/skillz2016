''' Demo3 '''

def do_turn(game):
    if not game.my_pirates(): return
    pirate = game.my_pirates()[0]
    treasure = game.treasures()[0]
    do_collect(game, pirate, treasure)
    if not pirate.treasure_value == 0:
        do_attack(game, pirate)

def do_attack(game, pirate):
    for enemy in game.enemy_pirates():
        if game.in_range(pirate, enemy):
            game.attack(pirate, enemy)
            return

def do_collect(game, pirate, treasure):
    if not pirate.treasure_value == 0:
        destinations = game.get_sail_options(pirate, treasure.location, game.actions_per_turn)
    else:
        destinations = game.get_sail_options(pirate, pirate.initial_loc, 1)
    game.set_sail(pirate, destinations[0])


