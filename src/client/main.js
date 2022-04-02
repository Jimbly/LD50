/*eslint global-require:off*/
const local_storage = require('glov/client/local_storage.js');
local_storage.setStoragePrefix('ld50'); // Before requiring anything else that might load from this

const camera2d = require('glov/client/camera2d.js');
const engine = require('glov/client/engine.js');
const input = require('glov/client/input.js');
const { abs, floor, max, min, random, round, sin } = Math;
const net = require('glov/client/net.js');
const pico8 = require('glov/client/pico8.js');
const { randCreate, mashString } = require('glov/common/rand_alea.js');
const score_system = require('glov/client/score.js');
const { createSprite } = require('glov/client/sprites.js');
const ui = require('glov/client/ui.js');
const { clone } = require('glov/common/util.js');
const { unit_vec, vec2, vec4 } = require('glov/common/vmath.js');

window.Z = window.Z || {};
Z.BACKGROUND = 1;
Z.SPRITES = 10;
Z.PARTICLES = 20;
Z.UI_TEST = 200;
Z.UI2 = Z.UI + 20;

// Virtual viewport for our game logic
const game_width = 420;
const game_height = 256;
const TILE_SIZE = 13;

const ALLOW_ROTATE = false;

const colors_selected = ui.makeColorSet([0.5, 1, 0.5, 1]);
let sprites = {};

