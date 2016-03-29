#!/bin/sh

MAP=$3
if [ -z "$3" ]; then
    MAP="./maps/default_map.map"
fi

if [ $# -lt 2 ]; then
    echo "Usage: $0 <bot1> <bot2> [map]"
    exit 1
fi

#python "./lib/playgame.py" -e -E -d --debug_in_replay --loadtime 10000 --turntime 1000 --nolaunch --log_dir lib/game_logs --map_file $MAP $1  $2
python "./lib/playgame.py" -e -E -d --debug_in_replay --turns 100 --loadtime 10000 --turntime 1000 --log_dir lib/game_logs --map_file $MAP $1  $2
