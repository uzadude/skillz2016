/**
 * @fileOverview Classes for loading replays and maps into the visualizer.
 * @author <a href="mailto:marco.leise@gmx.de">Marco Leise</a>
 */

/**
 * Constructs a new direction from the given coordinates. X points to the right and Y points to the
 * bottom. Up is 0°, Right is 90° and so on.
 * 
 * @class A compass direction
 * @constructor
 * @param {Number}
 *        x
 * @param {Number}
 *        y
 */
function Direction(x, y) {
	this['x'] = x;
	this['y'] = y;
	this.angle = Math.atan2(x, -y);
}
/**
 * Offset for pirates moving north.
 */
Direction.N = new Direction(0, -1);
/**
 * Offset for pirates moving east.
 */
Direction.E = new Direction(+1, 0);
/**
 * Offset for pirates moving south.
 */
Direction.S = new Direction(0, +1);
/**
 * Offset for pirates moving west.
 */
Direction.W = new Direction(-1, 0);
/**
 * Offset for pirates attacking
 */
Direction.A = new Direction(0, 0);
/**
 * Offset for pirates defending
 */
Direction.D = new Direction(0, 0);

Direction.fromChar = function(char) {
    switch (char) {
    case 'n':
    case 'N':
        return Direction.N;
    case 'e':
    case 'E':
        return Direction.E;
    case 's':
    case 'S':
        return Direction.S;
    case 'w':
    case 'W':
        return Direction.W;
    case 'a':
    case 'A':
        return Direction.A;
	case 'd':
    case 'D':
        return Direction.D;
    case '-':
        return null;
    default:
        throw new Error('Invalid character in orders line: ' + char);
    }
}

/**
 * @class Parsing functions and validators for various data types in streaming replays and maps.
 */
DataType = {
	STRING : function(p) {
		return [ p, null ];
	},
	IDENT : function(p) {
		p = p.match(DataType.MATCH);
		return [ p[1], p[2] ];
	},
	UINT : function(p, n) {
		p = p.match(DataType.MATCH);
		p = [ parseInt(p[1]), p[2] ];
		if (isNaN(p[0]) || p[0] < 0) {
			throw new Error('Parameter ' + n + ' must be an unsigned integer.');
		}
		return p;
	},
	POSINT : function(p, n) {
		p = DataType.UINT(p, n);
		if (p[0] <= 0) {
			throw new Error('Parameter ' + n + ' must be a positive integer.');
		}
		return p;
	},
	NUMBER : function(p, n) {
		p = p.match(DataType.MATCH);
		p = [ parseFloat(p[1]), p[2] ];
		if (isNaN(p[0])) {
			throw new Error('Parameter ' + n + ' is not a number.');
		}
		return p;
	},
	ORDERS : function(p) {
		p = p.match(DataType.MATCH);
		p[1] = p[1].split('');
		p[0] = new Array(p[1].length);
		for ( var turn = 0; turn < p[1].length; turn++) {
			if ("nsewad-".indexOf(p[1][turn]) === -1) {
				continue;
			}
            p[0][turn] = Direction.fromChar(p[1][turn])
		}
		return [ p[0], p[2] ];
	},
	SCORES : function(p) {
		p = p.replace(/\s+/g, ' ').replace(/\s*$/, '').split(' ');
		for ( var i = 0; i < p.length; i++) {
			p[i] = parseFloat(p[i]);
			if (isNaN(p[i])) {
				throw new Error('Score ' + i + ' is not a number.');
			}
		}
		return [ p, null ];
	},
	MATCH : /(\S*)\s*(.*)/
};

/**
 * Loads a replay or map in text form. The streaming format is not supported directly, but can by
 * loaded by the Java wrapper. In the visualizer, pirates are unique objects, that are mostly a list of
 * animation key-frames that are interpolated for any given time to produce a "tick-less" animation.<br>
 * <b>Called by the Java streaming visualizer.</b>
 * 
 * @class The replay class loads a replay or map in string form and prepares it for playback. All
 *        per turn data is lazily evaluated to avoid long load times. The Java wrapper has some
 *        extensions to load streaming replays. Make sure changes here don't break it.
 * @constructor
 * @param {String}
 *        replay The replay or map text.
 * @param {Boolean}
 *        debug If true, then partially corrupt replays are loaded instead of throwing an error.
 * @param {String}
 *        highlightUser The user with this ID (usually a database index) in the replay will get the first
 *        color in the player colors array.
 * @see Options#user
 * @see #addMissingMetaData
 * @see Pirate
 */
