import pickle
import numpy as np

with open('/tmp/skillz_network.pickle', 'rb') as handle:
    n = pickle.load(handle)

N = 1


def do_turn(game):

    game.debug("TURN: " + str(game.get_turn()))

    if len(game.my_pirates())==0:
        return

    mypirate = game.my_pirates()[0]

    if mypirate.turns_to_sober>0:
       return


    mat = np.array([0] * (33 * 33 + 2), dtype=float)
    #game.debug([p.location for p in game.enemy_pirates()])
    for p in game.enemy_pirates():
        mat[ p.location[0]*33+p.location[1] ] = -1

    for p in game.treasures():
        if mat[p.location[0]*33+p.location[1]] == -1:
            mat[p.location[0]*33+p.location[1]] = 3
        else:
            mat[p.location[0]*33+p.location[1]] = 1

    if mypirate.has_treasure:
        mat[-1] = 1

    for enemy in game.enemy_pirates():
        if game.in_range(mypirate, enemy):
            mat[-2] = 1


    outputs = n.feed(mat)[-4:]
    #for i in range(0,4):
    #    game.debug(outputs[i])
    #game.debug(outputs)

    mx = outputs.argmax(axis=0)


    if mx == 0: # try to attack
        try_attack(game, mypirate)
    elif mx == 1: # go to treasure
        opts=[]
        if len(game.treasures())>0:
            opts = game.get_sail_options(mypirate, game.treasures()[0], getSteps(mypirate, outputs, mx))

        if len(opts)>0:
            game.set_sail(mypirate, opts[0])
    elif mx == 2: # go to enemy
        opts=[]
        if len(game.enemy_pirates())>0:
            opts = game.get_sail_options(mypirate, game.enemy_pirates()[0], getSteps(mypirate, outputs, mx))

        if len(opts)>0:
            game.set_sail(mypirate, opts[0])
    elif mx == 3: # go home
        opts = game.get_sail_options(mypirate, mypirate.initial_loc, getSteps(mypirate, outputs, mx))
        game.set_sail(mypirate, opts[0])

def getSteps(mypirate, outputs, mx):
    if mypirate.has_treasure:
        steps = 1
    else:
        steps = int(outputs[mx]*6)
    return steps


def try_attack(game, pirate):

    if pirate.has_treasure:
        return False

    if pirate.reload_turns>0:
        return False

    for enemy in game.enemy_pirates():
        if game.in_range(pirate, enemy):
            game.attack(pirate, enemy)
            game.debug("ATTACHKED !!!!!: ")
        return True
    return False