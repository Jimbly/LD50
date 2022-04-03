LD50 - Delay the inevitable
============================

Ludum Dare 50 Entry by Jimbly - "Carpentangle"

* Play here: [http://www.dashingstrike.com/LudumDare/LD50/](dashingstrike.com/LudumDare/LD50/)
* Using [Javascript libGlov/GLOV.js framework](https://github.com/Jimbly/glovjs)

Start with: `npm start` (after running `npm i` once)

Next:
  Double floater length
  selecting previous level in level select that's saved, but ended, should just start a new one
  Tutorial text (FTUE-based with forward/back arrows) in upper right
  Your ship is sinking! Quick, repair it using the cargo of match three games!
  Need to adjust first experience so that a stupid player can finish at least one ship to learn the ropes!
    Short level felt too hard for first game: survived only 44 turns
    What if it doesn't reduce the reward?
  Use a clock icon instead of the word Turn
  Reasonable default seeds for all difficulty levels
    Try 4 colors instead of 3
      Set this just for some difficulty levels
  JK saw game over, but never saw level select
  Different shapes for pieces
  Theming
    - bubbles
    - stormy above
Polish:
  Also do floater for number of turns gained (3 floaters?)
  Panel GFX and color for restart dialog
  Sound FX
  Music
  Animate time ticking up/down
  Maybe allow placing large pieces straddling two ships
  Splash screen / title / name / logo / intro blurb?
  Add fullscreen button in corner

Ideas:

* Graph flow - stop flow at one location at a time, or work behind lines to slow flow
  Theming: advance of an unstoppable military?
    Gameplay: Basic is easy, probably want to expand
    Graphics: Maybe simple, probably won't be great
    Innovation: 3 or 4
    Theme: 5
* Match-3 + Puzzle Pirates Carpentry
  Have an incoming boat every X moves, must fill a boat and get it out of the way in time
    Gameplay: Whole thing is simple, definitely want scoring / high scores
    Graphics: Simple
    Innovation: 3 or 4
    Theme: 1
* WorldSeed-like battler
  Have a stable of robots, fight 3v3, choose one of the fallen robots to add to your stable, combine/upgrade/etc, permadeath to your robots (or, can choose one of them in the end, if you won) - maybe -30% HP -> death thing
  Enemies keep getting harder have 3 lives / waves that can be let through
    Gameplay: Complex; risk not getting any interesting upgrade mechanics
    Graphics: Complex
    Innovation: 3 or 4, assuming upgrade mechanics
    Theme: 4
* Salesman of some dead technology - 8-tracks? VHS? Windows Phones?
* Tower Defense-ish against increasing waves
  single resource, garden, overgrowth themes
  can place attackers, harvesters, wall builders [maybe: healers, generators]
  limited resources on the whole map, attacking spends resources to reload
    Gameplay: Medium-complex
    Graphics: Complex
    Innovation: Low
    Theme: 3