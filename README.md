LD50 - Delay the inevitable
============================

Ludum Dare 50 Entry by Jimbly - "Carpentangle"

* Play here: [http://www.dashingstrike.com/LudumDare/LD50/](dashingstrike.com/LudumDare/LD50/)
* Using [Javascript libGlov/GLOV.js framework](https://github.com/Jimbly/glovjs)

Start with: `npm start` (after running `npm i` once)

Next:
  Balance
    Don't include both Med and Long unless I test both - just long?
    Short level felt a little too hard for first game: survived only 44 turns
    Endless:
      66 turns, 31 turns left, 13 leaks plugged
        116 turns allowed, 19 penalty, 85 turns actually used
        Adjusting down to 7 => 103 turns allowed, would have 13 fewer extra turns
  Theming
    - bubbles
    - stormy above
Polish:
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