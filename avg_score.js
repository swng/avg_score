// v2.0

const {encoder, decoder, Page, Field} = require('tetris-fumen');
const fs = require('fs');

const GAMES = {JSTRIS: {}, TETRIO: {}, GUIDELINE: {}};
const GAME = GAMES.JSTRIS;

let score_table_normal    = [   0,  100,  300,  500,  800];
let score_table_spin      = [ 400,  800, 1200, 1600];
let score_table_spin_mini = [ 100,  200,  400];
let score_table_pc        = [ NaN,  800, 1200, 1800,  NaN]; // only used for guideline


const rotation_directions = ['spawn', 'right', 'reverse', 'left'];
const rotation_types = {
	'cw': +1,
	'ccw': -1,
	'180': +2
};
const reverse_rotations = {
	'cw': 'ccw',
	'ccw': 'cw',
	'180': '180'
}

// kick tables based on intial rotation
const TLJSZ_kicks_cw = {
	'spawn':   [[ 0, 0], [-1, 0], [-1,+1], [ 0,-2], [-1,-2]],
	'right':   [[ 0, 0], [+1, 0], [+1,-1], [ 0,+2], [+1,+2]],
	'reverse': [[ 0, 0], [+1, 0], [+1,+1], [ 0,-2], [+1,-2]],
	'left':    [[ 0, 0], [-1, 0], [-1,-1], [ 0,+2], [-1,+2]]
};

const TLJSZ_kicks_ccw = {
	'spawn':   [[ 0, 0], [+1, 0], [+1,+1], [ 0,-2], [+1,-2]],
	'right':   [[ 0, 0], [+1, 0], [+1,-1], [ 0,+2], [+1,+2]],
	'reverse': [[ 0, 0], [-1, 0], [-1,+1], [ 0,-2], [-1,-2]],
	'left':    [[ 0, 0], [-1, 0], [-1,-1], [ 0,+2], [-1,+2]]
};

const TLJSZ_kicks_180 = {
	'spawn':   [[ 0, 0], [ 0,+1], [+1,+1], [-1,+1], [+1, 0], [-1, 0]],
	'right':   [[ 0, 0], [+1, 0], [+1,+2], [+1,+1], [ 0,+2], [ 0,+1]],
	'reverse': [[ 0, 0], [ 0,-1], [-1,-1], [+1,-1], [-1, 0], [+1, 0]],
	'left':    [[ 0, 0], [-1, 0], [-1,+2], [-1,+1], [ 0,+2], [ 0,+1]]
}

const kick_table = {
	'cw': {
		'T': TLJSZ_kicks_cw,
		'I': {
			'spawn':   [[+1, 0], [+2, 0], [-1, 0], [-1,-1], [+2,+2]],
			'right':   [[ 0,-1], [-1,-1], [+2,-1], [-1,+1], [+2,-2]],
			'reverse': [[-1, 0], [+1, 0], [-2, 0], [+1,+1], [-2,-2]],
			'left':    [[ 0,+1], [+1,+1], [-2,+1], [+1,-1], [-2,+2]]
		},
		'L': TLJSZ_kicks_cw,
		'J': TLJSZ_kicks_cw,
		'S': TLJSZ_kicks_cw,
		'Z': TLJSZ_kicks_cw
	},
	'ccw': {
		'T': TLJSZ_kicks_ccw,
		'I': {
			'spawn':   [[ 0,-1], [-1,-1], [+2,-1], [+2,-2], [-1,+1]],
			'right':   [[+1, 0], [+2, 0], [-1, 0], [+2,+2], [-1,-1]],
			'reverse': [[ 0,+1], [-2,+1], [+1,+1], [-2,+2], [+1,-1]],
			'left':    [[-1, 0], [-2, 0], [+1, 0], [-2,-2], [+1,+1]]
		},
		'L': TLJSZ_kicks_ccw,
		'J': TLJSZ_kicks_ccw,
		'S': TLJSZ_kicks_ccw,
		'Z': TLJSZ_kicks_ccw,
	},
	'180': {
		'T': TLJSZ_kicks_180,
		'I': {
			'spawn':   [[+1,-1], [+1, 0]],
			'right':   [[-1,-1], [ 0,-1]],
			'reverse': [[-1,+1], [-1, 0]],
			'left':    [[+1,+1], [ 0,+1]]
		},
		'L': TLJSZ_kicks_180,
		'J': TLJSZ_kicks_180,
		'S': TLJSZ_kicks_180,
		'Z': TLJSZ_kicks_180
	}
};

