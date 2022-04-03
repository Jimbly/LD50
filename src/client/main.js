/*eslint global-require:off*/
const local_storage = require('glov/client/local_storage.js');
local_storage.setStoragePrefix('ld50'); // Before requiring anything else that might load from this

// Useful chars: ⚡ ← →

const { createAnimationSequencer } = require('glov/client/animation.js');
const camera2d = require('glov/client/camera2d.js');
const engine = require('glov/client/engine.js');
const { fscreenAvailable, fscreenActive, fscreenEnter, fscreenExit } = require('glov/client/fscreen.js');
const input = require('glov/client/input.js');
const { abs, floor, max, min, random, round, sin, sqrt } = Math;
const net = require('glov/client/net.js');
const pico8 = require('glov/client/pico8.js');
const { randCreate, mashString } = require('glov/common/rand_alea.js');
const score_system = require('glov/client/score.js');
const settings = require('glov/client/settings.js');
const { soundPlayMusic, soundResumed, FADE } = require('glov/client/sound.js');
const { createSprite, queueraw4, BLEND_ADDITIVE } = require('glov/client/sprites.js');
const textures = require('glov/client/textures.js');
const ui = require('glov/client/ui.js');
const { clamp, clone, easeIn, easeOut, plural, ridx } = require('glov/common/util.js');
const { unit_vec, vec2, v3set, vec4, v4set } = require('glov/common/vmath.js');

window.Z = window.Z || {};
Z.BACKGROUND = 1;
Z.WAVES = 3;
Z.BUBBLES = 5;
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

const FTUE_INIT = 0;
const FTUE_SHOW_SCORE = 1;
const FTUE_SHOW_MULTIPLE_BOARDS = 1;
// 2 is help text
const FTUE_DONE = 3;
const FTUE_SHOW_LEVEL_SELECT = FTUE_DONE;
let ftue = FTUE_INIT;

