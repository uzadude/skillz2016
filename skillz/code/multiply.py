#!/usr/bin/env python

### IMPORTS ###
import os
import sys
import numpy as np

from peas.networks import NeuralNetwork

sys.path.append(os.path.join(os.path.split(__file__)[0],'..','..'))
from peas.methods.neat import NEATPopulation, NEATGenotype
# from peas.methods.neatpythonwrapper import NEATPythonPopulation
from peas.tasks.polebalance import PoleBalanceTask

# Create a factory for genotypes (i.e. a function that returns a new 
# instance each time it is called)

genotype = lambda: NEATGenotype(inputs=2,
                                weight_range=(-5., 5.),
                                types=['tanh'])

# Create a population
pop = NEATPopulation(genotype, popsize=50)
    
# Create a task

class SkillzTask(object):

    def evaluate(self, network, verbose=False):
        """ Perform a single run of this task """
        # Convert to a network if it is not.

        if not isinstance(network, NeuralNetwork):
            network = NeuralNetwork(network)

        #network.make_feedforward()

        #print network.feed(np.array([2,3], dtype=float))

        check = [[2,3], [4,5], [3,7], [1,4]]
        err=0

        for pair in check:
            err = err + abs(pair[0]*pair[1]-100*(network.feed(np.array(pair, dtype=float))[-1]))
        #print err

        return {'fitness': 1./(1+err)}

    def solve(self, network):
        return self.evaluate(network)['fitness'] > 0.9

skillz = SkillzTask()

# Run the evolution, tell it to use the task as an evaluator
best = pop.epoch(generations=100, evaluator=skillz, solution=skillz)['champions'][0]
#pop.epoch(generations=10, evaluator=skillz)

print NeuralNetwork(best).feed(np.array([2,3], dtype=float))[-1]*100