function occupiedCorner(field, corner) {
	// field.at with extra check for out of bounds
	if (corner[1] < 0 || corner[0] < 0 || corner[0] > 9) return true;
	return field.at(corner[0], corner[1]) != '_';
}

function clearedOffset(rowsCleared, yIndex) {
	// given previously cleared rows, what is the "global" y index of the piece?
	for (let row of rowsCleared) {
		if (yIndex >= row) yIndex++;
	}
	return yIndex;
}

function inverse_clearedOffset(rowsCleared, yIndex) {
	// given previously cleared rows and the global y index, what is the "local" y index?
	let offset = 0;
	for (let row of rowsCleared) {
		if (yIndex > row) offset++;
	}
	return offset;
}

function hold_reorders(queue) {
	if (queue.length <= 1) return new Set(queue); // base case

	let result = new Set();

	let a = hold_reorders(queue.substring(1)); // use first piece, work on the 2nd-rest
	for (let part of a.values()) {
		result.add(queue[0] + part);
	}
	let b = hold_reorders(queue[0] + queue.substring(2)); // use second piece, work on 1st + 3rd-rest
	for (let part of b.values()) {
		result.add(queue[1] + part);
	}
	return result;
}

function get_cumulative_rows_cleared(solution_pages) {
	let rowsCleared = [];
	let testing_field = solution_pages[0].field.copy(); // a copy of it so we don't disturb the original field
	let cumulative_rowsCleared = [[]];
	for (let page of solution_pages) {
		testing_field.fill(page.operation);
		let positions = page.operation.positions();

		// check for line clears
		let y_positions = new Set();
		for (position of positions) {
			y_positions.add(position.y);
		}
		let temp_rowsCleared = new Set();
		for (let y of y_positions) {
			let line_cleared = true;
			for (let x = 0; x < 10; x++) {
				if (testing_field.at(x, y) == '_') line_cleared = false;
			}
			if (line_cleared) temp_rowsCleared.add(clearedOffset(rowsCleared, y));
		}
		for (let row of temp_rowsCleared) rowsCleared.push(row);
		testing_field.clearLine();
		rowsCleared.sort();
		cumulative_rowsCleared.push(rowsCleared.slice());
	}

	return cumulative_rowsCleared;
}

function vanilla_spin(operation, rotation_type) {
	// get old rotation index
	let old_rotation_index = rotation_directions.indexOf(operation.rotation);

	// rotate using the index
	let rotated_index = ((old_rotation_index + rotation_types[rotation_type]) % 4 + 4) % 4;

	// get new rotation direction
	let new_rotation = rotation_directions[rotated_index];

	// change rotation in operation
	operation.rotation = new_rotation; 
	
	return operation;
}

function move_left(operation, number, field) {
	moved_operation = operation.copy();
	for (let i = 0; i < number; i++) {
		moved_operation.x--;
		if (!field.canFill(moved_operation)) return undefined;
	}
	return moved_operation;
}

function move_right(operation, number, field) {
	moved_operation = operation.copy();
	for (let i = 0; i < number; i++) {
		moved_operation.x++;
		if (!field.canFill(moved_operation)) return undefined;
	}
	return moved_operation;
}

function move_up(operation, number, field) {
	moved_operation = operation.copy();
	for (let i = 0; i < number; i++) {
		moved_operation.y++;
		if (!field.canFill(moved_operation)) return undefined;
	}
	return moved_operation;
}

