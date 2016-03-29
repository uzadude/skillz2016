#!/usr/bin/env bash

cd ~/git/skillz2016/starter_kit

#./run2.sh ~/git/skillz/code/bestbot.py bots/demoBot1.py maps/bottle.map
#./run2.sh ~/git/skillz/code/bestbot.py bots/demoBot1.py maps/bottle.map > /tmp/skillz_blah


#./run2.sh ~/git/skillz/code/bestbot.py bots/python/evil_bot.py maps/dont_crash.map

FIRST_BOT=~/git/skillz2016/skillz/code/bestbot.py
SECOND_BOT=bots/python/evil_bot.py
MAP=maps/neat_simple_map.map

echo $1

current_time=$(date "+%Y.%m.%d-%H.%M.%S")
html_filename="game.replay".$current_time"_"$1".html"

#./run2.sh ~/git/skillz/code/bestbot.py bots/python/evil_bot.py maps/dont_crash.map > /tmp/skillz_blah
python "./lib/playgame.py" -e -E -d --nolaunch --turns 100 --loadtime 10000 --turntime 1000 --html $html_filename --log_dir lib/game_logs --map_file $MAP $FIRST_BOT $SECOND_BOT > /tmp/skillz_blah

cat /tmp/skillz_blah | grep -v "^Debug>> WARNING" | grep -v "^turn #" | grep -v "^turn   " | tail -3  > /tmp/skillz_blah_end
#cat /tmp/skillz_blah_end

