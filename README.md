LD50 - Delay the inevitable
============================

Ludum Dare 50 Entry by Jimbly - "TBD"

* Play here: [http://www.dashingstrike.com/LudumDare/LD50/](dashingstrike.com/LudumDare/LD50/)
* Using [Javascript libGlov/GLOV.js framework](https://github.com/Jimbly/glovjs)

Start with: `npm start` (after running `npm i` once)

Next:
  Theming
    - simple, with rising water in background
    - waves, bubbles, stormy above, gradient sky
  Don't double-count a second miss in the same spot?  Maybe even allow it to fill in with color?
  Allow some number of misses per ship, or ramp them smoother to be nicer?
  Try 4 colors instead of 3
Feedback:
  Need to adjust first experience so that a stupid player can finish at least one ship to learn the ropes!
  JK did not discover you could place things such that you get a miss - kept just choosing small pieces
Polish:
  Simplify UI - hide high scores completely initially, otherwise have toggle to show them?  Auto-show when you get over X points?
     Hide everything except the top and a single hole at first!
  Reasonable default seeds for all difficulty levels
  Slide new ships in/out
  Perfect! Great! Good! popups upon completing ship
  Animate time ticking up/down
  Maybe allow placing large pieces straddling two ships
  Add fullscreen button in corner
  Panel GFX and color for restart dialog

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