function spin_with_kicks(operation, field, rotation_type, reverse = false) {
    if (operation.type == 'O') return []; // let's not bother rotating O pieces
    let rotated_operation = vanilla_spin(operation.copy(), rotation_type);
    
    if (reverse) {
        let kicks = get_kicks(rotated_operation, operation.rotation, rotation_type);
        let result = [];
        for (let kick of kicks) {
            if (field.canFill(kick)) {
                let temp = spin_with_kicks(kick, field, reverse_rotations[rotation_type])[0];
                if (temp != undefined && temp.x == operation.x && temp.y == operation.y) result.push(kick);
            }
        }
        return result;
    }

    if (!field.canFill(rotated_operation)) {
        let kicks = get_kicks(rotated_operation, operation.rotation, rotation_type);
        for (let kick of kicks) {
            if (field.canFill(kick)) return [kick];
        }
        return [undefined];
    }


	return [rotated_operation];
}


function get_kicks(operation, initial_rotation, rotation_type) {
    let result = [];

	let kick_offsets = kick_table[rotation_type][operation.type][initial_rotation];

	for(let offset of kick_offsets){
		let kicked_operation = operation.copy();

		kicked_operation.x += offset[0];
		kicked_operation.y += offset[1];
		
		result.push(kicked_operation);
	}
    
    return result;
}

function reverse_hd(base_operation, field) {
	let operation = base_operation.copy();
	while (field.canFill(operation) && operation.y < 21) {
		operation.y++;
	}
	operation.y--;

	return operation;
}

function op_string(operation) {
	return operation.rotation + operation.x + operation.y;
}

function is_placeable(op, field) { // bfs I think
    // create a queue and add the initial operation
    let queue = []
    queue.push(op);

    // create a set to store visited operations
    let visited = new Set();

    // loop until the queue is empty
    while (queue.length > 0) {
        let operation = queue.pop();

        // check if the operation is placeable
        if (field.canFill(operation)) {
            // check if the piece has reached the top of the board
            let highestPoint = reverse_hd(operation, field);
            if (highestPoint.y === 20) {
                // the piece has been placed, return the cost
                return true;
            }

            // mark the operation as visited
            visited.add(op_string(operation));

            // try every possible type of movement
            let d_1_steps = [];

            let temp = spin_with_kicks(operation, field, 'cw', true);
            if (temp.length !== 0) d_1_steps = d_1_steps.concat(temp);

            temp = spin_with_kicks(operation, field, 'ccw', true);
            if (temp.length !== 0) d_1_steps = d_1_steps.concat(temp);

            temp = spin_with_kicks(operation, field, '180', true);
            if (temp.length !== 0) d_1_steps = d_1_steps.concat(temp);
            temp = move_up(operation, 1, field);
            if (temp !== undefined) d_1_steps.push(temp);

            temp = move_right(operation, 1, field);
            if (temp !== undefined) d_1_steps.push(temp);

            temp = move_left(operation, 1, field);
            if (temp !== undefined) d_1_steps.push(temp);

            // add the next steps to the queue
            for (let step of d_1_steps) {
                let stepString = op_string(step);
                // check if the step has been visited or is already in the queue
                if (!visited.has(stepString)) {
                    // calculate the heuristic and cost for this step

                    // add the step to the queue
                    queue.push(step);
                }
            }
        }
    }

    // if the queue is empty and no solution has been found, return false
    return false;
}