export function main() {
  if (engine.DEBUG) {
    // Enable auto-reload, etc
    net.init({ engine });
  }

  const font_info_quicksand = require('./img/font/quicksand.json');
  let pixely = 'off';
  let font = { info: font_info_quicksand, texture: 'font/quicksand' };

  if (!engine.startup({
    game_width,
    game_height,
    pixely,
    font,
    viewport_postprocess: false,
    antialias: false,
    show_fps: false,
    do_borders: false,
    ui_sprites: {
      button: ['ui/button', [128,768,128], [256]],
      button_down: ['ui/button_down', [128,768,128], [256]],
      button_disabled: ['ui/button_disabled', [100,56,100], [128]],
    },
  })) {
    return;
  }
  font = engine.font;

  gl.clearColor(0, 0.1, 0.3, 1);
  ui.scaleSizes(13 / 32);
  ui.setFontHeight(8);

  sprites.bg = createSprite({
    name: 'bg',
    wrap_s: gl.REPEAT,
    wrap_t: gl.CLAMP_TO_EDGE,
  });
  sprites.tiles = createSprite({
    name: 'tile',
    ws: [128,128,128,128],
    hs: [128],
  });

  const level_defs = {
    short: {
      name: 'short', display_name: 'Short', default_seed: 'test',
      time_decrease: 15, initial_turns: 10, base_time: 8,
    },
    med: {
      name: 'med', display_name: 'Medium',
      time_decrease: 25, initial_turns: 12, base_time: 8,
    },
    long: {
      name: 'long', display_name: 'Long',
      time_decrease: 35, initial_turns: 15, base_time: 8,
    },
    endless: {
      name: 'endless', display_name: 'Endless',
      initial_turns: 12, base_time: 8,
    },
  };
  let level_list = Object.keys(level_defs).map((key) => level_defs[key]);
  for (let ii = 0; ii < level_list.length; ++ii) {
    level_list[ii].idx = ii;
  }

  const style_minus_turn = font.style(null, {
    color: 0x000000ff,
    outline_width: 1,
    outline_color: 0x000000ff,
  });
  const style_fill_help = font.style(null, {
    color: 0xFFFFFFff,
    glow_color: 0x000000dd,
    glow_xoffs: 2,
    glow_yoffs: 2,
    glow_inner: -2.5,
    glow_outer: 7,
  });
  const style_fill_help_done = font.style(style_fill_help, {
    color: 0x00FF00ff,
    glow_color: 0x006600ff,
  });
  const style_bottom_hint = font.style(style_fill_help, {
    color: 0xDDDDDDff,
    glow_color: 0x00000090,
  });
  ui.font_style_focused = ui.font_style_normal;

  const style_score = font.style(null, {
    color: 0xFFFFFFff,
    glow_color: 0x00000033,
    glow_xoffs: 0,
    glow_yoffs: 0,
    glow_inner: 0,
    glow_outer: 5,
  });

  function encodeScore(score) {
    let actions = min(score.actions, 99999);
    return (score.score || 0) * 100000 + actions;
  }

  function parseScore(value) {
    let score = floor(value / 100000);
    value -= score * 100000;
    let actions = value;
    return {
      score,
      actions,
    };
  }

  score_system.init(encodeScore, parseScore, level_list, 'LD50');
  score_system.updateHighScores();

  const M3W = 8;
  const M3H = 7;
  const M3VARIETY = 3;
  const M3COLORS = [
    // pico8.colors[8],
    // pico8.colors[11],
    // pico8.colors[9],
    // pico8.colors[15],

    //vec4(1,0.5,0.5,1),
    vec4(1,0.6,0.5,1),
    vec4(0.5,1,0.5,1),
    vec4(0.5,0.5,1,1),

    // vec4(0.5,0.8,1.0,1),
    // vec4(0.7,1,0.5,1),
    // vec4(0.8,0.6,1,1),

    // v4fromRGBA(0x8884FFff),
    // v4fromRGBA(0xFCBCB8ff),
    // v4fromRGBA(0xFFF275ff),
  ];
  const SHIP_EMPTY = -1;
  const SHIP_BORDER = -2;
  const SHIP_DAMAGED = -3;
  const SHIP_DAMAGED_PREVIEW = -4;
  const SHIP_COLORS = {
    [SHIP_EMPTY]: vec4(0,0,0,1),
    [SHIP_BORDER]: null,
    [SHIP_DAMAGED]: vec4(0.7,0.1,0,1),
    [SHIP_DAMAGED_PREVIEW]: vec4(1,0.1,0,1),
  };
  const NUM_SHIPS = 3;
  const SHIPW = 6;
  const SHIPH = 6;
  const DX = [-1, 1, 0, 0];
  const DY = [0, 0, -1, 1];
  function boardGet(board, x, y, oob) {
    if (x < 0 || y < 0 || x >= board[0].length || y >= board.length) {
      return oob;
    }
    return board[y][x];
  }
  function newShip(game) {
    let { rand } = game;
    let ship = {
      miss: 0,
      board: [],
    };
    let { board } = ship;
    for (let yy = 0; yy < SHIPH; ++yy) {
      let row = [];
      for (let xx = 0; xx < SHIPW; ++xx) {
        let is_edge = !yy || !xx || yy === SHIPH - 1 || xx === SHIPW - 1;
        row.push(is_edge ? rand.range(3) ? SHIP_BORDER : SHIP_EMPTY : SHIP_EMPTY);
      }
      board.push(row);
    }
    for (let yy = 0; yy < board.length; ++yy) {
      let row = board[yy];
      for (let xx = 0; xx < row.length; ++xx) {
        if (row[xx] === SHIP_EMPTY) {
          let neighbors = 0;
          for (let kk = 0; kk < DX.length; ++kk) {
            if (boardGet(board, xx + DX[kk], yy + DY[kk], SHIP_BORDER) === SHIP_EMPTY) {
              neighbors++;
            }
          }
          if (!neighbors) {
            row[xx] = SHIP_BORDER;
          }
        }
      }
    }
    return ship;
  }
  function Game(level, seed) {
    let game = this;
    if (!seed) {
      seed = String(random());
    }
    let rand = game.rand = randCreate(mashString(seed));
    game.level = level;
    let level_def = level_defs[level];
    game.level_def = level_def;
    game.time_decrease = level_def.time_decrease;
    game.base_time = level_def.base_time;
    game.m3board = [];
    for (let ii = 0; ii < M3H; ++ii) {
      let row = [];
      for (let jj = 0; jj < M3W; ++jj) {
        row.push(rand.range(M3VARIETY));
      }
      game.m3board.push(row);
    }
    game.ships = [];
    for (let ii = 0; ii < NUM_SHIPS; ++ii) {
      game.ships.push(newShip(game));
    }
    game.piece = null;
    game.miss = 0;
    game.score = 0;
    game.actions = 0;
    game.time_left = level_def.initial_turns || 10;
    game.dismissed = false;
  }
  const SER_FIELDS = [
    'level',
    'm3board',
    'ships',
    'piece',
    'miss',
    'score',
    'actions',
    'time_left',
    'dismissed',
  ];
  function gameFromJSON(obj) {
    let game = new Game(obj.level);
    game.rand.reseed(obj.seed);
    SER_FIELDS.forEach((field) => {
      game[field] = clone(obj[field]);
    });
    return game;
  }
  Game.prototype.toJSON = function () {
    let game = this;
    let obj = {
      rand: game.rand.seed,
    };
    SER_FIELDS.forEach((field) => {
      obj[field] = game[field];
    });
    return obj;
  };
  level_list.forEach(function (level_def) {
    let saved = local_storage.getJSON(`level.${level_def.name}`, null);
    if (saved) {
      level_def.saved = saved;
    }
  });
  function saveGame(game) {
    let { level_def } = game;
    let obj = game.toJSON();
    level_def.saved = clone(obj);
    local_storage.setJSON(`level.${level_def.name}`, obj);
  }

  function getMatchShape(board, x0, y0) {
    let tile = board[y0][x0];
    let to_search = [];
    let members = [];
    let done = {};
    let ret = {
      tile,
      x: x0,
      y: y0,
    };
    let maxx = x0;
    let maxy = y0;
    function addSearch(x, y) {
      let idx = y * 1000 + x;
      if (!done[idx]) {
        done[idx] = true;
        to_search.push([x,y]);
      }
    }
    addSearch(x0, y0);
    function search(pair) {
      let [x, y] = pair;
      let test = boardGet(board, x, y, -1);
      if (test === tile) {
        ret.x = min(ret.x, x);
        ret.y = min(ret.y, y);
        maxx = max(maxx, x);
        maxy = max(maxy, y);
        members.push(pair);
        for (let ii = 0; ii < DX.length; ++ii) {
          addSearch(x + DX[ii], y + DY[ii]);
        }
      }
    }
    while (to_search.length) {
      search(to_search.pop());
    }
    ret.w = maxx - ret.x + 1;
    ret.h = maxy - ret.y + 1;
    ret.members = members;
    return ret;
  }

  let game;

  let anim = {};
  let anim_offs;

  function m3clearTile(board, x, y) {
    anim_offs[x] = (anim_offs[x] || 0) + 1;
    while (y > 0) {
      if (anim[[x,y-1]]) {
        anim[[x,y]] = anim[[x,y-1]] + 1;
        delete anim[[x,y-1]];
      } else {
        anim[[x,y]] = 1;
      }
      board[y][x] = board[y-1][x];
      y--;
    }
    board[0][x] = game.rand.range(M3VARIETY);
    anim[[x,0]] = anim_offs[x];
  }

  const TILE_PAD = 2;
  const TILEADV = TILE_SIZE + TILE_PAD;

  function pickup(match) {
    let { members } = match;
    let board = game.m3board;
    anim_offs = [];
    for (let ii = 0; ii < members.length; ++ii) {
      let [x, y] = members[ii];
      board[y][x] = -1;
      members[ii][0] -= match.x;
      members[ii][1] -= match.y;
    }
    match.xoffs -= match.x * TILEADV;
    match.yoffs -= match.y * TILEADV;
    game.piece = match;

    for (let jj = 0; jj < board.length; ++jj) {
      let row = board[jj];
      for (let ii = 0; ii < row.length; ++ii) {
        while (row[ii] === -1) {
          m3clearTile(board, ii, jj);
        }
      }
    }
    saveGame(game);
  }

  function drawTile(x, y, z, tile) {
    let color = M3COLORS[tile] || SHIP_COLORS[tile];
    if (!color) {
      return;
    }
    sprites.tiles.draw({
      x: x - TILE_PAD/2, y: y - TILE_PAD/2,
      w: TILEADV, h: TILEADV,
      z: z - 1,
      frame: 0,
    });
    ui.drawRect(x, y, x + TILE_SIZE, y + TILE_SIZE, z, color);
  }

  const M3_VIS_W = TILEADV * M3W - TILE_PAD;
  const M3X = (game_width - M3_VIS_W) / 2;
  const M3Y = TILE_SIZE;
  function doMatch3() {
    for (let key in anim) {
      let v = anim[key] - engine.frame_dt * 0.01;
      if (v < 0) {
        delete anim[key];
      } else {
        anim[key] = v;
      }
    }
    let z = Z.UI;
    let board = game.m3board;
    for (let yy = 0; yy < board.length; ++yy) {
      let row = board[yy];
      let y = M3Y + yy * TILEADV;
      for (let xx = 0; xx < row.length; ++xx) {
        let tile = row[xx];
        let x = M3X + xx * TILEADV;
        let draw_y = y;
        let animv = anim[[xx,yy]] || 0;
        draw_y -= animv * TILEADV;
        drawTile(x, draw_y, z, tile);
        let click_param = {
          x: x - TILE_PAD/2,
          y: y - TILE_PAD/2,
          w: TILEADV, h: TILEADV,
        };
        let click;
        if (game.piece || !game.time_left) {
          // no input
        } else if ((click = input.mouseDownEdge(click_param))) {
          let match = getMatchShape(board, xx, yy);
          match.xoffs = click.pos[0] - M3X + TILE_PAD/2;
          match.xoffs = round((match.xoffs - TILEADV/2) / TILEADV) * TILEADV + TILEADV/2;
          match.yoffs = click.pos[1] - M3Y + TILE_PAD/2;
          match.yoffs = round((match.yoffs - TILEADV/2) / TILEADV) * TILEADV + TILEADV/2;
          pickup(match);
        } else if (input.mouseOver(click_param)) {
          let match = getMatchShape(board, xx, yy);
          for (let ii = 0; ii < match.members.length; ++ii) {
            let pos = match.members[ii];
            let [tx, ty] = pos;
            tx = M3X + tx * TILEADV;
            ty = M3Y + ty * TILEADV;
            ui.drawRect(tx - 2, ty - 2, tx + TILE_SIZE + 2, ty + TILE_SIZE + 2, z - 1, [1,1,1,1]);
          }
        }
      }
    }
  }

  let ship_used = [];
  for (let yy = 0; yy < SHIPH; ++yy) {
    let row = [];
    for (let xx = 0; xx < SHIPW; ++xx) {
      row.push(0);
    }
    ship_used.push(row);
  }
  function shipCalcScore(ship) {
    let count = {};
    let { board } = ship;
    let score = 100;
    for (let ii = 0; ii < ship_used.length; ++ii) {
      let row = ship_used[ii];
      for (let jj = 0; jj < row.length; ++jj) {
        row[jj] = 0;
      }
    }
    function walk(x, y, match) {
      if (boardGet(ship_used, x, y, 1)) {
        return 0;
      }
      if (board[y][x] !== match) {
        return 0;
      }
      ship_used[y][x] = 1;
      let ret = 1;
      for (let ii = 0; ii < DX.length; ++ii) {
        ret += walk(x + DX[ii], y + DY[ii], match);
      }
      return ret;
    }
    for (let yy = 0; yy < board.length; ++yy) {
      let row = board[yy];
      for (let xx = 0; xx < row.length; ++xx) {
        let tile = row[xx];
        count[tile] = (count[tile] || 0) + 1;
        if (tile >= 0) {
          let score_count = walk(xx, yy, tile);
          score += score_count * (score_count + 1) / 2;
        }
      }
    }
    return {
      time: max(1, game.base_time - (ship.miss || 0)),
      done: !count[SHIP_EMPTY],
      score,
    };
  }

  function placePiece(ship) {
    // actual pieces placed while drawing
    game.actions++;
    game.piece = null;
    game.time_left--;
    let score = shipCalcScore(ship);
    if (score.done) {
      // remove and score ship
      game.time_left += score.time;
      let idx = game.ships.indexOf(ship);
      game.ships[idx] = newShip(game);
      game.score += score.score;
    }
    score_system.setScore(game.level_def.idx,
      { score: game.score, actions: game.actions }
    );
    if (game.time_decrease) {
      --game.time_decrease;
      if (!game.time_decrease) {
        game.time_decrease = game.level_def.time_decrease;
        game.base_time = max(1, game.base_time - 1);
      }
    }
    saveGame(game);
  }

  const SHIP_PAD = TILEADV * 3;
  const SHIP_VIS_W = TILEADV * SHIPW + SHIP_PAD;
  const SHIPX = (game_width - (SHIP_VIS_W * NUM_SHIPS - SHIP_PAD)) / 2;
  const SHIPY = M3Y + TILEADV * M3H + TILE_SIZE;
  let mouse_pos = vec2();
  function doShip(x0, y0, ship, do_piece) {
    let z = Z.UI;
    let { piece } = game;
    let piece_info = null;

    let { board } = ship;
    let temp_ship;
    if (do_piece) {
      temp_ship = clone(ship);
      let { members, xoffs, yoffs } = piece;
      let mouse_x = round((mouse_pos[0] - (x0 + xoffs - TILE_PAD/2)) / TILEADV);
      let mouse_y = round((mouse_pos[1] - (y0 + yoffs - TILE_PAD/2)) / TILEADV);
      if (mouse_x > -piece.w && mouse_y > -piece.h &&
        mouse_x < SHIPW && mouse_y < SHIPH
      ) {
        piece_info = [];
        let do_place = input.click({
          max_dist: Infinity,
        });
        for (let ii = 0; ii < members.length; ++ii) {
          let pos = members[ii];
          let [tx, ty] = pos;
          tx += mouse_x;
          ty += mouse_y;
          let sx = x0 + tx * TILEADV;
          let sy = y0 + ty * TILEADV;
          let existing = board[ty]?.[tx];
          let place = piece.tile;
          let color = unit_vec;
          let zz = z - 1;
          let member_info = [sx, sy];
          if (existing !== SHIP_EMPTY) {
            place = SHIP_DAMAGED;
            zz--;
            // color = SHIP_COLORS[SHIP_DAMAGED];
            temp_ship.miss++;
            if (do_place) {
              game.miss++;
              ship.miss++;
            }
            member_info.push(SHIP_DAMAGED_PREVIEW);
          } else {
            member_info.push(piece.tile);
          }
          piece_info.push(member_info);
          ui.drawRect(sx - 2, sy - 2, sx + TILE_SIZE + 2, sy + TILE_SIZE + 2, zz, color);
          if (tx >= 0 && tx < SHIPW && ty >= 0 && ty < SHIPH) {
            temp_ship.board[ty][tx] = place;
            if (do_place) {
              board[ty][tx] = place;
            }
          }
        }
        if (do_place) {
          placePiece(ship);
        }
      }
    }

    for (let yy = 0; yy < board.length; ++yy) {
      let row = board[yy];
      let y = y0 + yy * TILEADV;
      for (let xx = 0; xx < row.length; ++xx) {
        let tile = row[xx];
        let x = x0 + xx * TILEADV;
        drawTile(x, y, z, tile);
      }
    }
    let score = shipCalcScore(temp_ship || ship);
    let style = style_fill_help;
    if (score.done) {
      style = style_fill_help_done;
    }
    font.draw({
      x: x0, w: SHIP_VIS_W - SHIP_PAD,
      y: y0 + SHIPH * TILEADV,
      z: Z.UI + 20,
      align: font.ALIGN.HCENTER,
      text: `Fill for +${score.time} Turns`,
      style,
    });
    font.draw({
      x: x0, w: SHIP_VIS_W - SHIP_PAD,
      y: y0 + SHIPH * TILEADV + ui.font_height + 1,
      z: Z.UI + 20,
      align: font.ALIGN.HCENTER,
      text: `${score.score} Points`,
      style,
    });
    return piece_info;
  }
  function rotate(piece) {
    let { members, h } = piece;
    for (let ii = 0; ii < members.length; ++ii) {
      let member = members[ii];
      let ny = h - member[0] - 1;
      let nx = member[1];
      member[0] = nx;
      member[1] = ny;
    }
  }

  function doShips() {
    let { ships, piece } = game;
    let pos = input.mousePos(mouse_pos);
    let piece_ship = -1;
    if (piece && input.mouse_ever_moved) {
      if (ALLOW_ROTATE && input.click({ button: 2 })) {
        rotate(piece);
      }
      let { w, xoffs } = piece;

      // find cursor midpoint and choose ship
      let mpx = mouse_pos[0] - xoffs + (w * TILEADV - TILE_PAD) / 2;
      if (mpx < SHIPX + SHIP_VIS_W - SHIP_PAD/2) {
        piece_ship = 0;
      } else if (mpx < SHIPX + SHIP_VIS_W * 2 - SHIP_PAD/2) {
        piece_ship = 1;
      } else {
        piece_ship = 2;
      }
    }
    let piece_info;
    for (let ii = 0; ii < ships.length; ++ii) {
      piece_info = doShip(SHIPX + ii * SHIP_VIS_W, SHIPY, ships[ii], piece_ship === ii) || piece_info;
    }
    if (piece && input.mouse_ever_moved) {
      let { members, tile, xoffs, yoffs } = piece;

      let z = Z.UI + 10;
      for (let ii = 0; ii < members.length; ++ii) {
        let [xx, yy] = members[ii];
        let pi = piece_info && piece_info[ii];
        let x = pi ? pi[0] : pos[0] + xx * TILEADV - xoffs;
        let y = pi ? pi[1] : pos[1] + yy * TILEADV - yoffs;
        drawTile(x, y, z, pi ? pi[2] : tile);
        if (pi && pi[2] === SHIP_DAMAGED_PREVIEW) {
          font.draw({
            x, y, w: TILE_SIZE, h: TILE_SIZE,
            z: z + 1,
            align: font.ALIGN.HVCENTERFIT,
            text: '-1 Turn',
            style: style_minus_turn,
            size: ui.font_height / 2,
          });
        }
      }
    }
  }

  let left_mode = 'SCORE';
  const PAD = 4;
  const SCORE_PAD = PAD * 2;
  const scores_bg = vec4(0.2, 0.2, 0.2, 1);
  const SCORE_X = M3X + M3_VIS_W + SCORE_PAD;
  const LEFT_BAR_W = (game_width - M3_VIS_W) / 2;
  const LEFT_BAR_X = 0;
  const LEFT_BUTTON_Y = SHIPY - TILEADV - ui.button_height;
  const SCORE_W = game_width - SCORE_PAD - SCORE_X;
  const LINE_W = 0.4;

  let scores_edit_box;
  function doHighScores() {
    let x = SCORE_X;
    let y = PAD;
    let z = Z.UI;

    if (left_mode === 'NEWGAME') {
      const SCORE_H = SHIPY - TILE_PAD - y;
      ui.drawRect(x, y, x + SCORE_W, y + SCORE_H, z - 1, scores_bg);
    }

    let need_name = score_system.player_name.indexOf('Anonymous') === 0;
    let max_scores = need_name ? 9 : 13; // plus 1 for own score if not on list
    let { level_def } = game;
    let width = SCORE_W;
    let size = ui.font_height;
    let header_size = size; // * 2
    let pad = size;
    font.drawSizedAligned(null, x, y, z, header_size, font.ALIGN.HCENTERFIT, width, 0,
      '            High Scores                  Turns');
    y += header_size + 2;
    ui.drawLine(x + 8, y, x + SCORE_W - 8, y, z, LINE_W, 1, unit_vec);
    y += 2;
    let level_id = level_def.name;
    let scores = score_system.high_scores[level_id];
    let score_style = font.styleColored(null, pico8.font_colors[7]);
    if (!scores) {
      font.drawSizedAligned(score_style, x, y, z, size, font.ALIGN.HCENTERFIT, width, 0,
        'Loading...');
      return;
    }
    let widths = [10, 64, 32, 24];
    let widths_total = 0;
    for (let ii = 0; ii < widths.length; ++ii) {
      widths_total += widths[ii];
    }
    let set_pad = size / 2;
    for (let ii = 0; ii < widths.length; ++ii) {
      widths[ii] *= (width - set_pad * (widths.length - 1)) / widths_total;
    }
    let align = [
      font.ALIGN.HFIT | font.ALIGN.HRIGHT,
      font.ALIGN.HFIT,
      font.ALIGN.HFIT | font.ALIGN.HCENTER,
      font.ALIGN.HFIT | font.ALIGN.HCENTER,
    ];
    function drawSet(arr, style, header) {
      let xx = x;
      for (let ii = 0; ii < arr.length; ++ii) {
        let str = String(arr[ii]);
        font.drawSizedAligned(style, xx, y, z, size, align[ii], widths[ii], 0, str);
        xx += widths[ii] + set_pad;
      }
      y += size;
    }
    // drawSet(['', 'Name', 'Score', 'Turns'], font.styleColored(null, pico8.font_colors[6]), true);
    // y += 4;
    let found_me = false;
    for (let ii = 0; ii < scores.length/* * 20*/; ++ii) {
      let s = scores[ii % scores.length];
      let style = score_style;
      let drawme = false;
      if (s.name === score_system.player_name && !found_me) {
        style = font.styleColored(null, pico8.font_colors[11]);
        found_me = true;
        drawme = true;
      }
      if (ii < max_scores || drawme) {
        drawSet([
          `#${ii+1}`, score_system.formatName(s), `${s.score.score}`,
          s.score.actions
        ], style);
      }
    }
    y += set_pad;
    if (found_me && need_name) {
      if (!scores_edit_box) {
        scores_edit_box = ui.createEditBox({
          z,
          w: game_width / 4,
          placeholder: 'Enter player name',
        });
        if (!need_name) {
          scores_edit_box.setText(score_system.player_name);
        }
      }

      let submit = scores_edit_box.run({
        x,
        y,
      }) === scores_edit_box.SUBMIT;

      if (ui.buttonText({
        x: x + scores_edit_box.w + 4,
        y: y - size * 0.25,
        z,
        w: size * 4,
        h: ui.button_height,
        text: 'Save'
      }) || submit) {
        // scores_edit_box.text
        if (scores_edit_box.text) {
          score_system.updatePlayerName(scores_edit_box.text);
        }
      }
      y += size;
    }

    y += pad;

    // ui.panel({
    //   x: x - pad,
    //   w: game_width / 2 + pad * 2,
    //   y: y0 - pad,
    //   h: y - y0 + pad * 2,
    //   z: z - 1,
    //   color: vec4(0, 0, 0, 1),
    // });

    // ui.menuUp();

  }

  function doLevelSelect() {
    let x = PAD;
    let y = PAD;
    let z = Z.UI2;
    const BUTTON_W = 60;
    font.draw({ x, y, w: BUTTON_W, align: font.ALIGN.HCENTER, text: 'Levels' });
    y += ui.font_height;
    ui.drawLine(x, y, x + BUTTON_W, y, z, LINE_W, 1, unit_vec);
    y += 4;

    function newGame(def, seed, force_new) {
      if (def.saved && !force_new) {
        game = gameFromJSON(def.saved);
      } else {
        game = new Game(def.name, seed);
        saveGame(game);
      }
      if (force_new) {
        left_mode = 'SCORE';
      }
    }

    for (let ii = 0; ii < level_list.length; ++ii) {
      let def = level_list[ii];
      let colors;
      if (def.name === game.level) {
        colors = colors_selected;
        ui.drawRect(x + BUTTON_W/2, y+2, SCORE_X + 1, y + ui.button_height - 2,
          z - 1, scores_bg);
      }
      if (ui.buttonText({ x, y, z, text: def.display_name, w: BUTTON_W, colors })) {
        if (def.name === game.level) {
          ui.modalDialog({
            text: 'Do you wish to restart your current game?',
            buttons: {
              'yes': newGame.bind(null, def, null, true),
              'no': null,
            }
          });
        } else {
          newGame(def, def.default_seed, false);
        }
      }
      let desc_x = x + BUTTON_W + PAD;
      font.draw({
        x: desc_x, w: M3X - desc_x - PAD,
        y, h: ui.button_height,
        z,
        align: font.ALIGN.VCENTER | font.ALIGN.HFIT,
        text: def.time_decrease ? `Diff+ every ${def.time_decrease} Turns` :
          `Constant ${def.base_time} Turns per patch`,
      });
      y += ui.button_height + 2;
    }

    if (ui.buttonText({
      x: LEFT_BAR_X + (LEFT_BAR_W - ui.button_width) / 2,
      y: LEFT_BUTTON_Y,
      z,
      text: 'Cancel',
    })) {
      left_mode = 'SCORE';
    }
  }

  function doLeftBar() {
    let side_size = 20;
    let time_color = game.time_left <= 2 ? 0xFF0000ff :
      game.time_left < 4 ? 0xFFFF00ff : 0xFFFFFFff;
    let time_alpha;
    if (game.time_left === 1) {
      time_alpha = (1 - abs(sin(engine.frame_timestamp * 0.005)));
    }
    let y = 10;
    if (!game.time_left) {
      y += side_size * 0.75;
      font.draw({
        x: LEFT_BAR_X, w: LEFT_BAR_W,
        y,
        align: font.ALIGN.HCENTER,
        text: 'Game Over',
        style: style_score,
        size: side_size,
        color: time_color,
      });
      y += side_size;
    } else {
      font.draw({
        x: LEFT_BAR_X, w: LEFT_BAR_W,
        y,
        align: font.ALIGN.HCENTER,
        text: 'Turns Left',
        size: side_size * 0.75,
        style: style_score,
        color: time_color,
        alpha: time_alpha,
      });
      y += side_size * 0.75;
      font.draw({
        x: LEFT_BAR_X, w: LEFT_BAR_W,
        y,
        align: font.ALIGN.HCENTER,
        text: String(game.time_left),
        size: side_size,
        style: style_score,
        color: time_color,
        alpha: time_alpha,
      });
      y += side_size;
    }
    font.draw({
      x: LEFT_BAR_X, w: LEFT_BAR_W,
      y: y,
      align: font.ALIGN.HCENTER,
      text: `Survived: ${game.actions}`,
      style: style_bottom_hint,
    });
    y += ui.font_height;
    y += 4;
    font.draw({
      x: LEFT_BAR_X, w: LEFT_BAR_W,
      y,
      align: font.ALIGN.HCENTER,
      text: 'Score',
      style: style_score,
      size: side_size * 0.75,
    });
    y += side_size * 0.75;
    font.draw({
      x: LEFT_BAR_X, w: LEFT_BAR_W,
      y,
      align: font.ALIGN.HCENTER,
      text: String(game.score),
      style: style_score,
      size: side_size,
    });
    y += side_size;

    if (ui.buttonText({
      x: LEFT_BAR_X + (LEFT_BAR_W - ui.button_width) / 2,
      y: LEFT_BUTTON_Y,
      z: Z.UI2,
      text: 'Level Select',
    })) {
      left_mode = 'NEWGAME';
    }
  }

  function drawBG() {
    let w = camera2d.wReal();
    let h = camera2d.hReal();
    let extra_v = (h - game_height) / game_height / 2;
    const BG_ASPECT = 16/1024;
    let expected_u = game_width / game_height / BG_ASPECT;
    let extra_u = (w - game_width) / game_width / 2 * expected_u;
    sprites.bg.draw({
      x: camera2d.x0Real(),
      y: camera2d.y0Real(),
      z: 1,
      w, h,
      uvs: [-extra_u, -extra_v, expected_u + extra_u, 1 + extra_v],
    });
  }

  function stateTest(dt) {
    if (left_mode === 'SCORE') {
      doLeftBar();
    } else {
      doLevelSelect();
    }

    if (!game.time_left && !game.dismissed) {
      font.draw({
        x: 0, w: game_width,
        y: -40, h: game_height,
        z: Z.MODAL,
        align: font.ALIGN.HVCENTER,
        text: 'Game Over',
        size: 32,
      });
      if (!game.score) {
        font.draw({
          x: 0, w: game_width,
          y: -10, h: game_height,
          z: Z.MODAL,
          align: font.ALIGN.HVCENTER,
          text: 'Hint: You\'ll need to sometimes imperfectly patch just to finish filling a pattern.',
        });
      }

      if (ui.button({
        x: (game_width - ui.button_width) / 2,
        y: game_height / 2 + 20,
        z: Z.MODAL,
        text: 'I can do better!',
      })) {
        game.dismissed = true;
        saveGame(game);
      }
      ui.menuUp();
    }

    doMatch3();
    doShips();

    let last_size = ui.font_height * 0.8;
    font.draw({
      x: 0, w: game_width,
      y: game_height - 10 - last_size,
      align: font.ALIGN.HCENTER,
      text: `Patching a hole rewards ${game.base_time} turns minus any misses accumulated while patching`,
      size: last_size,
      style: style_bottom_hint,
    });
    if (game.time_decrease && game.base_time > 1) {
      font.draw({
        x: 0, w: game_width,
        y: game_height - 10,
        align: font.ALIGN.HCENTER,
        text: `This reduces to ${game.base_time - 1} in ${game.time_decrease} turns`,
        size: last_size,
        style: style_bottom_hint,
      });
    }

    doHighScores(dt);

    drawBG();
  }

  function testInit(dt) {
    let start_def = level_defs.short;
    if (start_def.saved) {
      game = gameFromJSON(start_def.saved);
    } else {
      game = new Game(start_def.name, start_def.default_seed);
    }
    engine.setState(stateTest);
    stateTest(dt);
  }

  engine.setState(testInit);
}