let right_mode = 'HIGHSCORES';
let left_mode = 'SCORE';

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
      panel: ['ui/panel', [128,256,128], [128,256,128]],
      button: ['ui/button', [128,768,128], [256]],
      button_down: ['ui/button_down', [128,768,128], [256]],
      button_disabled: ['ui/button_disabled', [100,56,100], [128]],
    },
    sound: {
      fade_rate: 0.0001,
    },
    ui_sounds: {
      up: ['up1', 'up2', 'up3', 'up4'],
      down: ['down1', 'down2', 'down3', 'down4'],
      score: 'score',
    },
  })) {
    return;
  }
  font = engine.font;

  gl.clearColor(0, 0.1, 0.3, 1);
  ui.scaleSizes(13 / 32);
  ui.setFontHeight(8);
  ui.setPanelPixelScale(ui.button_height / 256);
  v4set(ui.color_panel, 0.75, 0.75, 1, 1);

  sprites.bg = createSprite({
    name: 'bg',
    wrap_s: gl.REPEAT,
    wrap_t: gl.CLAMP_TO_EDGE,
  });
  sprites.swirl = createSprite({
    name: 'swirl',
    wrap_s: gl.CLAMP_TO_EDGE,
    wrap_t: gl.CLAMP_TO_EDGE,
    origin: vec2(0.5, 0.5),
  });
  sprites.bubble = createSprite({
    name: 'bubble',
    wrap_s: gl.CLAMP_TO_EDGE,
    wrap_t: gl.CLAMP_TO_EDGE,
  });
  sprites.tiles = createSprite({
    name: 'tile',
    ws: [128,128,128,128],
    hs: [128,128],
  });
  textures.load({
    name: 'wave_body',
    url: 'img/wave_body.png',
    wrap_s: gl.REPEAT,
    wrap_t: gl.CLAMP_TO_EDGE,
  });
  textures.load({
    name: 'wave_top',
    url: 'img/wave_top.png',
    wrap_s: gl.REPEAT,
    wrap_t: gl.CLAMP_TO_EDGE,
  });
  sprites.toggles = createSprite({
    name: 'toggles',
    ws: [128,128],
    hs: [128,128,128,128],
  });

  const level_defs = {
    short2: {
      display_name: 'Short', default_seed: 'test',
      time_decrease: 15, initial_turns: 10, base_time: 8,
      variety: 3,
    },
    med2: {
      display_name: 'Medium',
      time_decrease: 25, initial_turns: 12, base_time: 8,
      variety: 4,
    },
    long2: {
      display_name: 'Long',
      time_decrease: 35, initial_turns: 15, base_time: 8,
      variety: 4,
    },
    endless2: {
      display_name: 'Endless',
      initial_turns: 12, base_time: 7,
      variety: 3,
    },
  };
  let level_list = Object.keys(level_defs).map((key) => {
    let def = level_defs[key];
    def.name = key;
    return def;
  });
  for (let ii = 0; ii < level_list.length; ++ii) {
    level_list[ii].idx = ii;
  }

  const style_minus_turn = font.style(null, {
    color: 0xFF0000ff,
    outline_width: 1,
    outline_color: 0xFF0000ff,
    glow_color: 0x000000ff,
    glow_outer: 2.5,
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
  const style_fill_help_worse = font.style(style_fill_help, {
    color: 0xFF5050ff,
  });
  const style_bottom_hint = font.style(style_fill_help, {
    color: 0xDDDDDDff,
    glow_color: 0x00000090,
  });
  ui.font_style_focused = ui.font_style_normal;

  const style_score = font.style(null, {
    color: 0xFFFFFFff,
    glow_color: 0x00008033,
    glow_xoffs: 0,
    glow_yoffs: 0,
    glow_inner: 0,
    glow_outer: 5,
  });

  const style_high_scores = font.style(null, {
    color: 0xFFFFFFff,
    glow_color: 0x00000033,
    glow_xoffs: 0,
    glow_yoffs: 0,
    glow_inner: 0,
    glow_outer: 3,
  });
  const style_level_select = style_high_scores;

  function encodeScore(score) {
    let actions = min(score.actions, 99999);
    return ((score.score || 0) * 100000 + actions) * 10000 + score.ships;
  }

  function parseScore(value) {
    let score = floor(value / (100000 * 10000));
    value -= score * 100000 * 10000;
    let actions = floor(value / 10000);
    value -= actions * 10000;
    let ships = value;
    return {
      score,
      actions,
      ships,
    };
  }

  score_system.init(encodeScore, parseScore, level_list, 'LD50');
  score_system.updateHighScores();

  const M3W = 8;
  const M3H = 7;
  const M3COLORS = [
    // pico8.colors[8],
    // pico8.colors[11],
    // pico8.colors[9],
    // pico8.colors[15],

    //vec4(1,0.5,0.5,1),
    vec4(0.5,1,0.5,1),
    vec4(0.5,0.5,1,1),
    vec4(1,0.6,0.5,1),
    vec4(1.0,0.5,1,1),

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
    let ship_idx = game.num_ships++;
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
    // clear some border pieces
    {
      let chance = ship_idx === 0 ? 1.0 : ship_idx === 1 ? 0.5 : 0.05;
      let to_clear = [];
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
            if (neighbors !== 4 && rand.random() < chance) {
              to_clear.push([xx,yy]);
            }
          }
        }
      }
      to_clear.forEach((pair) => {
        board[pair[1]][pair[0]] = SHIP_BORDER;
      });
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
        row.push(rand.range(level_def.variety));
      }
      game.m3board.push(row);
    }
    game.ships = [];
    game.num_ships = 0;
    for (let ii = 0; ii < NUM_SHIPS; ++ii) {
      game.ships.push(newShip(game));
    }
    let t = game.ships[0];
    game.ships[0] = game.ships[1];
    game.ships[1] = t;
    game.piece = null;
    game.score = 0;
    game.ships_scored = 0;
    game.actions = 0;
    game.time_left = level_def.initial_turns || 10;
    game.dismissed = false;
    // For fading in/out
    game.old_ships = [];
    game.ship_anims = [];
    game.ship_alpha = [];
  }
  const SER_FIELDS = [
    'level',
    'm3board',
    'ships',
    'piece',
    'score',
    'ships_scored',
    'actions',
    'time_left',
    'dismissed',
    'time_decrease',
    'num_ships',
    'base_time',
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
      ftue = FTUE_DONE;
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

  let m3anim = {};
  let anim_offs;

  function m3clearTile(board, x, y) {
    anim_offs[x] = (anim_offs[x] || 0) + 1;
    while (y > 0) {
      if (m3anim[[x,y-1]]) {
        m3anim[[x,y]] = m3anim[[x,y-1]] + 1;
        delete m3anim[[x,y-1]];
      } else {
        m3anim[[x,y]] = 1;
      }
      board[y][x] = board[y-1][x];
      y--;
    }
    board[0][x] = game.rand.range(game.level_def.variety);
    m3anim[[x,0]] = anim_offs[x];
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
    ui.playUISound('up');
    saveGame(game);
  }

  let color_temp = vec4(1,1,1,1);
  let color_swirl = vec4(0, 0, 0.25, 1);
  let rand_cache = [];
  function drawTile(x, y, z, tile, alpha) {
    let color = M3COLORS[tile] || SHIP_COLORS[tile];
    if (!color) {
      return;
    }
    if (alpha === undefined) {
      alpha = 1;
    }
    let frame = tile >= 0 ? tile : 0;
    x -= TILE_PAD/2;
    y -= TILE_PAD/2;
    // background
    color_temp[3] = alpha;
    if (tile === SHIP_EMPTY) {
      color_swirl[3] = alpha;
      let randidx = x * 100000 + y;
      let r1 = rand_cache[randidx];
      let r2 = rand_cache[randidx + 0.5];
      if (!r1) {
        r1 = rand_cache[randidx] = random();
        r2 = rand_cache[randidx + 0.5] = random();
      }
      sprites.swirl.draw({
        x: x + TILEADV/2, y: y + TILEADV/2, z: z + 1,
        w: TILE_SIZE, h: TILE_SIZE,
        color: color_swirl,
        rot: engine.frame_timestamp * -0.001 * (1 + r1 * 0.5),
        blend: BLEND_ADDITIVE,
      });
      sprites.swirl.draw({
        x: x + TILEADV/2, y: y + TILEADV/2, z: z + 2,
        w: TILE_SIZE, h: TILE_SIZE,
        color: color_swirl,
        rot: engine.frame_timestamp * 0.001 * (1 + r2 * 0.5) + 1.3*r2,
        blend: BLEND_ADDITIVE,
      });
      v3set(color_temp, 0.5, 0.5, 1);
    } else {
      v3set(color_temp, 1,1,1);
    }
    sprites.tiles.draw({
      x, y,
      w: TILEADV, h: TILEADV,
      z: z - 1,
      frame,
      color: color_temp,
    });
    // foreground
    color[3] = alpha;
    sprites.tiles.draw({
      x, y,
      w: TILEADV, h: TILEADV,
      z,
      frame: frame + 4,
      color,
    });
    //ui.drawRect(x, y, x + TILE_SIZE, y + TILE_SIZE, z, color);
    color[3] = 1;
  }

  const M3_VIS_W = TILEADV * M3W - TILE_PAD;
  const M3X = (game_width - M3_VIS_W) / 2;
  const M3Y = TILE_SIZE;
  function doMatch3() {
    for (let key in m3anim) {
      let v = m3anim[key] - engine.frame_dt * 0.01;
      if (v < 0) {
        delete m3anim[key];
      } else {
        m3anim[key] = v;
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
        let animv = m3anim[[xx,yy]] || 0;
        draw_y -= animv * TILEADV;
        drawTile(x, draw_y, z, tile);
        let click_param = {
          x: x - TILE_PAD/2,
          y: y - TILE_PAD/2,
          w: TILEADV, h: TILEADV,
        };
        let click;
        if (game.piece || !game.time_left || left_mode === 'NEWGAME') {
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
    let is_perfect = true;
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
        if (board[y][x] !== SHIP_BORDER) {
          is_perfect = false;
        }
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
      time: max(1, game.base_time/* - (ship.miss || 0)*/),
      done: !count[SHIP_EMPTY],
      score,
      is_perfect,
    };
  }

  let floaters = [];

  let floater_offs;
  function floaterAdd(ship_idx, msg, style) {
    floaters.push({
      ship_idx, msg,
      floater_offs,
      time: engine.frame_timestamp + floater_offs * 250,
      style,
    });
    ++floater_offs;
  }

  const FLOATER_TIME = 2000;
  function floatersDraw(idx, x, y, w) {
    for (let ii = floaters.length - 1; ii >= 0; --ii) {
      let floater = floaters[ii];
      let dt = engine.frame_timestamp - floater.time;
      let progress = dt / FLOATER_TIME;
      if (progress < 0) {
        continue;
      }
      if (progress >= 1) {
        ridx(floaters, ii);
        continue;
      }
      if (floater.ship_idx === idx) {
        font.draw({
          x, w,
          y: y - easeOut(progress, 2) * 30 + TILE_SIZE * 2 + floater.floater_offs * 5,
          z: Z.UI2 + 10,
          align: font.ALIGN.HCENTER | font.ALIGN.HWRAP,
          text: floater.msg,
          size: ui.font_size * 2,
          style: floater.style,
          alpha: 1 - progress,
        });
      }
    }
  }

  let style_floater = font.style(null, {
    color: 0x000000ff,
    outline_color: 0x000000ff,
    outline_width: 2,
    glow_color: 0xFFFFFF80,
    glow_outer: 5,
  });
  const style_floater_perfect = font.style(style_floater, {
    color: 0xFFFF00ff,
    outline_color: 0xDDDDDDff,
    glow_color: 0x00FF00ff,
  });
  const style_floater_good = font.style(style_floater, {
    color: 0x00FF00ff,
    outline_color: 0x00FF00ff,
    glow_color: 0x002000ff,
  });
  const style_floater_fine = font.style(style_floater, {
    color: 0x0000FFff,
    outline_color: 0x0000FFff,
    glow_color: 0x0000FFff,
  });

  function removeShip(ship, score) {
    if (ftue < FTUE_SHOW_MULTIPLE_BOARDS) {
      ftue = FTUE_SHOW_MULTIPLE_BOARDS;
    }
    if (ftue < FTUE_SHOW_SCORE) {
      ftue = FTUE_SHOW_SCORE;
    }
    if (game.score) {
      // second+ scoring
      if (ftue < FTUE_DONE) {
        ftue++;
      }
    }
    game.time_left += score.time;
    let idx = game.ships.indexOf(ship);
    game.old_ships[idx] = ship;
    game.ships[idx] = newShip(game);
    game.score += score.score;
    game.ships_scored++;
    let anim = game.ship_anims[idx] = createAnimationSequencer();
    game.ship_alpha[idx] = 1;
    let t = anim.add(0, 1000, (progress) => {
      game.ship_alpha[idx] = easeIn(1 - progress, 2);
    });
    anim.add(t, 300, (progress) => {
      game.old_ships[idx] = null;
      game.ship_alpha[idx] = easeOut(progress, 2);
    });
    floater_offs = 0;
    if (ship.miss < 1 && score.is_perfect) {
      floaterAdd(idx, 'Perfect!', style_floater_perfect);
    } else if (ship.miss < 2) {
      floaterAdd(idx, 'Excellent!', style_floater_good);
    } else if (ship.miss < 3) {
      floaterAdd(idx, 'Good!', style_floater_good);
    } else if (ship.miss < 5) {
      floaterAdd(idx, 'Fine!', style_floater_fine);
    } else {
      floaterAdd(idx, 'Botched!', style_floater);
    }
    floaterAdd(idx, `+${score.time}⚡`, style_floater_good);
    if (ftue >= FTUE_SHOW_SCORE) {
      floaterAdd(idx, `+${score.score} Points`, style_floater_good);
    }
  }

  function placePiece(ship) {
    ui.playUISound('down');
    // actual pieces placed while drawing
    game.actions++;
    game.piece = null;
    game.time_left = max(0, game.time_left - 1);
    let score = shipCalcScore(ship);
    if (score.done) {
      // remove and score ship
      ui.playUISound('score');
      removeShip(ship, score);
    }
    score_system.setScore(game.level_def.idx,
      { score: game.score, actions: game.actions, ships: game.ships_scored }
    );
    score_system.updateHighScores();
    if (game.time_decrease) {
      --game.time_decrease;
      if (!game.time_decrease) {
        game.time_decrease = game.level_def.time_decrease;
        game.base_time = max(1, game.base_time - 1);
      }
    }
    saveGame(game);
  }

  function missesToTurnLoss(num_misses) {
    return round(sqrt(num_misses));
  }

  const SHIP_PAD = TILEADV * 3;
  const SHIP_VIS_W = TILEADV * SHIPW + SHIP_PAD;
  const SHIPX = (game_width - (SHIP_VIS_W * NUM_SHIPS - SHIP_PAD)) / 2;
  const SHIPY = M3Y + TILEADV * M3H + TILE_SIZE;
  let mouse_pos = vec2();
  let action_turn_preview;
  function doShip(alpha, x0, y0, ship, do_piece) {
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
        let num_misses = 0;
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
          if (existing !== SHIP_EMPTY && existing !== SHIP_DAMAGED) {
            place = SHIP_DAMAGED;
            zz--;
            // color = SHIP_COLORS[SHIP_DAMAGED];
            member_info.push(SHIP_DAMAGED_PREVIEW);
            num_misses++;
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
        if (num_misses) {
          let dt = missesToTurnLoss(num_misses);
          temp_ship.miss += dt;
          if (do_place) {
            ship.miss += dt;
            game.time_left = max(0, game.time_left - dt);
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
        drawTile(x, y, z, tile, alpha);
      }
    }
    let orig_score = shipCalcScore(ship);
    let score = shipCalcScore(temp_ship || ship);
    if (score.done && do_piece) {
      action_turn_preview += score.time;
    }
    let y = y0 + SHIPH * TILEADV + 2;
    font.draw({
      x: x0, w: SHIP_VIS_W - SHIP_PAD,
      y,
      z: Z.UI + 20,
      align: font.ALIGN.HCENTER,
      text: orig_score.time !== score.time ?
        `+${orig_score.time} → +${score.time}⚡` :
        `+${score.time}⚡`,
      style:
        score.time < orig_score.time ? style_fill_help_worse :
        score.done ? style_fill_help_done :
        style_fill_help,
      alpha,
    });
    y += ui.font_height + 2;
    if (ftue >= FTUE_SHOW_SCORE) {
      font.draw({
        x: x0, w: SHIP_VIS_W - SHIP_PAD,
        y,
        z: Z.UI + 20,
        align: font.ALIGN.HCENTER,
        text: orig_score.score !== score.score ?
          `${orig_score.score} → ${score.score} Points` :
          `${score.score} Points`,
        style:
          score.score < orig_score.score ? style_fill_help_worse :
          score.done ? style_fill_help_done :
          style_fill_help,
        alpha,
      });
    }
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
    action_turn_preview = 0;
    let { ships, piece, old_ships, ship_alpha, ship_anims } = game;
    let pos = input.mousePos(mouse_pos);
    let piece_ship = -1;
    let do_piece = piece && input.mouse_ever_moved &&
      left_mode !== 'NEWGAME' && !ui.isMenuUp();
    let one_ship = ftue < FTUE_SHOW_MULTIPLE_BOARDS;
    if (do_piece) {
      if (ALLOW_ROTATE && input.click({ button: 2 })) {
        rotate(piece);
      }
      let { w, xoffs } = piece;

      // find cursor midpoint and choose ship
      let mpx = mouse_pos[0] - xoffs + (w * TILEADV - TILE_PAD) / 2;
      if (one_ship) {
        piece_ship = 1;
      } else if (mpx < SHIPX + SHIP_VIS_W - SHIP_PAD/2) {
        piece_ship = 0;
      } else if (mpx < SHIPX + SHIP_VIS_W * 2 - SHIP_PAD/2) {
        piece_ship = 1;
      } else {
        piece_ship = 2;
      }
    }

    if (ftue >= FTUE_SHOW_SCORE && false) {
      font.draw({
        x: 4, w: 40,
        y: SHIPY + SHIPH * TILEADV + 3, h: ui.font_height * 2 + 1,
        z: Z.UI + 20,
        align: font.ALIGN.HVCENTER | font.ALIGN.HWRAP,
        text: 'Fix leak\nreward:',
        style: style_fill_help,
      });
    }

    let piece_info;
    for (let ii = one_ship ? 1 : 0; ii < (one_ship ? 2 : ships.length); ++ii) {
      let ship = ships[ii];
      let piece_on_this_ship = piece_ship === ii;
      let alpha = 1;
      if (ship_anims[ii]) {
        if (!ship_anims[ii].update(engine.frame_dt)) {
          ship_anims[ii] = null;
        }
      }
      let yoffs = 0;
      if (old_ships[ii]) {
        piece_on_this_ship = false;
        ship = old_ships[ii];
        alpha = ship_alpha[ii];
        yoffs = (1-alpha) * SHIP_VIS_W;
      } else if (ship_anims[ii]) {
        alpha = ship_alpha[ii];
      }
      let ship_x = SHIPX + ii * SHIP_VIS_W;
      floatersDraw(ii, ship_x, SHIPY, SHIP_VIS_W - SHIP_PAD - TILE_PAD);
      piece_info = doShip(alpha, ship_x, SHIPY + yoffs,
        ship, piece_on_this_ship) || piece_info;
    }
    if (do_piece) {
      let { members, tile, xoffs, yoffs } = piece;

      let z = Z.UI + 10;
      let xmin = Infinity;
      let xmax = -Infinity;
      let ymin = Infinity;
      let ymax = -Infinity;
      let num_misses = 0;
      for (let ii = 0; ii < members.length; ++ii) {
        let [xx, yy] = members[ii];
        let pi = piece_info && piece_info[ii];
        let x = pi ? pi[0] : pos[0] + xx * TILEADV - xoffs;
        let y = pi ? pi[1] : pos[1] + yy * TILEADV - yoffs;
        xmin = min(xmin, x);
        xmax = max(xmax, x);
        ymin = min(ymin, y);
        ymax = max(ymax, y);
        drawTile(x, y, z, pi ? pi[2] : tile);
        if (pi && pi[2] === SHIP_DAMAGED_PREVIEW) {
          num_misses++;
        }
      }
      if (piece_info) {
        action_turn_preview--;
      }
      if (num_misses) {
        let text_y = ymax < SHIPY + TILEADV * (SHIPH - 2) ?
          ymax + TILEADV + TILE_PAD :
          ymin - TILE_PAD * 2 - ui.font_height;
        let text_x =(xmin + xmax + TILE_SIZE) / 2;
        let dt = missesToTurnLoss(num_misses);
        action_turn_preview -= dt;
        let w = font.draw({
          x: text_x, w: 0,
          y: text_y,
          z: z + 22,
          align: font.ALIGN.HCENTER,
          text: `${num_misses} ${num_misses > 1 ? 'errors' : 'error'}, -${dt} ${plural(dt, 'Turn')}`,
          style: style_minus_turn,
        });
        w = w / 2 + TILE_PAD;
        ui.drawRect(text_x - w, text_y - TILE_PAD,
          text_x + w, text_y + ui.font_height + TILE_PAD,
          z + 21, [1,1,1,0.5]);
      }
    }
  }

  let help_page = null;

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

    if (left_mode === 'NEWGAME' || !game.time_left && game.dismissed) {
      const SCORE_H = SHIPY - TILE_PAD - y;
      ui.drawRect(x, y - 2, x + SCORE_W, y + SCORE_H, z - 1, scores_bg);
    }

    let need_name = score_system.player_name.indexOf('Anonymous') === 0;
    let max_scores = need_name ? 9 : 13; // plus 1 for own score if not on list
    let { level_def } = game;
    let width = SCORE_W;
    let size = ui.font_height;
    let header_size = size; // * 2
    let pad = size;
    font.drawSizedAligned(style_high_scores, x, y, z, header_size, font.ALIGN.HCENTERFIT, width, 0,
      'High Scores');
    y += header_size + 2;
    ui.drawLine(x + 8, y, x + SCORE_W - 8, y, z, LINE_W, 1, unit_vec);
    y += 2;
    let level_id = level_def.name;
    let scores = score_system.high_scores[level_id];
    let score_style = font.styleColored(style_high_scores, pico8.font_colors[7]);
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
    // drawSet(['', 'Name', 'Score', 'Turns'], font.styleColored(style_high_scores, pico8.font_colors[6]), true);
    // y += 4;
    let found_me = false;
    for (let ii = 0; ii < scores.length/* * 20*/; ++ii) {
      let s = scores[ii % scores.length];
      let style = score_style;
      let drawme = false;
      if (s.name === score_system.player_name && !found_me) {
        style = font.styleColored(style_high_scores, pico8.font_colors[11]);
        found_me = true;
        drawme = true;
      }
      if (ii < max_scores || drawme) {
        drawSet([
          `#${ii+1}`, score_system.formatName(s), `${s.score.score}`,
          `${s.score.actions}⚡`
        ], style);
      }
    }
    y += set_pad;
    if (found_me && need_name && !ui.isMenuUp()) {
      if (!scores_edit_box) {
        scores_edit_box = ui.createEditBox({
          z,
          w: game_width / 5,
          placeholder: 'Enter player name',
        });
        if (!need_name) {
          scores_edit_box.setText(score_system.player_name);
        }
      }

      let submit = scores_edit_box.run({
        x: x + PAD,
        y,
      }) === scores_edit_box.SUBMIT;

      if (ui.buttonText({
        x: x + scores_edit_box.w + PAD * 2,
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
    if (!need_name) {
      if (ftue < FTUE_DONE) {
        ftue = FTUE_DONE;
      }
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

  const MAX_HELP_PAGE = 4;
  function doHelp() {
    let x = SCORE_X;
    let y = PAD + TILE_SIZE;
    let z = Z.UI;
    let w = SCORE_W;

    let text = `Help text here ${ftue}`;

    let page = help_page !== null ? help_page : ftue;

    if (page === 0) {
      text = 'Welcome to Carpentangle\n\n' +
        'You ship is sinking!  Luckily, you were transporting a shipment of match-3 games,' +
        ' so you can use those pieces to plug the leak.';
    } else if (page === 1) {
      text = 'Plugging a leak will give you a little more time.\n\n' +
        'Hint: You don\'t need to fix every leak perfectly, 1 or 2 errors on a placement' +
        ' will only cost you an extra turn, which might be better than spending many turns' +
        ' using smaller pieces.';
    } else if (page === 2) {
      text = 'Larger errors will cost more turns!  Watch out for those inevitable giant pieces!'+
        '\n\n' +
        '1-2 errors → -1⚡\n' +
        '3-6 errors → -2⚡\n' +
        '7-12 errors → -3⚡\n' +
        '13-20 errors → -4⚡\n' +
        '21-30 errors → -5⚡\n';
    } else if (page === 3) {
      text = 'Score is increased for more connected tiles of the same color (excluding damaged tiles).\n\n' +
        'Damaged (dark red) tiles do NOT need to be filled in to fix a leak, however there is' +
        ' no penalty for placing over a damaged tile, and doing so may increase your score!';
    } else if (page === 4) {
      text = 'Different modes have a different feel.\n\n' +
        'Endless mode keeps a constant difficulty, but is only actually "endless" if you\'re good!\n\n' +
        'Medium and Long modes include 4 colors!';
    }

    font.draw({
      x, y, z, w,
      align: font.ALIGN.HCENTER | font.ALIGN.HWRAP,
      text,
    });
  }

  let is_first_new_game = true;

  function doLevelSelect() {
    let x = PAD;
    let y = PAD;
    let z = Z.UI2;
    const BUTTON_W = 50;
    font.draw({ x, y, w: BUTTON_W, align: font.ALIGN.HCENTER, text: 'Modes', style: style_level_select });
    y += ui.font_height;
    ui.drawLine(x, y, x + BUTTON_W, y, z, LINE_W, 1, unit_vec);
    y += 4;

    function newGame(def, seed, force_new) {
      game = null;
      if (def.saved && !force_new) {
        game = gameFromJSON(def.saved);
        if (!game.time_left) {
          game = null;
        }
      }
      if (!game) {
        if (is_first_new_game) {
          is_first_new_game = false;
          seed = def.default_seed;
        }
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
          if (!game.time_left) {
            newGame(def, null, true);
          } else {
            ui.modalDialog({
              text: 'Do you wish to restart your current game?',
              buttons: {
                'yes': newGame.bind(null, def, null, true),
                'no': null,
              }
            });
          }
        } else {
          newGame(def, def.default_seed, false);
        }
      }
      let desc_x = x + BUTTON_W + PAD/2;
      const size = 6;
      if (def.variety === 3) {
        sprites.tiles.draw({
          x: desc_x, y,
          w: size, h: size, z,
          frame: 0, color: M3COLORS[0],
        });
        sprites.tiles.draw({
          x: desc_x + size, y,
          w: size, h: size, z,
          frame: 1, color: M3COLORS[1],
        });
        sprites.tiles.draw({
          x: desc_x + size/2, y: y + size,
          w: size, h: size, z,
          frame: 2, color: M3COLORS[2],
        });
      } else {
        sprites.tiles.draw({
          x: desc_x, y,
          w: size, h: size, z,
          frame: 0, color: M3COLORS[0],
        });
        sprites.tiles.draw({
          x: desc_x + size, y,
          w: size, h: size, z,
          frame: 1, color: M3COLORS[1],
        });
        sprites.tiles.draw({
          x: desc_x, y: y + size,
          w: size, h: size, z,
          frame: 2, color: M3COLORS[2],
        });
        sprites.tiles.draw({
          x: desc_x + size, y: y + size,
          w: size, h: size, z,
          frame: 3, color: M3COLORS[3],
        });
      }
      desc_x += size*2 + PAD/2;
      font.draw({
        x: desc_x, w: M3X - desc_x - PAD,
        y, h: ui.button_height,
        z,
        align: font.ALIGN.VCENTER | font.ALIGN.HFIT,
        text: def.time_decrease ? `Difficulty↑ every ${def.time_decrease}⚡` :
          `Constant ${def.base_time}⚡ per leak`,
        style: style_level_select,
      });
      y += ui.button_height + 2;
    }

    if (ui.buttonText({
      x: LEFT_BAR_X + (LEFT_BAR_W - ui.button_width) / 2,
      y: LEFT_BUTTON_Y,
      z,
      text: game.actions ? 'Resume Game' : 'Let\'s go!',
    })) {
      left_mode = 'SCORE';
    }
  }

  function doLeftBar() {
    let side_size = 20;
    let preview_time_left = max(0, game.time_left + action_turn_preview);
    let time_color = preview_time_left <= 2 ? 0xFF0000ff :
      preview_time_left < 4 ? 0xFFFF00ff : 0xFFFFFFff;
    let time_alpha;
    if (game.time_left === 1 && !preview_time_left ||
      preview_time_left === 0 && game.time_left > 0
    ) {
      time_alpha = (1 - abs(sin(engine.frame_timestamp * 0.008)));
    }
    let y = 8;
    if (!game.time_left) {
      ftue = FTUE_DONE;
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
        text: action_turn_preview ?
          `${game.time_left}⚡ → ${preview_time_left}⚡` :
          `${game.time_left}⚡`,
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
      text: `Survived: ${game.actions}${game.time_left ? '' : '⚡'}`,
      style: style_bottom_hint,
    });
    y += ui.font_height;
    y += 4;
    if (ftue >= FTUE_SHOW_SCORE) {
      font.draw({
        x: LEFT_BAR_X, w: LEFT_BAR_W,
        y,
        align: font.ALIGN.HCENTER,
        text: 'Score',
        style: style_score,
        size: side_size * 0.75,
      });
    }
    y += side_size * 0.75;
    if (ftue >= FTUE_SHOW_SCORE) {
      font.draw({
        x: LEFT_BAR_X, w: LEFT_BAR_W,
        y,
        align: font.ALIGN.HCENTER,
        text: String(game.score),
        style: style_score,
        size: side_size,
      });
    }
    y += side_size;
    if (ftue >= FTUE_SHOW_SCORE && game.ships_scored) {
      font.draw({
        x: LEFT_BAR_X, w: LEFT_BAR_W,
        y: y,
        align: font.ALIGN.HCENTER,
        text: `Plugged ${game.ships_scored} ${plural(game.ships_scored, 'leak')}`,
        style: style_bottom_hint,
      });
      y += ui.font_height;
    }

    if (ftue >= FTUE_SHOW_LEVEL_SELECT && ui.buttonText({
      x: LEFT_BAR_X + (LEFT_BAR_W - ui.button_width) / 2,
      y: LEFT_BUTTON_Y,
      z: Z.UI2,
      text: game.time_left ? 'Mode Select' : 'Mode Select (Restart)',
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
      z: Z.BACKGROUND,
      w, h,
      uvs: [-extra_u, -extra_v, expected_u + extra_u, 1 + extra_v],
    });
  }

  let last_music_time = -Infinity;
  let last_music_song;
  const MUSIC_VOLUME = 0.2;
  const songs = [
    'song3-bass.mp3',
    'song3-90.mp3',
    'song3-120.mp3',
  ];
  function updateMusic(level) {
    if (!soundResumed() || !settings.music) {
      return;
    }
    let time_since_music_change = engine.frame_timestamp - last_music_time;
    let song_idx = 0;
    if (level > 0.5) {
      song_idx = floor((level - 0.5) * 2 * (songs.length-1)) + 1;
    }
    if (!game.time_left) {
      song_idx = 1;
    }
    let desired_song = songs[song_idx];
    if (last_music_song === desired_song) {
      return;
    }
    if (time_since_music_change < 10000) {
      return;
    }
    soundPlayMusic(desired_song, MUSIC_VOLUME, FADE);
    last_music_time = engine.frame_timestamp;
    last_music_song = desired_song;
  }

  let last_level = 0;
  let last_level_eff = 0;
  let desired_level = 0;
  let level_change_time;
  const LEVEL_TRANS_TIME = 1000;
  function updateWavesLevel() {
    let eff_max = game.level_def.initial_turns * 1.5;
    let level = (eff_max - game.time_left) / eff_max;
    level = clamp(level, 0.01, 0.95);
    if (level !== desired_level) {
      last_level = last_level_eff;
      level_change_time = engine.frame_timestamp;
      desired_level = level;
    }
    if (desired_level !== last_level) {
      let progress = (engine.frame_timestamp - level_change_time) / LEVEL_TRANS_TIME;
      if (progress >= 1) {
        last_level_eff = level = last_level = desired_level;
      } else {
        let delta = desired_level - last_level;
        level = last_level_eff = last_level + delta * easeOut(progress, 2);
      }
    } else {
      updateMusic(level);
      level = last_level;
    }
    return level;
  }
  const WAVES_SPLITS = 64;
  // const water_color = vec4(0.016, 0.047, 0.157, 1);
  const WAVE_H = 10;
  const WAVES = [
    [0.021, 0.2, 1.2],
    [0.039, 0.1, 1],
    [0.087, 0.13, 0.25],
    [0.027, -0.18, 0.12],
  ];
  function waveAt(xvalue) {
    let ret = 0;
    for (let ii = 0; ii < WAVES.length; ++ii) {
      let wave = WAVES[ii];
      ret += sin((xvalue + engine.frame_timestamp * wave[1]) * wave[0]) * WAVE_H * wave[2];
    }
    return ret;
  }
  const WAVE_TOP_H = 3;
  const wave_color_regular = vec4(0.043, 0.129, 0.424,1);
  const wave_color_final = vec4(0.3, 0.05, 0.1,1);
  const bubble_color = vec4(0.8, 0.9, 1.0, 1);
  const BUBBLE_ALPHA = 0.125;
  const MAX_BUBBLES = 100;
  let bubbles = [];
  function drawWaves() {
    let x0 = camera2d.x0Real();
    let x1 = camera2d.x1Real();
    let y1 = camera2d.y1Real();
    let level = updateWavesLevel();
    let y0 = game_height * (1 - level);
    // ui.drawLine(x0, y0, x1, y0, Z.WAVES + 1, 2, 0, [1,1,1,1]);
    // ui.drawRect(x0, y, x1, y1, Z.WAVES, water_color);

    let SPLIT_W = (x1 - x0) / WAVES_SPLITS;
    let last_x = x0;
    let last_wave = waveAt(last_x);
    for (let ii = 0; ii < WAVES_SPLITS; ++ii) {
      let xx0 = last_x;
      let xx1 = x0 + (ii + 1) * SPLIT_W;
      let wave = waveAt(xx1);
      let y = y0;
      queueraw4([textures.textures.wave_body],
        xx0, y + last_wave,
        xx0, y1,
        xx1, y1,
        xx1, y + wave,
        Z.WAVES,
        0, 0, 1, 1,
        game.time_left === 1 ? wave_color_final : wave_color_regular);
      queueraw4([textures.textures.wave_top],
        xx0, y + last_wave - WAVE_TOP_H,
        xx0, y + last_wave + WAVE_TOP_H,
        xx1, y + wave + WAVE_TOP_H,
        xx1, y + wave - WAVE_TOP_H,
        Z.WAVES + 0.5,
        0, 0, 1, 1,
        unit_vec);
      last_x = xx1;
      last_wave = wave;
    }

    let is_startup = bubbles.length === 0;
    while (bubbles.length < MAX_BUBBLES) {
      bubbles.push({
        x: random(),
        y: (is_startup ? random() : 1) * 1.2,
        r: (1 + random()) * 5,
        speed: (1 + random()) * 0.0001,
        a: 0.5 + random() * 0.5,
      });
    }
    let h = camera2d.hReal();
    let cam_y0 = camera2d.y0Real();
    for (let ii = bubbles.length - 1; ii >= 0; --ii) {
      let bubble = bubbles[ii];
      bubble.y -= bubble.speed * engine.frame_dt;
      if (bubble.y < 0) {
        ridx(bubbles, ii);
        continue;
      }
      let y = cam_y0 + h * bubble.y;
      let x = x0 + bubble.x * (x1 - x0) + sin(engine.frame_timestamp * 0.001 + bubble.r) * 4;
      let wy = y0 + waveAt(x);
      let dist_to_wave = y - wy;
      if (dist_to_wave < 0) {
        continue;
      }
      bubble_color[3] = easeOut(min(dist_to_wave * 0.005, 1), 2) * BUBBLE_ALPHA * bubble.a;
      sprites.bubble.draw({
        x, y, z: Z.BUBBLES,
        w: bubble.r, h: bubble.r,
        color: bubble_color,
      });
    }
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
      if (game.ships_scored <= 3) {
        font.draw({
          x: 0, w: game_width,
          y: -10, h: game_height,
          z: Z.MODAL,
          align: font.ALIGN.HVCENTER,
          text: 'Hint: You\'ll need to sometimes imperfectly fill just to finish plugging a leak.',
        });
      } else {
        font.draw({
          x: 0, w: game_width,
          y: -10, h: game_height,
          z: Z.MODAL,
          align: font.ALIGN.HVCENTER,
          text: 'Try a different or easier mode, or try again and compete for the high score!'
        });
      }

      if (ui.button({
        x: (game_width - ui.button_width) / 2,
        y: game_height / 2 + 20,
        z: Z.MODAL,
        text: game.ships_scored <= 3 ? 'I can do better!' : 'Let\'s do this!',
      })) {
        game.dismissed = true;
        saveGame(game);
      }
      ui.menuUp();
    }

    doMatch3();
    doShips();

    let last_size = ui.font_height * 0.8;
    // font.draw({
    //   x: 0, w: game_width,
    //   y: game_height - 10 - last_size,
    //   align: font.ALIGN.HCENTER,
    //   text: `Completely plugging a leak rewards ${game.base_time}⚡`,
    //   size: last_size,
    //   style: style_bottom_hint,
    // });
    if (game.time_decrease && game.base_time > 1 && (ftue >= FTUE_SHOW_SCORE || game.time_decrease < 4)) {
      font.draw({
        x: 0, w: game_width,
        y: game_height - 10,
        align: font.ALIGN.HCENTER,
        text: `Reward for plugging a leak reduces to ${game.base_time - 1}⚡ in` +
          ` ${game.time_decrease}⚡`,
        size: last_size,
        style: style_bottom_hint,
      });
    }

    {
      let w = ui.button_height;
      {
        let y = game_height - w;
        let x = game_width - ui.button_height;
        if (ui.buttonImage({ x, y, w, img: sprites.toggles, frame: settings.music ? 0 : 1 })) {
          settings.set('music', 1 - settings.music);
        }
        x -= ui.button_height + 2;
        if (ui.buttonImage({ x, y, w, img: sprites.toggles, frame: settings.sound ? 2 : 3 })) {
          settings.set('sound', 1 - settings.sound);
        }
        x -= ui.button_height + 2;
        if (fscreenAvailable()) {
          if (ui.buttonImage({ x, y, w, img: sprites.toggles, frame: 4 })) {
            if (fscreenActive()) {
              fscreenExit();
            } else {
              fscreenEnter();
            }
          }
          x -= ui.button_height + 2;
        }
      }
      if (ftue < FTUE_DONE) {
        doHelp();
      } else if (left_mode === 'NEWGAME') {
        doHighScores();
      } else {
        let x = game_width - ui.button_height;
        let y = 0;
        if (ui.buttonText({ x, y, w, text: right_mode === 'HIGHSCORES' ? '?' : 'X' })) {
          if (right_mode === 'HIGHSCORES') {
            right_mode = 'HELP';
            if (help_page === null) {
              help_page = 3;
            }
          } else {
            right_mode = 'HIGHSCORES';
          }
        }
        x -= ui.button_height + 2;
        if (right_mode === 'HIGHSCORES') {
          doHighScores();
        } else if (right_mode === 'HELP') {
          if (help_page < MAX_HELP_PAGE && ui.buttonText({ x, y, w, text: '→' })) {
            help_page++;
          }
          x -= ui.button_height + 2;
          if (help_page > 0 && ui.buttonText({ x, y, w, text: '←' })) {
            help_page--;
          }
          x -= ui.button_height + 2;

          doHelp();
        }
      }
    }


    drawBG();

    drawWaves();
  }

  function testInit(dt) {
    let start_def = level_defs.short2;
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