function t_spin_checker(op, field) { // returns -1 if not t spin; otherwise, returns the kick index (0-4) of the last spin used
	// console.log(page.field.str());
	// console.log("operation:", page.operation);
	// console.log(page.field.canLock(page.operation));

	if (op.type != 'T') return -1;

	let cw = vanilla_spin(op.copy(), 'cw');
	let ccw = vanilla_spin(op.copy(), 'ccw');

	if (field.canFill(cw)) return 0;
	//if (field.canFill(ccw)) return 0;
	//if (field.canFill(r180)) return 0;
	// if any kickless rotation is unobstructed, the other two will also be

	let cw_kicks = get_kicks(cw, op.rotation, 'cw');
	let ccw_kicks = get_kicks(ccw, op.rotation, 'ccw');

	for (let kick of cw_kicks) {
		if (field.canFill(kick)) { // try and reverse it
			let temp = vanilla_spin(kick.copy(), 'ccw');
			let temp_kicks = get_kicks(temp, kick.rotation, 'ccw');
			for (let i = 1; i < 5; i++) {
				temp_kick = temp_kicks[i];
				if (field.canFill(temp_kick)) {
					// console.log(i, kick, temp_kick);
					if (temp_kick.x == op.x && temp_kick.y == op.y) return i;
					return -1; // only first working kick

				}
			}
			return -1; // only first working kick
		}
	}
	for (let kick of ccw_kicks) {
		if (field.canFill(kick)) { // try and reverse it
			let temp = vanilla_spin(kick.copy(), 'cw');
			let temp_kicks = get_kicks(temp, kick.rotation, 'cw');
			for (let i = 1; i < 5; i++) {
				temp_kick = temp_kicks[i];
				if (field.canFill(temp_kick)) {
					// console.log(i, kick, temp_kick);
					if (temp_kick.x == op.x && temp_kick.y == op.y) return i;
					return -1; // only first working kick
				}
			}
			return -1; // only first working kick
		}
	}

	// XXX probably wrong on e.g. v115@zgB8HeA8IeA8AeI8BeH8CeF8JetJJ and the mirror

	if (GAME === GAMES.TETRIO) {
		// not possible to get 180 t-spins on Jstris or guideline
		let r180 = vanilla_spin(op.copy(), '180');
		let r180_kicks = get_kicks(r180, op.rotation, '180');

		for (let kick of r180_kicks) {
			if (field.canFill(kick)) { // try and reverse it
				let temp = vanilla_spin(kick.copy(), '180');
				let temp_kicks = get_kicks(temp, kick.rotation, '180');
				for (let i = 1; i < temp_kicks.length; i++) {
					temp_kick = temp_kicks[i];
					if (field.canFill(temp_kick)) {
						// console.log(i, kick, temp_kick);
						if (temp_kick.x == op.x && temp_kick.y == op.y) return i;
						return -1; // only first working kick
					}
				}
				return -1; // only first working kick
			}
		}
	}

	return -1;
}

