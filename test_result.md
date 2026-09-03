#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================
## user_problem_statement: "Polytopia-style 4X strategy game. This session added: (1) Trading/Merchants, (2) Naval units + ports (manual embark), (3) Roads + clear-forest, (4) unit move animations, (5) city level-up reward choice modal, (6) shareable victory card."

## frontend:
##   - task: "Unit movement + glide animation"
##     implemented: true
##     working: "NA"
##     file: "src/components/GameMap.tsx, app/game.tsx"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: true
##     status_history:
##         -working: "NA"
##         -agent: "main"
##         -comment: "Select a unit (use bottom 'Next' button), tap a yellow reachable tile -> unit glides to the tile (~300ms) and ends there. Verify no crash and unit is on the new tile."
##   - task: "City level-up reward choice modal"
##     implemented: true
##     working: "NA"
##     file: "src/components/LevelUpModal.tsx, src/game/engine.ts, app/game.tsx"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: true
##     status_history:
##         -working: "NA"
##         -agent: "main"
##         -comment: "Tap capital (~pixel 250,445 on 390-wide viewport) to open City panel. Harvest resources (Fruit/Game chips in the Harvest row) repeatedly to grow population; when a city levels up a modal (testID levelup-modal) appears with reward options (reward-workshop / reward-treasury / reward-wall or reward-growth). Picking one applies it and closes the modal."
##   - task: "Build panel infrastructure (Road/Port/Clear Forest) + Merchant unit chip"
##     implemented: true
##     working: "NA"
##     file: "src/components/BuildPanel.tsx, src/components/CityPanel.tsx"
##     stuck_count: 0
##     priority: "medium"
##     needs_retesting: true
##     status_history:
##         -working: "NA"
##         -agent: "main"
##         -comment: "Tapping an empty grass/forest tile in your territory opens BuildPanel which should show infra chips (testID infra-road etc.) locked behind tech. City panel Train row should include a Merchant chip (testID train-merchant) locked behind Trading tech. These are tech-gated so likely shown as locked/disabled."
##   - task: "Shareable victory card"
##     implemented: true
##     working: "NA"
##     file: "src/components/VictoryCard.tsx, app/game.tsx"
##     stuck_count: 0
##     priority: "low"
##     needs_retesting: true
##     status_history:
##         -working: "NA"
##         -agent: "main"
##         -comment: "On win/lose the result dialog renders a VictoryCard with score + a Share button (testID share-result). Hard to reach a real win in a test; just verify no render regressions on the game screen. Sharing itself is native-only (no-op on web)."

## metadata:
##   created_by: "main_agent"
##   version: "1.1"
##   test_sequence: 1
##   run_ui: true

## test_plan:
##   current_focus:
##     - "Post SDK-57 upgrade: Hunting & Fishing 3D mini-games must render their WebGL scene (were blank after upgrade)"
##   stuck_tasks: []
##   test_all: false
##   test_priority: "high_first"

## agent_communication:
##     -agent: "main"
##     -message: "ITERATION 8 — POST SDK-54->57 UPGRADE BUG FIX. Reported: Hunting & Fishing 3D mini-games broke after the Expo SDK upgrade (blank WebGL Canvas — the game map showed through instead of the 3D forest/pond). Root cause: Metro package-exports (default since SDK 55) resolved `three` via two different entry files -> 'Multiple instances of Three.js' -> @react-three/fiber's WebGLRenderer produced nothing. Fix: metro.config.js now force-resolves every bare `three` import to a single file (node_modules/three/build/three.cjs) via resolver.resolveRequest. Also part of the upgrade: migrated icons @expo/vector-icons -> @react-native-vector-icons/material-design-icons (same glyph names), removed newArchEnabled/edgeToEdgeEnabled from app.json, added expo-asset. expo-doctor = 20/20, engine harness `node scripts/engine_test.js` = 77/77. PLEASE FRONTEND-TEST (web, 100% client-side, NO backend): (1) open /gltest -> testID `hunting-minigame` -> confirm a 3D low-poly FOREST renders (sky, trees, ground, crosshair, joystick, SHOOT button) — NOT a blank/transparent screen; (2) open /fishtest -> testID `fishing-minigame` -> confirm a 3D water/beach scene with a fishing rod + 'Cast your line' + CAST button renders; (3) general smoke: root URL -> New Game (testID menu-new-game) -> Single Player -> start-game -> game-screen visible, icons render on HUD/buttons, press End Turn ~2x (T1->T2->T3) with no blank/red crash. NOTE: /gltest and /fishtest are TEMP diagnostic routes mounting the real mini-game components directly (the in-game trigger needs a unit next to an animal/fish which isn't reachable in a short session). Viewport: use landscape ~844x390 for the mini-game routes, 390x844 for the menu/game. Ignore benign warnings: 'THREE.Clock deprecated', 'shadow*'/'pointerEvents' web deprecations, and the React Native DevTools electron error."

