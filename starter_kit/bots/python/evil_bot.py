def do_turn(game):
    if len(game.my_pirates()) == 0:
        return

    pirate = game.my_pirates()[0]

    if pirate.turns_to_sober > 0:
        return

    pirate, treasure = get_board_status(game)
    locations = assign_targets(game, pirate, treasure)
    take_action(game, pirate, locations)


def get_board_status(game):
    if len(game.my_pirates()) > 0:
        pirate = game.my_pirates()[0]
    # game.debug("pirate: " + str(pirate.id))
    else:
        pirate = None

    if len(game.treasures()) > 0:
        treasure = game.treasures()[0]
    # game.debug("treasure: " + str(treasure.id))
    else:
        treasure = None

    return pirate, treasure


def assign_targets(game, pirate, treasure):
    if not pirate.has_treasure and treasure:
        moves = game.get_actions_per_turn()
        locations = game.get_sail_options(pirate, treasure.location, moves)
    elif pirate.has_treasure:
        moves = 1
        locations = game.get_sail_options(pirate, pirate.initial_loc, moves)
    elif len(game.enemy_pirates())>0:
        moves = 6
        locations = game.get_sail_options(pirate, game.enemy_pirates()[0].location, moves)
    else:
        locations = None
    return locations


def take_action(game, pirate, locations):
    if try_attack(game, pirate):
        return
    if pirate and len(locations) > 0:
        game.set_sail(pirate, locations[0])


def try_attack(game, pirate):
    if pirate.reload_turns > 0:
        return False

    for enemy in game.enemy_pirates():
        if game.in_range(pirate, enemy) and not pirate.has_treasure:
            game.attack(pirate, enemy)
            return True
    return False