function get_score(
	queue,
	solution_pages,
	base_b2b = true,
	base_combo = 1,
	b2b_end_bonus = 0,
	cumulative_rowsCleared = undefined,
	base_field = undefined,
	base_viz = undefined,
	base_rowsCleared = undefined,
) {
	// compute line clear orders in the source solution pages
	if (cumulative_rowsCleared === undefined) cumulative_rowsCleared = get_cumulative_rows_cleared(solution_pages);

	if (base_field === undefined) base_field = solution_pages[0].field.copy();
	if (base_viz === undefined) {
		var base_viz = []; // vizualizer fumen for debugging purposes
		base_viz.push({field: base_field});
	}

	if (base_rowsCleared === undefined) base_rowsCleared = [];

	// let score = 0;
	let results = [];

	let piece = queue[0];
	for (let page of solution_pages) {
		let op = page.operation.copy();
		// assuming the queue matches the pieces in the solution and there's exactly one of each piece, no error handling here :sunglasses:
		if (piece == op.type) {
			global_y = clearedOffset(cumulative_rowsCleared[page.index], op.y);
			op.y = global_y - inverse_clearedOffset(base_rowsCleared, global_y);

			if (base_field.canLock(op) && is_placeable(op, base_field)) {
				let field = base_field.copy();
				let score = 0;
				let b2b = base_b2b;
				let combo = base_combo;
				let viz = [...base_viz]; // this might need to be a deep copy not sure
				let rowsCleared = [...base_rowsCleared]; // shallow copy should work here because numbers are primitive
				field.put(op);

				viz.push({ operation: op });

				let positions = op.positions();

				// check for line clears
				let y_positions = new Set();
				for (let position of positions) {
					y_positions.add(position.y);
				}
				temp_rowsCleared = new Set();
				for (let y of y_positions) {
					let line_cleared = true;
					for (let x = 0; x < 10; x++) {
						if (field.at(x, y) == '_') line_cleared = false;
					}
					if (line_cleared) temp_rowsCleared.add(clearedOffset(rowsCleared, y));
				}
				for (let row of temp_rowsCleared) rowsCleared.push(row);
				rowsCleared.sort();
				let lines_cleared = temp_rowsCleared.size;

				// console.log(lines_cleared);
				let tspin = false;
				let mini = true;
				if (op.type == 'T') {
					let four_corners = [
						[op.x - 1, op.y + 1], // northwest
						[op.x + 1, op.y + 1], // northeast
						[op.x + 1, op.y - 1], // southeast
						[op.x - 1, op.y - 1], // southwest
					];
					let num_corners = 0;
					for (let corner of four_corners) {
						if (occupiedCorner(field, corner)) num_corners++;
					}
					if (num_corners >= 3) {
						kick_index = t_spin_checker(op, base_field);
						// if (kick_index == -1) { // debugging purposes only - there are legitimate non tspins!
						//     console.log(field.str());
						//     console.log(encoder.encode(viz))
						//     throw "non tspin detected";
						// }
						if (kick_index != -1) {
							tspin = true;
							if (kick_index == 4 && GAME !== GAMES.JSTRIS) mini = false; // cringe SRS exception for upgrading fins
							else {
								let two_corners;
								switch (op.rotation) {
									case 'spawn':
										two_corners = [four_corners[0], four_corners[1]];
										break;
									case 'right':
										two_corners = [four_corners[1], four_corners[2]];
										break;
									case 'reverse':
										two_corners = [four_corners[2], four_corners[3]];
										break;
									case 'left':
										two_corners = [four_corners[3], four_corners[0]];
										break;
								}
								let num_corners = 0;
								for (let corner of two_corners) {
									if (occupiedCorner(field, corner)) num_corners++;
								}
								if (num_corners == 2) mini = false;
							}
						}
					}
				}
				if (tspin && GAME === GAMES.JSTRIS && lines_cleared >= 2) {mini = false;}

				let activate_b2b = (tspin && lines_cleared > 0) || lines_cleared >= 4;
				let multiplier = (b2b && activate_b2b) ? 1.5 : 1;
				if (tspin) {
					if (mini) {
						score += score_table_spin_mini[lines_cleared] * multiplier;
					} else {
						score += score_table_spin[lines_cleared] * multiplier;
					}
				} else {
					score += score_table_normal[lines_cleared] * multiplier;
				}

				let noteworthy = (tspin && (!mini || (lines_cleared > 0 && b2b))) || lines_cleared >= 4;
				let score_event = {lines_cleared, tspin, mini, b2b: !!lines_cleared && b2b};
				/*
				any full t-spin:         yes
				any mini t-spin w/o b2b: no
				any mini t-spin w/ b2b:  yes (mini nulls not included here)
				quad:                    yes
				*/

				if (lines_cleared == 0) combo = 0;
				else {
					if (combo > 0) {
						// console.log('combo', combo, ':', 50 * combo);
						score += 50 * combo;
					}
					combo++;
				}

				field.clearLine();

				// check if board is cleared
				let pc = true;
				for (let x = 0; x < 10; x++) {
					if (field.at(x, 0) != '_') pc = false; // just gonna check the bottom row
				}
				if (pc) {
					// console.log('PC:', 3000);
					switch (GAME) {
						case GAMES.TETRIO:
							score += 3500;
							break;
						case GAMES.JSTRIS:
							score += 3000;
							break;
						case GAMES.GUIDELINE:
							if (lines_cleared <= 3) {score += score_table_pc[lines_cleared];}
							else if (lines_cleared === 4) {score += b2b ? 3200 : 2000;}
							break;
					}
					// return score;
				}

				if (activate_b2b) {b2b = true;}
				else if (lines_cleared > 0) {b2b = false;}

				if (queue.length <= 1) {
					if (b2b) {score += b2b_end_bonus;}
					results.push({score: score, extra: noteworthy ? [score_event] : [], pcs: +pc, pc_end: pc, b2b_end: b2b});
					// end of queue is base case for recursive function
				} else {
					let score_obj = get_score(
							queue.substring(1),
							solution_pages,
							b2b,
							combo,
							b2b_end_bonus,
							cumulative_rowsCleared,
							field,
							viz,
							rowsCleared
						);
					// otherwise, recursively call score function to get max score on the rest of the queue
					score_obj.score += score;
					if (noteworthy) {score_obj.extra.push(score_event);}
					score_obj.pcs += pc;
					results.push(score_obj);
				}

				// console.log(encoder.encode(viz));
			} else {
				// throwing an error for debugging purposes, but may want to remove this if working on non *p7 solution queues with dupes
				// console.log(queue, encoder.encode(solution_pages));
				// console.log(encoder.encode(viz));
				// console.log(field.str(), op, global_y, rowsCleared);
				throw "solution path fail; does solution queue have dupes?";
				// return 0; // piece could not lock, solution and queue were incompatible
			}
		}
	}

    if (results.length == 0) { // no piece placement applied to this piece, this path is a failure
        // return {score: -3000, extra: [], pcs: +false, pc_end: false, b2b_end: false}
		// return -3000; // may want to just return -30000 if working with non *p7 solution queues with dupes
		// console.log(queue, encoder.encode(base_viz));
        // console.log(base_field.str())
        // console.log(encoder.encode(solution_pages))
		throw "solution path fail; does solution queues have dupes?";
	}
	return results.reduce((so0, so1) => pick_better_score(so0, so1));
}

