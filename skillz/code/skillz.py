#!/usr/bin/env python

### IMPORTS ###
import os
import sys
import numpy as np
import pickle

#sys.path.append(os.path.join(os.path.split(__file__)[0],'..','..'))
sys.path.append('/Users/oraviv/git/skillz2016/peas')

from peas.methods.neat import NEATPopulation, NEATGenotype
from peas.networks import NeuralNetwork

# from peas.methods.neatpythonwrapper import NEATPythonPopulation
from peas.tasks.polebalance import PoleBalanceTask

# Create a factory for genotypes (i.e. a function that returns a new
# instance each time it is called)

genotype = lambda: NEATGenotype(inputs=33*33 + 2,
                                outputs=4,
                                weight_range=(-5., 5.),
                                types=['sigmoid'])

# Create a population
pop = NEATPopulation(genotype, popsize=10)
    
# Create a task

class SkillzTask(object):

    N = 0

    def evaluate(self, network, verbose=False):
        """ Perform a single run of this task """
        # Convert to a network if it is not.

        self.N = self.N + 1

        if not isinstance(network, NeuralNetwork):
            network = NeuralNetwork(network)


        network.make_feedforward()

        #print network.feed(np.array([2,3], dtype=float))

        #for pair in check:
        #    err = err + abs(pair[0]*pair[1]-100*(network.feed(np.array(pair, dtype=float))[-1]))
        #print err

        with open('/tmp/skillz_network.pickle', 'wb') as handle:
            pickle.dump(network, handle)

        import subprocess
        #print "-----start-----"
        subprocess.call(["./run.sh " + str(self.N)], shell=True)
        #print "----- end -----"

        f = open('/tmp/skillz_blah_end', "r")
        lines = f.readlines()
        f.close()

        print lines

        score = -(int(lines[1].rstrip().split(" ")[2])-int(lines[1].split(" ")[1]))*1000
        turns = int(lines[0].split(" ")[2][:-1])

        #print "score:", score
        #print "turns:", turns

        final_score = 100.0 - turns + score
        ret = {'fitness': final_score, "N": self.N}

        print ret

        return ret

    def solve(self, network):
        return self.evaluate(network)['fitness'] > 900

skillz = SkillzTask()

# Run the evolution, tell it to use the task as an evaluator
#best = pop.epoch(generations=1, evaluator=skillz, solution=skillz)['champions'][0]

best = pop.epoch(generations=50, evaluator=skillz, solution=skillz)['champions'][0]

print "BEST:", best.stats