## agent_communication:
##     -agent: "main"
##     -message: "ITERATION 7 — BUG FIX (Peaceful difficulty AI). Reported: in Peaceful mode bots attacked the player even though the player never attacked them. Root cause: peaceful DIFF had aggressive:false (won't hunt) BUT attackChance:1 and ai.ts still called tryAttack() every turn, so any player unit that came into a peaceful bot's range got hit. Fix: added Player.provoked flag (src/game/types.ts); engine.attackUnit now sets state.players[defender.owner].provoked=true whenever a unit is attacked by a different owner (src/game/engine.ts); ai.ts now gates fighting with mayFight = cfg.aggressive || players[player].provoked, so PEACEFUL bots never strike first and only retaliate AFTER the player attacks one of their units (src/game/ai.ts). NOTE: this is a 100% client-side TS engine (NO backend, NO API). The authoritative verification is the headless harness: run `cd /app/frontend && node scripts/engine_test.js` — it must print 'RESULT: 77 passed, 0 failed' and include PASS lines: 'peaceful bot does NOT strike first', 'attacking a peaceful bot provokes it', 'provoked peaceful bot fights back'. ALSO do a light FRONTEND smoke: New Game with Difficulty=Peaceful (testID difficulty-peaceful), start (testID start-game), skip tutorial, press End Turn ~3 times and confirm turn advances T1->T2->T3 with no blank/red crash. Viewport 390x844; 100% client-side; do NOT test backend. Unrelated visual change also shipped (Knight sprite rendered smaller) — no need to test."

## agent_communication:
##     -agent: "main"
##     -message: "Added Trading/Merchants, Naval+Ports, Roads+Clear-Forest (all engine-verified via scripts/engine_test.js -> 23/23 pass), plus move animations, city level-up reward modal, and shareable victory card. Please FRONTEND-test the three high/medium focus tasks. Game is 100% client-side (no backend). Use mobile viewport 390x844, clear localStorage (hextribes_save_v1, hextribes_stats_v1) first. Capital auto-centers ~ (250,445). Use bottom 'Next' (testID action-next-unit) to select a unit reliably. Many new systems are tech-gated (Trading/Sailing/Roads/Construction) so expect them locked in a fresh game -- just verify the UI shows the locked chips without crashing. Focus on: unit move+animation works, and city level-up reward modal appears after enough harvests."

## agent_communication:
##     -agent: "main"
##     -message: "ITERATION 3 — please FRONTEND-test two things. (A) BUG FIX: garrisoned units (a unit sitting on a city tile) were invisible and unselectable, which made recruited Merchants seem to 'not exist'. Fixes: (1) a small round garrison badge now renders beside a city when a unit occupies it — VERIFY the starting Warrior shows a garrison badge on the capital; (2) tapping a city selects the City panel, and tapping the SAME city AGAIN selects the garrisoned unit and shows its yellow move tiles (test with the starting Warrior: tap capital -> city-panel opens; tap capital again -> unit-panel opens with reachable yellow tiles); (3) Merchants are now trained ready-to-move (engine-verified, 25/25 in scripts/engine_test.js). Merchant double-tap opens its inventory (MerchantPanel) — this path needs the Trading tech which is deep in the tree, so it is NOT reachable in a short test; just confirm double-tapping a normal tile/unit does NOT break single-tap selection or movement. (B) FEATURE: Quick Tutorial — on the FIRST game after clearing localStorage, a tutorial overlay (testID tutorial-overlay) auto-shows with 5 steps; VERIFY tutorial-next advances through steps (dots update), tutorial-back goes back, tutorial-skip / tutorial-done closes it, and it does NOT reappear on the next new game (flag hextribes_tutorial_seen_v1). Also VERIFY it can be reopened from the pause menu: tap Menu (action-menu) -> 'How to Play' (testID menu-tutorial) opens the tutorial again. Game is 100% client-side; mobile viewport 390x844; capital auto-centers ~ (250,445); use action-next-unit to select a unit reliably. Do NOT test backend."