function pick_better_score(so0, so1) {
	if (!so0) {return so1;}
	if (!so1) {return so0;}
	if (so1.score > so0.score) {return so1;}
	if (so0.score > so1.score) {return so0;}
	if (so0.pc_end && !so1.pc_end) {return so0;}
	if (so1.pc_end && !so0.pc_end) {return so1;}
	if (so0.b2b_end && !so1.b2b_end) {return so0;}
	if (so1.b2b_end && !so0.b2b_end) {return so1;}
	if (so0.extra.filter(event => event.tspin).length < so1.extra.filter(event => event.tspin).length) {return so0;}
	return so1;
}

function extra_string(extras) {
    let result = ""
    for (extra of extras) {
        // {"lines_cleared":2,"tspin":true,"mini":false,"b2b":true}
        // result += JSON.stringify(extra);
        let temp = "";
        if (extra.b2b) temp += "B2B "
        if (extra.tspin) {
            temp += "TS";
            if (extra.mini) temp += "M";
            temp += "0SDT"[extra.lines_cleared];
        }
        if (extra.lines_cleared == 4) temp += "quad";

        result += temp;

    }

    return result;
}


function loadCSV(filename) {
	let csv = fs.readFileSync(filename, 'utf8');
	let lines = csv.split(/\s+/); // this is regex for any whitespace /r /n /t /f /v
	let data = {};
	for (let line of lines) {
		let temp = line.split(',');
		data[temp[0]] = temp.slice(1);
	}
	return data;
}

function loadPathCSV(filename) {
	let csv = fs.readFileSync(filename, 'utf8');
	let rows = csv.trim().split(/\s+/).slice(1).map(s => s.split(','));
	let queues_set = new Set;
	let solutions_map = new Map;
	for (let row of rows) {
		let queue = row[0];
		queues_set.add(queue);
		if (row[4] === '') {continue;}
		let solutions = row[4].split(';');
		for (let solution of solutions) {
			if (!solutions_map.has(solution)) {
				solutions_map.set(solution, new Set([queue]));
			} else {
				solutions_map.get(solution).add(queue);
			}
		}
	}
	let solutions_list = [...solutions_map.keys()];
	let data = {sequence: solutions_list};
	for (let queue of queues_set) {
		data[queue] = solutions_list.map(solution => solutions_map.get(solution).has(queue) ? 'O' : 'X');
	}
	return data;
}

