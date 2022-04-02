/*eslint global-require:off*/
const local_storage = require('glov/client/local_storage.js');
local_storage.setStoragePrefix('glovjs-playground'); // Before requiring anything else that might load from this

const engine = require('glov/client/engine.js');
const input = require('glov/client/input.js');
const { max, min, round } = Math;
const net = require('glov/client/net.js');
const { randCreate, mashString } = require('glov/common/rand_alea.js');
const ui = require('glov/client/ui.js');
const { v2same } = require('glov/common/vmath.js');

window.Z = window.Z || {};
Z.BACKGROUND = 1;
Z.SPRITES = 10;
Z.PARTICLES = 20;
Z.UI_TEST = 200;

// Virtual viewport for our game logic
const game_width = 384;
const game_height = 256;
const { KEYS } = input;

export function main() {
  if (engine.DEBUG) {
    // Enable auto-reload, etc
    net.init({ engine });
  }

  const font_info_04b03x2 = require('./img/font/04b03_8x2.json');
  const font_info_04b03x1 = require('./img/font/04b03_8x1.json');
  const font_info_palanquin32 = require('./img/font/palanquin32.json');
  let pixely = 'on';
  let font;
  if (pixely === 'strict') {
    font = { info: font_info_04b03x1, texture: 'font/04b03_8x1' };
  } else if (pixely && pixely !== 'off') {
    font = { info: font_info_04b03x2, texture: 'font/04b03_8x2' };
  } else {
    font = { info: font_info_palanquin32, texture: 'font/palanquin32' };
  }

  if (!engine.startup({
    game_width,
    game_height,
    pixely,
    font,
    viewport_postprocess: false,
    antialias: false,
  })) {
    return;
  }
  font = engine.font;

  ui.scaleSizes(13 / 32);
  ui.setFontHeight(8);

  const BOARDW = 16;
  const BOARDH = 16;
  const DX = [-1,1,0,0];
  const DY = [0,0,-1,1];
  function Game(seed) {
    let game = this;
    let rand = game.rand = randCreate(mashString(seed));
    let board = game.board = [];
    for (let ii = 0; ii < BOARDH; ++ii) {
      let row = [];
      for (let jj = 0; jj < BOARDW; ++jj) {
        let cell = {
          con_horiz: false,
          con_vert: false,
          filled: false,
        };
        row.push(cell);
      }
      board.push(row);
    }
    game.start = [0,0];
    board[game.start[1]][game.start[0]].filled = 1;
    game.end = [BOARDW-1, BOARDH-1];
    let success = 0;
    function randomWalk() {
      let pos = game.start.slice(0);
      let visited = {};
      visited[pos] = true;
      let opts;
      let fill = [];
      function add(didx) {
        let newx = pos[0] + DX[didx];
        let newy = pos[1] + DY[didx];
        if (!visited[[newx,newy]]) {
          opts.push(didx);
        }
      }
      while (!v2same(pos, game.end)) {
        opts = [];
        if (pos[0] > 0 && pos[1] !== BOARDH-1) {
          add(0);
        }
        if (pos[0] < BOARDW-1) {
          add(1);
        }
        if (pos[1] > 0 && pos[0] !== BOARDW-1) {
          add(2);
        }
        if (pos[1] < BOARDH-1) {
          add(3);
        }
        if (!opts.length) {
          return;
        }
        let choice = opts[rand.range(opts.length)];
        let newx = pos[0] + DX[choice];
        let newy = pos[1] + DY[choice];
        visited[[newx,newy]] = true;
        fill.push([pos[0], pos[1], choice]);
        pos[0] = newx;
        pos[1] = newy;
      }
      ++success;
      for (let ii = 0; ii < fill.length; ++ii) {
        let [x, y, choice] = fill[ii];
        let newx = x + DX[choice];
        let newy = y + DY[choice];
        if (choice === 0) {
          board[newy][newx].con_horiz = true;
        } else if (choice === 1) {
          board[y][x].con_horiz = true;
        } else if (choice === 2) {
          board[newy][newx].con_vert = true;
        } else if (choice === 3) {
          board[y][x].con_vert = true;
        }
      }
    }
    while (success < 4) {
      randomWalk();
    }

    this.player_pos = this.end.slice(0);
  }

  let game;

  const CELLW = 12;
  const BOARDX = (game_width - CELLW * BOARDW) / 2;
  const BOARDY = 16;
  function stateTest(dt) {
    let dfill = dt * 0.0008;
    let { board, player_pos } = game;
    let z = Z.UI;

    let dplayer = dt * 0.005;
    if (input.keyDown(KEYS.A)) {
      player_pos[0] = max(0, player_pos[0] - dplayer);
    }
    if (input.keyDown(KEYS.D)) {
      player_pos[0] = min(BOARDW - 1, player_pos[0] + dplayer);
    }
    if (input.keyDown(KEYS.W)) {
      player_pos[1] = max(0, player_pos[1] - dplayer);
    }
    if (input.keyDown(KEYS.S)) {
      player_pos[1] = min(BOARDH - 1, player_pos[1] + dplayer);
    }
    let eff_pos = [round(player_pos[0]), round(player_pos[1])];

    for (let yy = 0; yy < board.length; ++yy) {
      let row = board[yy];
      let y = BOARDY + yy * CELLW;
      for (let xx = 0; xx < row.length; ++xx) {
        let cell = row[xx];
        let x = BOARDX + xx * CELLW;
        if (cell.con_horiz) {
          let nhoriz = row[xx + 1];
          let f = min(cell.filled, nhoriz.filled);
          let color = [1,1 - f, 1-f, 1];
          ui.drawLine(x, y, x + CELLW, y, z, 1, 0.95, color);
          if (!v2same(eff_pos, [xx + 1, yy]) && !v2same(eff_pos, [xx, yy])) {
            if (cell.filled === 1) {
              nhoriz.filled = min(nhoriz.filled + dfill, 1);
            }
            if (nhoriz.filled === 1) {
              cell.filled = min(cell.filled + dfill, 1);
            }
          }
        }
        if (cell.con_vert) {
          let nvert = board[yy + 1][xx];
          let f = min(cell.filled, nvert.filled);
          let color = [1,1 - f, 1-f, 1];
          ui.drawLine(x, y, x, y + CELLW, z, 1, 0.95, color);
          if (!v2same(eff_pos, [xx, yy + 1]) && !v2same(eff_pos, [xx, yy])) {
            if (cell.filled === 1) {
              nvert.filled = min(nvert.filled + dfill, 1);
            }
            if (nvert.filled === 1) {
              cell.filled = min(cell.filled + dfill, 1);
            }
          }
        }
      }
    }
    ui.drawCircle(BOARDX + eff_pos[0] * CELLW, BOARDY + eff_pos[1] * CELLW, z + 1, CELLW/4, 0.95,
      [0, 0.5, 0, 1]);
    ui.drawCircle(BOARDX + player_pos[0] * CELLW, BOARDY + player_pos[1] * CELLW, z + 2, CELLW/8, 0.95,
      [0.5, 1, 0.5, 1]);
  }

  function testInit(dt) {
    game = new Game('test1');
    engine.setState(stateTest);
    stateTest(dt);
  }

  engine.setState(testInit);
}