## agent_communication:
##     -agent: "main"
##     -message: "ITERATION 4 — Feature: a player can BUY goods from ANOTHER player's Merchant. Engine (buyFromMerchant/canBuyFromMerchant) verified: 32/32 in scripts/engine_test.js (human buys 2 iron from bot merchant -> stars transfer to owner, cargo decremented, cannot buy own merchant). UI: tapping a non-owned merchant opens BuyMerchantPanel (testID buy-merchant-panel) with per-good Buy buttons (testID buy-<good>). AI players now train+stock a merchant when they have Trading tech. PLEASE do a FRONTEND REGRESSION pass only (the enemy-merchant BUY path is tech-gated behind an opponent owning a stocked merchant, so it's NOT reachable in a short fresh game — engine tests cover the transaction). Confirm the NEW onTileTap intercept did not break anything: (1) select a unit via action-next-unit and move it onto a yellow tile (works, no crash); (2) tap own capital -> city-panel opens, tap again -> unit-panel with move tiles (garrison select still works); (3) tapping empty/enemy tiles does not crash or freeze; (4) End Turn -> AI plays -> turn advances; no blank/red screens; (5) tutorial still auto-shows on a fresh localStorage. 100% client-side, no backend. Viewport 390x844, capital ~ (250,445)."

## agent_communication:
##     -agent: "main"
##     -message: "ITERATION 5 — Two changes. (1) TECH PRICING (trade line): base costs are now roads=2, construction=5, trading=4, trading_overseas=15 (engine-verified 38/38 in scripts/engine_test.js). Note: a small empire-size scaling still applies globally (base + (cities-1)*tier), so with 1 city the tech tree shows exactly 2/5/4/15. (2) DIFFICULTY: new Setup selector with Peaceful/Easy/Normal/Hard (testIDs difficulty-peaceful|easy|normal|hard). Peaceful bots focus on trade (prefer trade techs, stock merchants) and DO NOT hunt the player, but DO defend when a player unit is adjacent/in range; Easy = timid (attacks ~50%, low research); Normal = balanced; Hard = aggressive + extra stars. Difficulty is stored on game state and read by ai.ts. PLEASE frontend-test: (a) on Setup, the Difficulty row shows 4 cards and selecting each highlights it; (b) starting a game with Peaceful (and separately Hard) loads the board and plays without crash; End Turn -> AI plays -> turn advances (T1->T2), no blank/red screen; (c) open the Tech tree (top bar tech button / testID action-tech) and confirm the trade-line nodes display the new costs — Roads=2, Construction=5, Trading=4, Trading Overseas=15 (they may be locked; just read the numbers). 100% client-side; clear localStorage; viewport 390x844."

## agent_communication:
##     -agent: "main"
##     -message: "ITERATION 6 — Merchant cargo redesigned to SLOTS. Merchant = 4 slots, each holds ONE good type up to 16 units, with its OWN price. Merchant Ship (embarked) = 8 slots, 32 units each. Embark grows 4->8 slots; disembark shrinks 8->4 and returns overflow (>16/slot and slots 5-8) to the owner's stockpile. Data model Unit.cargo is now CargoSlot[] ({good,qty,price}); removed the old single unit.price. Engine (loadMerchant(unit,slotIndex,good,amt), setMerchantPrice(unit,slotIndex,price), buyFromMerchant(buyer,merchant,slotIndex,amt), resolveTrades per-slot) fully re-verified: 51/51 in scripts/engine_test.js. MerchantPanel (own) and BuyMerchantPanel (buy from rival) rewritten for slots; AI stocks slots. Old saves are migrated on load. PLEASE do a FRONTEND REGRESSION pass (merchant panels are tech-gated behind Trading so NOT reachable in a short fresh game; engine tests cover them): (1) New Game -> board renders; select unit via action-next-unit and move; (2) End Turn cycles AI (thinking indicator) and turn advances T1->T2->T3 with NO crash/blank/red screen (this exercises the new resolveTrades cargo path and AI merchant stocking); (3) tutorial auto-shows on fresh localStorage and skips; (4) difficulty selection (peaceful/hard) starts a game fine; (5) city panel opens and shows train-merchant chip (locked). 100% client-side; viewport 390x844; capital ~ (250,445)."