function Replay(replay, debug, highlightUser) {
	var i, k, player_scores, highlightPlayer, c, n, r, regex;
	var format = 'json';
	var storeslist = undefined;
	/**
	 * @private
	 */
	this.debug = debug || false;
	if (replay === undefined) {
		// This code path is taken by the Java wrapper for streaming replay and initializes only the
		// basics. Most of the rest is faster done in native Java, than through Rhino.
		this.meta = new Object();
		this.meta['challenge'] = 'ants';
		this.meta['replayformat'] = format;
		this.meta['replaydata'] = {
			'map' : {},
			'ants' : [],
			'food' : [],
			'hills' : []
		};
		this.duration = -1;
		this.hasDuration = true;
		this.aniAnts = [];
		this.treasures = [];
		this.powerups = [];
	} else {
		// check for a replay from the pre-JSON era and convert it.
		if (replay.search(/^\s*{/) === -1) {
			replay = this.txtToJson(replay);
		} else {
			replay = JSON.parse(replay);
		}

		this.meta = replay;
		if (typeof this.meta['replaydata'] == 'string') {
			format = 'storage';
			this.meta['replaydata'] = this.txtToJson(this.meta['replaydata']);
		}
		replay = this.meta['replaydata'];

		// validate meta data
		if (this.meta['replayformat'] !== format) {
			throw new Error('Replays in the format "' + this.meta['replayformat']
					+ '" are not supported.');
		}
		if (!replay) {
			throw new Error('replay meta data is no object notation');
		}

		// start validation process
		this.duration = 0;
		var that = this;
		if (replay) {
			// set up helper functions
			var stack = [];
			var keyEq = function(obj, key, val) {
				if (obj[key] !== val && !that.debug) {
					throw new Error(stack.join('.') + '.' + key + ' should be ' + val
							+ ', but was found to be ' + obj[key] + '!');
				}
			};
			var keyRange = function(obj, key, min, max) {
				if (!(obj[key] >= min && (obj[key] <= max || max === undefined)) && !that.debug) {
					throw new Error(stack.join('.') + '.' + key + ' should be within [' + min
							+ ' .. ' + max + '], but was found to be ' + obj[key] + '!');
				}
			};
			var keyIsArr = function(obj, key, minlen, maxlen) {
				if (!(obj[key] instanceof Array)) {
					throw new Error(stack.join('.') + '.' + key
							+ ' should be an array, but was found to be of type ' + typeof obj[key]
							+ '!');
				}
				stack.push(key);
				keyRange(obj[key], 'length', minlen, maxlen);
				stack.pop();
			};
			var keyIsStr = function(obj, key, minlen, maxlen) {
				if (typeof obj[key] !== 'string') {
					throw new Error(stack.join('.') + '.' + key
							+ ' should be a string, but was found to be of type ' + typeof obj[key]
							+ '!');
				}
				stack.push(key);
				keyRange(obj[key], 'length', minlen, maxlen);
				stack.pop();
			};
			var keyOption = function(obj, key, func, params) {
				if (obj[key] !== undefined) {
					func.apply(undefined, [ obj, key ].concat(params));
				}
			};
			var keyDefault = function(obj, key, def, func, params) {
				if (obj[key] === undefined) {
					obj[key] = def;
				}
				func.apply(undefined, [ obj, key ].concat(params));
			};
			var enterObj = function(obj, key) {
				if (!(obj[key] instanceof Object)) {
					throw new Error(stack.join('.') + '.' + key
							+ ' should be an object, but was found to be of type '
							+ typeof obj[key] + '!');
				}
				stack.push(key);
				return obj[key];
			};
			var durationSetter = null;
			var setReplayDuration = function(duration, fixed) {
				if (durationSetter) {
					if (!fixed && that.duration < duration || fixed && that.duration !== duration
							&& !that.debug) {
						throw new Error('Replay duration was previously set to ' + that.duration
								+ ' by "' + durationSetter + '" and is now redefined to be '
								+ duration + ' by "' + obj + '"');
					}
				} else {
					that.duration = Math.max(that.duration, duration);
					if (fixed) durationSetter = obj;
				}
			};

			// options
			enterObj(this.meta, 'replaydata');
			keyRange(replay, 'revision', 2, 3);
			this.revision = replay['revision'];
			keyRange(replay, 'players', 1, 26);
			this.players = replay['players'];
			keyOption(replay, 'viewradius2', keyRange, [ 0, undefined ]);

			// map
			var map = enterObj(replay, 'map');
			keyIsArr(map, 'data', 1, undefined);
			stack.push('data');
			keyIsStr(map['data'], 0, 1, undefined);
			stack.pop();
			keyDefault(map, 'rows', map['data'].length, keyEq, [ map['data'].length ]);
			this.rows = map['rows'];
			keyDefault(map, 'cols', map['data'][0].length, keyEq, [ map['data'][0].length ]);
			this.cols = map['cols'];
			var mapdata = enterObj(map, 'data');
			this.walls = new Array(mapdata.length);
			if (this.revision >= 3) {
				regex = /[^%*.a-zA-Z0-9]/;
			} else {
				regex = /[^%*.a-z]/;
			}
			for (r = 0; r < mapdata.length; r++) {
				keyIsStr(mapdata, r, map['cols'], map['cols']);
				var maprow = new String(mapdata[r]);
				if ((i = maprow.search(regex)) !== -1 && !this.debug) {
					throw new Error('Invalid character "' + maprow.charAt(i)
							+ '" in map. Zero based row/col: ' + r + '/' + i);
				}
				this.walls[r] = new Array(maprow.length);
				for (c = 0; c < maprow.length; c++) {
					this.walls[r][c] = (maprow.charAt(c) === '%');
				}
			}
			stack.pop();
			stack.pop();

            // treasures
            if (this.revision >= 3) {
                keyIsArr(replay, 'treasures', 0, undefined);
                stack.push('treasures');
				var treasures = replay['treasures'];
                /* for (n = 0; n < treasures.length; n++) {
					keyIsArr(treasures, n, 3, 7);
				}
                */
                stack.pop();

            } else {
				replay['treasures'] = [];
			}
			this.treasures = new Array(treasures.length);

            // powerups
            if (this.revision >= 3) {
                keyIsArr(replay, 'powerups', 0, undefined);
                stack.push('powerups');
                var powerups = replay['powerups'];
                stack.pop();
            } else {
                replay['powerups'] = [];
            }
            this.powerups = new Array(powerups.length);
			
			// hills
			if (this.revision >= 3) {
				keyIsArr(replay, 'hills', 0, undefined);
				stack.push('hills');
				var hills = replay['hills'];
				for (n = 0; n < hills.length; n++) {
					keyIsArr(hills, n, 4, 5);
					stack.push(n);
					var obj = hills[n];
					// row must be within map height
					keyRange(obj, 0, 0, map['rows'] - 1);
					// col must be within map width
					keyRange(obj, 1, 0, map['cols'] - 1);
					// player index must match player count
					keyRange(obj, 2, 0, this.players - 1);
					// destruction turn must be >= 0
					keyRange(obj, 3, 0, undefined);
					setReplayDuration(obj[3] - 1, false);
					if (obj.length > 4) {
						// destroying player index must match player count
						keyRange(obj, 4, 0, this.players - 1);
					}
					stack.pop();
				}
				stack.pop();
			} else {
				replay['hills'] = [];
			}

			// pirates
			keyIsArr(replay, 'ants', 0, undefined);
			stack.push('ants');
			var pirates = replay['ants'];
			regex = /[^nsewad-]/;
			for (n = 0; n < pirates.length; n++) {

				keyIsArr(pirates, n, 4, 17);
				stack.push(n);
				var obj = pirates[n];
				// row must be within map height
				keyRange(obj, 0, 0, map['rows'] - 1);
				// col must be within map width
				keyRange(obj, 1, 0, map['cols'] - 1);
				// start must be >= 0
				keyRange(obj, 2, 0, undefined);
				if (this.revision <= 2) {
					// revision 2 has food and ant info in the same object
					if (obj[2] === 0) {
						// conversion must be >= 0
						keyRange(obj, 3, 0, undefined);
					} else {
						// conversion must be > start
						keyRange(obj, 3, obj[2] + 1, undefined);
					}
					k = 4;
				} else {
					k = 3;
				}
				if (this.revision <= 2 && obj.length > 4 || this.revision >= 3) {
					// end turn must be > conversion turn (or start turn for rev. 3 and up)
					keyRange(obj, k, obj[k - 1] + 1, undefined);
					// player index must match player count
					keyRange(obj, k + 1, 0, this.players - 1);
					// moves must be valid
					var lifespan = obj[k] - obj[k - 1];
					keyIsArr(obj, k + 2, lifespan - 1, lifespan);
                                        var durationSetter = null;
					setReplayDuration(obj[k] - 1, obj[k + 2].length !== lifespan);

//                    for (j = 0; j < obj[k+2].length; j++) {
//                        if ((i = obj[k + 2][j].search(regex)) !== -1 && !this.debug) {
//                            throw new Error('Invalid character "' + obj[k + 2][j].charAt(i)
//                                    + '" in move orders at index ' + i + ' in the string "'
//                                    + obj[k + 2][j] + '"');
//                        }
//                    }
				} else {
					setReplayDuration(obj[3] - 1, false);
				}
				stack.pop();
			}
			stack.pop();
            
            // zones
            if (replay.hasOwnProperty('zones')) {
                keyIsArr(replay, 'zones', 0, undefined);
                stack.push('zones');
                var zones = replay['zones'];
                for (n = 0; n < zones.length; n++) {
                    keyIsArr(zones, n, 0, undefined);
                }
                stack.pop();
            } else {
                replay['zones'] = [];
            }
            
            // rejected
            if (!replay.hasOwnProperty('rejected')) {
                replay['rejected'] = [];
            } 

			// scores
			keyIsArr(replay, 'scores', this.players, this.players);
			stack.push('scores');
			var scoreslist = replay['scores'];
			for (i = 0; i < this.players; i++) {
				setReplayDuration(scoreslist[i].length - 1, false);
			}
			stack.pop();
			if (replay['bonus']) {
				keyIsArr(replay, 'bonus', this.players, this.players);
			}
			if (this.revision >= 3) {
				keyIsArr(replay, 'hive_history', this.players, this.players);
				stack.push('hive_history');
				storeslist = replay['hive_history'];
				for (i = 0; i < this.players; i++) {
					setReplayDuration(storeslist[i].length - 1, false);
				}
				stack.pop();
			}

			// prepare score and count lists
			this.turns = new Array(this.duration + 1);
			this['scores'] = new Array(this.duration + 1);
			this['counts'] = new Array(this.duration + 1);
			this['stores'] = new Array(this.duration + 1);
			this.fogs = new Array(this.players);
			for (n = 0; n <= this.duration; n++) {
				this['scores'][n] = new Array(this.players);
				this['counts'][n] = new Array(this.players);
				this['stores'][n] = new Array(this.players);
				for (i = 0; i < this.players; i++)
					this['counts'][n][i] = 0;
			}
			for (i = 0; i < this.players; i++) {
				// convert scores from per-player to per-turn
				player_scores = scoreslist[i];
				for (k = 0; k < player_scores.length; k++) {
					this['scores'][k][i] = player_scores[k];
				}
				for (; k <= this.duration; k++) {
					this['scores'][k][i] = player_scores[player_scores.length - 1];
				}
				// convert stores from per-player to per-turn
				if (this.revision >= 3) {
					player_stores = storeslist[i];
					for (k = 0; k < player_stores.length; k++) {
						this['stores'][k][i] = player_stores[k];
					}
					for (; k <= this.duration; k++) {
						this['stores'][k][i] = player_stores[player_stores.length - 1];
					}
				} else {
					for (k = 0; k <= this.duration; k++) {
						this['stores'][k][i] = 0;
					}
				}
				this.fogs[i] = new Array(this.duration + 1);
			}
			// account pirates their owners
			if (this.revision >= 3) {
				for (i = 0; i < pirates.length; i++) {
					for (n = pirates[i][2]; n < pirates[i][3]; n++) {
						this['counts'][n][pirates[i][4]]++;
					}
				}
			} else {
				for (i = 0; i < pirates.length; i++) {
					if (pirates[i][5] !== undefined) {
						// account ant to the owner
						for (n = pirates[i][3]; n < pirates[i][4]; n++) {
							this['counts'][n][pirates[i][5]]++;
						}
					}
				}
			}
			this.aniAnts = new Array(pirates.length);
		}
		this.hasDuration = this.duration > 0 || this.meta['replaydata']['turns'] > 0;
            
		// add missing meta data
		highlightPlayer = undefined;
		if (this.meta['user_ids']) {
			highlightPlayer = this.meta['user_ids'].indexOf(highlightUser, 0);
			if (highlightPlayer === -1) highlightPlayer = undefined;
		}
		this.addMissingMetaData(highlightPlayer);
	}
}

/**
 * Adds optional meta data to the replay as required. This includes default player names and colors.
 * 
 * @private
 * @param {Number}
 *        highlightPlayer The index of a player who's default color should be exchanged with the first
 *        player's color. This is useful to identify a selected player by its color (the first one
 *        in the PĹAYER_COLORS array).
 */
Replay.prototype.addMissingMetaData = function(highlightPlayer) {
	var i;
	if (!(this.meta['playernames'] instanceof Array)) {
		if (this.meta['players'] instanceof Array) {
			// move players to playernames in old replays
			this.meta['playernames'] = this.meta['players'];
			delete this.meta['players'];
		} else {
			this.meta['playernames'] = new Array(this.players);
		}
	}
	if (!(this.meta['playercolors'] instanceof Array)) {
		this.meta['playercolors'] = new Array(this.players);
	}
	if (!(this.meta['playerturns'] instanceof Array)) {
		this.meta['playerturns'] = new Array(this.players);
	}
	// setup player colors
	var rank;
    var rank_sorted;
	if (this.meta['challenge_rank']) {
        rank = this.meta['challenge_rank'].slice();
	}
	if (highlightPlayer !== undefined) {
		var COLOR_MAP = COLOR_MAPS[this.players-1];
        rank.splice(highlightPlayer, 1);
	} else {
		var COLOR_MAP = COLOR_MAPS[this.players];
	}
    if (rank) {
        rank_sorted = rank.slice().sort(function (a, b) { return a - b; });
    }
    var adjust = 0;
	for (i = 0; i < this.players; i++) {
		if (!this.meta['playernames'][i]) {
			this.meta['playernames'][i] = 'player ' + (i + 1);
		}
		if (this.meta['replaydata']['scores'] && !this.meta['playerturns'][i]) {
			this.meta['playerturns'][i] = this.meta['replaydata']['scores'][i].length - 1;
		}
		if (!(this.meta['playercolors'][i] instanceof Array)) {
            var color;
            if (highlightPlayer !== undefined && i === highlightPlayer) {
                color = PLAYER_COLORS[COLOR_MAPS[0]];
                adjust = 1;
            } else {
                if (rank) {
                    var rank_i = rank_sorted.indexOf(rank[i - adjust]);
                    color = PLAYER_COLORS[COLOR_MAP[rank_i]];
                    rank_sorted[rank_i] = null;
                    
                } else {
                    color = PLAYER_COLORS[COLOR_MAP[i]];
                }
            }
            this.meta['playercolors'][i] = color = hsl_to_rgb(color);;
		}
	}
};

/**
 * Converts a line old based replay file or a map into a JavaScript object. This method is used to
 * prepare the data for further parsing. The old formats are first converted to the new format.
 * 
 * @private
 * @param {String}
 *        replay The map or ancient replay file.
 * @returns {Object} The map or replay in a JavaScript object notation.
 */
Replay.prototype.txtToJson = function(replay) {
	var i, c, lit, tl, args, rows, cols, owner, row, col, isAnt, conv, end;
	var orders, fixed, scores, result, isReplay;
	lit = new LineIterator(replay);
	result = {
		'revision' : 3,
		'map' : {
			'data' : []
		},
		'hills' : [],
		'ants' : [],
		'food' : [],
		'scores' : [],
		'hive_history' : []
	};
	this.turns = [];
	tl = lit.gimmeNext();
	try {
		// version check
		isReplay = tl.keyword === 'v';
		if (isReplay) {
			tl.kw('v').as([ DataType.IDENT, DataType.POSINT ]);
			tl.expectEq(0, 'ants'); // game name
			tl.expectEq(1, 1); // file version
			// players
			tl = lit.gimmeNext();
			tl.kw('players').as([ DataType.POSINT ]);
			tl.expectLE(0, 26); // player count <= 26
			result['players'] = tl.params[0];
			// parameters
			tl = lit.gimmeNext();
		}
		while (tl.keyword !== 'm') {
			args = [ DataType.STRING ];
			if (tl.keyword === 'viewradius2' || tl.keyword === 'rows' || tl.keyword === 'cols'
					|| tl.keyword === 'players' || tl.keyword === 'turns') {
				args[0] = DataType.UINT;
			}
			tl.as(args);
			if (tl.keyword === 'rows' || tl.keyword === 'cols') {
				result['map'][tl.keyword] = tl.params[0];
			} else {
				result[tl.keyword] = tl.params[0];
			}
			tl = lit.gimmeNext();
		}
		// map
		cols = undefined;
		rows = 0;
		do {
			tl.as([ DataType.STRING ]);
			if (cols === undefined) {
				cols = tl.params[0].length;
			} else if (tl.params[0].length !== cols && !this.debug) {
				throw new Error('Map lines have different lenghts');
			}
			result['map']['data'].push(tl.params[0]);
			if (!isReplay) {
				// in a map file we want to extract starting positions
				for (col = 0; col < cols; col++) {
					c = tl.params[0].charAt(col);
					if (c >= 'a' && c <= 'z') {
						c = c.charCodeAt(0) - 97;
						result['ants'].push([ rows, col, 0, 1, c, '-' ]);
					} else if (c >= 'A' && c <= 'Z') {
						c = c.charCodeAt(0) - 65;
						result['ants'].push([ rows, col, 0, 1, c, '-' ]);
						result['hills'].push([ rows, col, c, 1 ]);
					} else if (c >= '0' && c <= '9') {
						c = c.charCodeAt(0) - 48;
						result['hills'].push([ rows, col, c, 1 ]);
					} else if (c === '*') {
						result['food'].push([ rows, col, 0 ]);
					}
				}
			}
			rows++;
			if (isReplay || lit.moar()) {
				tl = lit.gimmeNext();
			} else {
				break;
			}
		} while (tl.keyword === 'm');
		// food / ant
		if (isReplay) {
			while (tl.keyword === 'a') {
				// row col start conversion
				tl.as([ DataType.UINT, DataType.UINT, DataType.UINT, DataType.UINT, DataType.UINT,
						DataType.UINT, DataType.STRING ], 3);
				// end owner orders # optional
				row = tl.params[0];
				if (row >= this.rows) throw new Error('Row exceeds map width.');
				col = tl.params[1];
				if (col >= this.cols) throw new Error('Col exceeds map height.');
				conv = tl.params[3];
				end = tl.params[4];
				if (end === undefined) end = conv;
				owner = tl.params[5];
				isAnt = owner !== undefined;
				if (isAnt && owner >= this.players) {
					throw new Error('Player index out of range.');
				}
				if (tl.params.length === 6) {
					tl.params.push('');
				}
				orders = tl.params[6];
				if (isAnt) {
					fixed = orders.length !== end - conv;
					if (fixed && orders.length + 1 !== end - conv) {
						throw new Error('Number of orders does not match life span.');
					}
				}
				result['ants'].push(tl.params);
				tl = lit.gimmeNext();
			}
			// score
			var players = this.players || result['players'];
			for (i = 0; i < players; i++) {
				scores = tl.kw('s').as([ DataType.SCORES ]).params[0];
				result['scores'].push(scores);
				if (i != players - 1) tl = lit.gimmeNext();
			}
		} else {
			for (i = 0; i < result['players']; i++) {
				result['scores'].push([ 0 ]);
				result['hive_history'].push([ 0 ]);
			}
		}
		if (lit.moar()) {
			tl = lit.gimmeNext();
			throw new Error('Extra data at end of file.');
		}
	} catch (error) {
		error.message = tl.line + '\n' + error.message;
		throw error;
	}
	return result;
};

/**
 * Computes a list of visible pirates for a given turn. This list is then used to render the
 * visualization.
 * <ul>
 * <li>The turns are computed on reqest.</li>
 * <li>The result is cached.</li>
 * <li>Turns are calculated iteratively so there is no quick random access to turn 1000.</li>
 * </ul>
 * 
 * @param {Number}
 *        n The requested turn.
 * @returns {Pirate[]} The array of visible pirates.
 */
Replay.prototype.getTurn = function(n) {
	var i, idx, turn, pirates, pirate, aniAnt, lastFrame, dead, food, moves, activation;
	if (this.turns[n] === undefined) {
		if (n !== 0) this.getTurn(n - 1);
		turn = this.turns[n] = [];
		// generate pirates & keyframes
		pirates = this.meta['replaydata']['ants'];
		treasures = this.meta['replaydata']['treasures'];
		powerups = this.meta['replaydata']['powerups'];
		for (i = 0; i < pirates.length; i++) {
			pirate = pirates[i];
			// TODO the last argument is the ID
			if (pirate[2] === n + 1 || n === 0 && pirate[2] === 0) {
				// spawn this pirate
				if (this.revision >= 3) {
					aniAnt = this.spawnPirate(i, pirate[0], pirate[1], pirate[2], pirate[4], pirate[5], pirate[7], pirate[8], pirate[9], pirate[10], pirate[11], pirate[12], pirate[13], pirate[14], pirate[15], pirate[16]);
				} else {
					aniAnt = this.spawnFood(i, pirate[0], pirate[1], pirate[2], pirate[5]);
				}
			} else if (this.aniAnts[i]) {
				// load existing state
				aniAnt = this.aniAnts[i];
			} else {
				// continue with next pirate
				continue;
			}
			if (this.revision >= 3) {
				moves = pirate[5];
				activation = pirate[2];
			} else {
				if (pirate[5] !== undefined && (pirate[3] === n + 1 || n === 0 && pirate[3] === 0)) {
					// fade to player color
					this.convertAnt(aniAnt, pirate[3] == pirate[2], pirate[3], pirate[5]);
				}
				moves = pirate[6];
				activation = pirate[3];
			}
			if (moves !== undefined && n >= activation && n < activation + moves.length) {
				if (this.revision <= 2) {
					aniAnt.frameAt(n)['owner'] = pirate[5];
				}
                
                //actions holds all the moves of the current pirate
				var actions = moves[n - activation];
                //for the orientation choose the last character if it is not 0,0 or else just use the last frame
                for (var j = 0; j < actions.length; j++) {
					if ("nsewad-".indexOf(actions[j]) === -1) {
						continue;
					}
                    var dir = Direction.fromChar(actions[j]); //the current action
                    if (dir) {
                        lastFrame = aniAnt.keyFrames[aniAnt.keyFrames.length - 1];
                        lastFrame['orientation'] = (dir['x'] != 0 || dir['y'] != 0) ? actions[j] : lastFrame['orientation'];
                        
                        // Here we calculate the movement that should be presented for the current action only
                        aniAnt.fade('x', lastFrame['x'] + dir.x, n + j/actions.length, n + (j+1)/actions.length);
                        aniAnt.fade('y', lastFrame['y'] + dir.y, n + j/actions.length, n + (j+1)/actions.length);
                        // if (move == Direction.C || move == Direction.D) {
                            //this creates the effect of always switching between 0 to 1 and back
                            // aniAnt.fade('cloaked', lastFrame['cloaked'] == 1 ? 0.4 : 1, n, n + 1);
                        // }
                    }
                }
			}
            
			if (this.revision >= 3) {
				dead = (pirate[3] || activation);
			} else {
				dead = (pirate[4] || activation);
			}
			if (dead === n + 1) {
				// end of life
				this.killAnt(aniAnt, dead);
			}
			if (n < dead) {
				// assign ant to display list
				turn.push(aniAnt);
			}
		}
	}
	return this.turns[n];
};

/**
 * Spawns a new food item that may eventually be turned into an ant at any time.<br>
 * <b>Called by the Java streaming visualizer.</b>
 * 
 * @param {Number}
 *        id Global ant id, an auto-incrementing number for each new ant. See {@link Config#label}
 * @param {Number}
 *        row Map row to spawn the ant on.
 * @param {Number}
 *        col Map column to spawn the ant on.
 * @param {Number}
 *        spawn Turn to spawn the ant at.
 * @param {Number}
 *        owner the owning player index
 * @returns {Pirate} The new animation ant object.
 */
Replay.prototype.spawnFood = function(id, row, col, spawn, owner) {
	var aniAnt = this.aniAnts[id] = new Pirate(id, spawn - 0.25);
	var f = aniAnt.frameAt(spawn - 0.25);
	aniAnt.owner = owner;
	f['x'] = col;
	f['y'] = row;
	f['r'] = FOOD_COLOR[0];
	f['g'] = FOOD_COLOR[1];
	f['b'] = FOOD_COLOR[2];
	if (spawn !== 0) {
		f = aniAnt.frameAt(spawn);
		f['size'] = 1.0;
		f = aniAnt.frameAt(spawn + 0.125);
		f['size'] = 1.5;
		f = aniAnt.frameAt(spawn + 0.25);
		f['size'] = 0.7;
		f = aniAnt.frameAt(spawn + 0.5);
	}
	f['size'] = 1;
	return aniAnt;
};

/**
 * Spawns a new ant.
 * 
 * @param {Number}
 *        id Global ant id, an auto-incrementing number for each new ant. See {@link Config#label}
 * @param {Number}
 *        row Map row to spawn the ant on.
 * @param {Number}
 *        col Map column to spawn the ant on.
 * @param {Number}
 *        spawn Turn to spawn the ant at.
 * @param {Number}
 *        owner the owning player index
 * @returns {Pirate} The new animation ant object.
 */

Replay.prototype.spawnPirate = function(id, row, col, spawn, owner, moves, gameId, reasonOfDeath, treasureHistory, attackHistory, defenseHistory, drinkHistory, attackRadiusHistory, robPowerupHistory, movePowerupHistory, speedPowerupHistory) {
	var aniAnt = this.aniAnts[id] = new Pirate(id, gameId, spawn - 0.25, reasonOfDeath, treasureHistory, attackHistory, defenseHistory, drinkHistory, attackRadiusHistory, robPowerupHistory, movePowerupHistory, speedPowerupHistory);
	var color = this.meta['playercolors'][owner];
	var f = aniAnt.frameAt(spawn - 0.25);
	aniAnt.owner = owner;
	f['x'] = col;
	f['y'] = row;
	f['owner'] = owner;
	f['r'] = color[0];
	f['g'] = color[1];
	f['b'] = color[2];
	if (spawn !== 0) {
		f = aniAnt.frameAt(spawn);
		f['size'] = 1.0;
		f = aniAnt.frameAt(spawn + 0.125);
		f['size'] = 1.5;
		f = aniAnt.frameAt(spawn + 0.25);
		f['size'] = 0.7;
		f = aniAnt.frameAt(spawn + 0.5);
	}
	var orientation = 'w'; // TODO: change this to random choose if we don't know
	if (moves.length > 0 ) {

			if ((moves[0] !== '-') && (moves[0] !== 'k') && (moves[0] !== 'c') && (moves[0][0] !== 'a') && (moves[0] !== 'd')) {
				orientation = moves[0];
			}
	}
	f['orientation'] = orientation;
	f['size'] = 1;
	f['pirateGameId'] = gameId;
	f['reasonOfDeath'] = reasonOfDeath;
	return aniAnt;
};

/**
 * Animates food conversion to a player ant.<br>
 * <b>Called by the Java streaming visualizer.</b>
 * 
 * @private
 * @param {Pirate}
 *        aniAnt The ant to be worked on.
 * @param {Boolean}
 *        instantly This is set to true for the initial player pirates and leaves out one animation
 *        step that will have no effect in this case.
 * @param {Number}
 *        turn The zero-based turn, that the ant was converted in.
 * @param {Number}
 *        owner The player index of the new owner.
 */
Replay.prototype.convertAnt = function(aniAnt, instantly, turn, owner) {
	var color = this.meta['playercolors'][owner];
	if (!instantly) {
		aniAnt.fade('r', 255, turn - 0.5, turn - 0.25);
		aniAnt.fade('g', 255, turn - 0.5, turn - 0.25);
		aniAnt.fade('b', 255, turn - 0.5, turn - 0.25);
	}
	aniAnt.frameAt(turn - 0.25)['owner'] = owner;
	aniAnt.fade('r', color[0], turn - 0.25, turn);
	aniAnt.fade('g', color[1], turn - 0.25, turn);
	aniAnt.fade('b', color[2], turn - 0.25, turn);
};

/**
 * Animates an ant's death.<br>
 * <b>Called by the Java streaming visualizer.</b>
 * 
 * @private
 * @param {Pirate}
 *        aniAnt The ant to be worked on.
 * @param {Number}
 *        death The zero-based turn, that the ant died in.
 */
Replay.prototype.killAnt = function(aniAnt, death) {
	var color;
	var owner = aniAnt.frameAt(death)['owner'];
	if (owner === undefined) {
		color = FOOD_COLOR;
	} else {
		color = this.meta['playercolors'][owner];
	}
	aniAnt.fade('r', 255, death - 0.80, death - 0.60);
	aniAnt.fade('g', 255, death - 0.80, death - 0.60);
	aniAnt.fade('b', 255, death - 0.80, death - 0.60);
	aniAnt.fade('r', color[0], death - 0.60, death - 0.40);
	aniAnt.fade('g', color[1], death - 0.60, death - 0.40);
	aniAnt.fade('b', color[2], death - 0.60, death - 0.40);
	aniAnt.fade('r', 0.0, death - 0.40, death);
	aniAnt.fade('g', 0.0, death - 0.40, death);
	aniAnt.fade('b', 0.0, death - 0.40, death);
	if (aniAnt.reasonOfDeath == '' || aniAnt.reasonOfDeath === undefined) {
		aniAnt.fade('size', 0.7, death - 0.80, death - 0.60);
		aniAnt.fade('size', 0.0, death - 0.40, death);
	} else if (aniAnt.reasonOfDeath == 'k') {
		// the size for kraken killed pirates isnt really used. interpolated by size instead. the change in size is used to find the death turn
		aniAnt.fade('size', 0.95, death - 1.00, death - 0.50);
		aniAnt.fade('size', 0.0, death - 0.50, death);
	}
	aniAnt.death = death;
};

/**
 * Fetches a 2D-matrix (of map size) of boolean values in row/col structure, representing what is
 * covered by fog-of-war for a player. For an eleminated player this will be an all-true matrix.<br>
 * <ul>
 * <li>Once computed, the map will be cached.</li>
 * <li>Unlike the turn data, fog of war is not computed iteratively. So it does not depend on the
 * previous turn's fog data, but also doesn't use the optimization opportunity there.</li>
 * </ul>
 * 
 * @param {Number}
 *        player The index of the player.
 * @param {Number}
 *        turn The zero-based turn number for which the fog of war is to be computed.
 * @returns {Boolean[][]} The fog matrix.
 */
Replay.prototype.getFog = function(player, turn) {
	var i, fogs, fog, row, col, radius, radius2, row_wrap, col_wrap;
	var fog_row, fog_row1, fog_row2, aniAnts, aniAnt;
	fogs = this.fogs[player];
	if (fogs[turn] === undefined) {
		fogs[turn] = fog = new Array(this.rows);
		for (row = 0; row < this.rows; row++) {
			fog[row] = new Array(this.cols);
			for (col = 0; col < this.cols; col++) {
				fog[row][col] = true;
			}
		}
		radius2 = this.meta['replaydata']['viewradius2'];
		radius = Math.sqrt(radius2) | 0;
		row_wrap = new Array(2 * radius + 1);
		col_wrap = new Array(2 * radius + 1);
		aniAnts = this.getTurn(turn);
		for (i = 0; i < aniAnts.length; i++) {
			aniAnt = aniAnts[i].interpolate(turn);
			if (aniAnt && aniAnt['owner'] === player) {
				for (row = 2 * radius; row >= 0; row--) {
					row_wrap[row] = Math.wrapAround(aniAnt['y'] - radius + row, this.rows);
				}
				for (col = 2 * radius; col >= 0; col--) {
					col_wrap[col] = Math.wrapAround(aniAnt['x'] - radius + col, this.cols);
				}
				col = col_wrap[radius];
				for (row = 1; row <= radius; row++) {
					fog[row_wrap[radius - row]][col] = false;
					fog[row_wrap[radius + row]][col] = false;
				}
				fog_row = fog[row_wrap[radius]];
				for (col = 0; col < col_wrap.length; col++) {
					fog_row[col_wrap[col]] = false;
				}
				for (row = 1; row <= radius; row++) {
					fog_row1 = fog[row_wrap[radius - row]];
					fog_row2 = fog[row_wrap[radius + row]];
					for (col = 1; col <= radius; col++) {
						if (row * row + col * col <= radius2) {
							fog_row1[col_wrap[radius - col]] = false;
							fog_row1[col_wrap[radius + col]] = false;
							fog_row2[col_wrap[radius - col]] = false;
							fog_row2[col_wrap[radius + col]] = false;
						}
					}
				}
			}
		}
	}
	return fogs[turn];
};

/**
 * @class A highly optimized string tokenizer for replay files. It ignores blank lines and comment
 *        lines, trims and splits each line in two after the keyword. It processes a 220 KB file
 *        with over 27,000 lines in about 18 ms in Chromium on a 2,0 Ghz Core 2 Duo. This class is
 *        used by {@link Replay#txtToJson}.
 * @constructor
 * @param {String}
 *        text A replay string.
 */
function LineIterator(text) {
	// we keep a backup copy of the original for debugging purposes
	this.text = text;
	// eat comment lines and trim others; split text into lines
	this.lines = text.replace(LineIterator.NORMALIZE_REGEXP, '').split('\n');
	this.tokenLines = new Array(this.lines.length);
	// separate keyword from parameter list
	for ( var i = 0; i < this.lines.length; i++) {
		this.tokenLines[i] = new TokenLine(this.lines[i]);
	}
	this.pos = 0;
}

/**
 * An ugly looking regexp that finds all extra whitespace and comment lines in a block of text.
 */
LineIterator.NORMALIZE_REGEXP = /^([^\S\n]*(#.*)?\n)*|(\n[^\S\n]*(#.*)?)*$|\n[^\S\n]*(#.*)?(?=\n)/g;

/**
 * Fetches the next line from the replay.
 * 
 * @throws {Error}
 *         If an attempt is made to read past the last line.
 * @returns {String} The next non-empty, non-comment line.
 */
LineIterator.prototype.gimmeNext = function() {
	if (this.pos < this.tokenLines.length) {
		return this.tokenLines[this.pos++];
	}
	throw new Error('Tried to read past the end of the file. Is it truncated?');
};

/**
 * Checks for the end of file condition.
 * 
 * @returns {Boolean} True, if the end of the replay string has been reached.
 */
LineIterator.prototype.moar = function() {
	return this.pos < this.tokenLines.length;
};

/**
 * Splits a line of text into keyword and parameter block. Since the parameter block is allowed to
 * be a single string with spaces no further splitting is done.
 * 
 * @class A single line of replay / map text in the general format "keyword param1 param2 ...". The
 *        class offers methods to apply external splitting functions to it. And validate values.
 * @constructor
 * @param {String}
 *        line A replay / map line of text.
 */
function TokenLine(line) {
	this.line = line;
	var match = line.match(TokenLine.KEYWORD_REGEXP);
	this.keyword = match[1].toLowerCase();
	this.params = match[2];
}

/**
 * Finds the first block of whitespace and splits the string into the part in front and after it.
 */
TokenLine.KEYWORD_REGEXP = /(\S+)\s*(.*)/;

/**
 * Enforces that this TokenLine starts with the expected keyword.
 * 
 * @param {String}
 *        keyword The expected keyword.
 * @throws {Error}
 *         If the TokenLine doesn't start with the keyword.
 * @returns {TokenLine} This object for cascading calls.
 */
TokenLine.prototype.kw = function(keyword) {
	if (this.keyword !== keyword) {
		this.expected(keyword, this.keyword);
	}
	return this;
};

/**
 * Splits the parameter block of this object using given parsing-and-validation functions. Most of
 * those functions will split after the first white-space. Some will check for positive integers or
 * other constraints.
 * 
 * @param {Array}
 *        args A list of parsing-and-validation functions.
 * @param {Number}
 *        optional Number of optional parameters that need not exist at the end of the line. In that
 *        case 'args' contains the complete list of functions for all possible parameters, but the
 *        last 'optional' number of them may not be put to use if the TokenLine lacks these. This
 *        parameter itself is optional and defaults to 0.
 * @throws {Error}
 *         If the the functions did not parse all of the line. (To many parameters for a keyword in
 *         the replay.)
 * @returns {TokenLine} This object for cascading calls.
 */
TokenLine.prototype.as = function(args, optional) {
	if (optional === undefined) optional = 0;
	var work = this.params;
	this.params = [];
	for ( var i = 0; i < args.length; i++) {
		if (work || args.length - i > optional) {
			var parts = args[i](work);
			this.params.push(parts[0]);
			work = parts[1];
		}
	}
	if (work) throw new Error('The following unexpected additional parameter was found: ' + work);
	return this;
};

/**
 * Helper function to construct an Error object with a message about keywords / parameters in the
 * replay / map that did not match a certain expectation.
 * 
 * @private
 * @throws {Error}
 *         Always.
 * @param expectation
 *        The expected value (that can be implicitly converted to string).
 * @param reality
 *        The value that was found in the replay (that can be implicitly converted to string).
 */
TokenLine.prototype.expected = function(expectation, reality) {
	throw new Error('Expected ' + expectation + ', but ' + reality + ' found.');
};

/**
 * Enforces that the n-th zero-based parameter matches a certain value.<br>
 * <h4>Example</h4>
 * "v pirates 1" is a constant line in the replay. expectEq(0, 'pirates') verifies that the first
 * parameter is the string 'pirates' and expectEq(1, 1) validates the number 1 following it.
 * 
 * @throws {Error}
 *         If value !== params[idx]
 * @param {Number}
 *        idx The index of the parameter.
 * @param value
 *        Any comparison value that must be exactly matched by the parameter.
 */
TokenLine.prototype.expectEq = function(idx, value) {
	if (value !== this.params[idx]) {
		this.expected(value, this.params[idx]);
	}
};

/**
 * Enforces that the n-th zero-based parameter is less or equal to a certain value.<br>
 * <h4>Example</h4>
 * "v pirates 1" is a constant line in the replay. expectEq(0, 'pirates') verifies that the first
 * parameter is the string 'pirates' and expectEq(1, 1) validates the number 1 following it.
 * 
 * @throws {Error}
 *         If value &lt; params[idx]
 * @param {Number}
 *        idx The index of the parameter.
 * @param {Number}
 *        value Any comparison value that must be greater or equal to the parameter.
 */
TokenLine.prototype.expectLE = function(idx, value) {
	if (value < this.params[idx]) {
		this.expected('parameter ' + idx + ' to be <= ' + value, this.params[idx]);
	}
};