function calculate_all_scores(
queues,
data_nohold,
base_b2b = true, // should be true unless it's a skim setup
base_combo = 1, // should be 1 unless TSD in DPC setup was done early
b2b_end_bonus = 0, // ~0 for 1st, 300 for SDPC, 500 for SDPC w/ TD fallback, 800 for TD
) {
	//data_nohold = loadCSV('output/cover_nohold.csv');

	let solutions = [];
	let solutions_cumulative_rows_cleared = [];

	let nohold_queues = Object.keys(data_nohold).filter(q => q !== 'sequence' && q !== '');

	for (let index = 0; index < data_nohold['sequence'].length; index++) {
		// load the objects of all the decoded fumens
		solutions.push(decoder.decode(data_nohold['sequence'][index]));
		solutions_cumulative_rows_cleared.push(get_cumulative_rows_cleared(solutions[index]));
	}

	let all_scores = [];

	let score_by_nohold_queue = {};

	for (let queue of nohold_queues) {
		let max_score_obj;
		let max_queue = '';
		let max_sol_index = 0;
		for (let j = 0; j < data_nohold[queue].length; j++) {
			if (data_nohold[queue][j] == 'O') {
				let pages = solutions[j];
				let cumulative_rowsCleared = solutions_cumulative_rows_cleared[j];
				// compute it
				// queue, solution pages, initial b2b, initial combo, b2b end bonus
				let score_obj = get_score(queue, pages, base_b2b, base_combo, b2b_end_bonus, cumulative_rowsCleared);
				if (max_score_obj !== pick_better_score(score_obj, max_score_obj)) {
					max_score_obj = score_obj;
					max_queue = queue;
					max_sol_index = j;
				}
			}
		}
		score_by_nohold_queue[queue] = max_score_obj;
	}

	let num_covered_queues = 0;
	let num_pc_queues = 0;
	let num_extra_queues = 0;
	let num_b2b_queues = 0;
    let extras = {};
	for (let queue of queues) {
		let hold_reorderings = hold_reorders(queue);
		let max_score_obj;
		for (let hold_queue of hold_reorderings) {
			max_score_obj = pick_better_score(max_score_obj, score_by_nohold_queue[hold_queue]);
		}
		if (max_score_obj) {
			num_covered_queues++;
			all_scores.push(max_score_obj.score);
			if (max_score_obj.pc_end) {num_pc_queues++;}
			if (max_score_obj.b2b_end) {num_b2b_queues++;}
			if (max_score_obj.extra.length > 0) {
				num_extra_queues++;
				let extra_str = extra_string(max_score_obj.extra);
				//if (extra_str === '[{"lines_cleared":1,"tspin":true,"mini":false,"b2b":true}]') {console.log(queue, max_score_obj);}
				if (!extras[extra_str]) {extras[extra_str] = 0;}
                extras[extra_str]++;
                
            }
		}
	}
	//console.log(all_scores.length);
	//console.log(`covered: ${num_covered_queues}/${queues.length} = ${(num_covered_queues/queues.length).toFixed(4)}`);
	//console.log(`PC: ${num_pc_queues}/${queues.length} = ${(num_pc_queues/queues.length).toFixed(4)}`);
	//console.log(`extra: ${num_extra_queues}/${queues.length} = ${(num_extra_queues/queues.length).toFixed(4)}`);
    console.log(extras);
	//console.log(`b2b: ${num_b2b_queues}/${queues.length} = ${(num_b2b_queues/queues.length).toFixed(4)}`);
	return ({
		average_covered_score: all_scores.reduce((a, b) => a + b) / all_scores.length,
		num_covered_queues,
		num_pc_queues,
		num_extra_queues,
		num_b2b_queues,
	});
}

function generate_all_permutations(l)
{
	let n = l.length;
	if (n === 0) {return [[]];}
	let cut = generate_all_permutations(l.slice(1));
	return cut
		.map(p => {
			let inserts = [];
			for (let i = 0; i < n; i++)
			{
				inserts[i] = p.slice();
				inserts[i].splice(i, 0, l[0]);
			}
			return inserts;
		})
		.flat(1);
}

let queues = generate_all_permutations('LJSZIOT').map(q => q.join(''));

let results = calculate_all_scores(queues, loadPathCSV('output/path.csv'), true, 1);
console.log(results);