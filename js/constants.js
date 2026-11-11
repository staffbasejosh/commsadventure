'use strict';
/* ==========================================================================
   constants.js - every tuning value lives here.
   Units: pixels, seconds, pixels/second. One tile = 16px. Internal view 480x272.
   ========================================================================== */
const C = {
  VIEW_W: 480,
  VIEW_H: 272,
  TILE: 16,
  ZOOM: 4 / 3,             // Healthcare is drawn 1.33x closer (360x189 world px on screen, below the header)
  HUD_H: 20,               // height of the score-attack header strip; the game is drawn below it, never underneath with a camera that also follows you up and down
  DT: 1 / 60,               // fixed timestep
  MAX_STEPS_PER_FRAME: 5,

  GRAVITY: 900,
  MAX_FALL: 480,

  DEFAULT_NAME: 'Martin',
  NAME_MAX: 16,
  STORAGE_KEY: 'messageRun.playerName',
  BOARD_KEY: 'messageRun.leaderboard',
  BOARD_MAX: 100,      // scores kept per level (the leaderboard shows them BOARD_PAGE at a time)
  BOARD_PAGE: 10,      // rows per leaderboard page
  // Levels shown on the Choose Level screen. A level is playable once LEVELS[id] is registered;
  // until then it shows as a "coming soon" placeholder.
  LEVEL_LIST: [
    { id: 'healthcare',    num: 1, title: 'Healthcare',    tag: 'Score attack' },
    { id: 'manufacturing', num: 2, title: 'Manufacturing', tag: 'Score attack' },
    { id: 'finance',       num: 3, title: 'Finance',       tag: 'Coming soon' },
    { id: 'transport',     num: 4, title: 'Transport',     tag: 'Coming soon' },
  ],

  PLAYER: {
    W: 12, H: 15, CROUCH_H: 9,
    RUN_SPEED: 118,
    ACCEL: 780,
    FRICTION: 950,
    AIR_ACCEL: 540,
    AIR_FRICTION: 110,
    CROUCH_SPEED_MULT: 0.35,
    SLIP_ACCEL: 190,         // wet floor / coffee: low grip
    SLIP_FRICTION: 45,
    JUMP_VELOCITY: 335,      // ~3.9 tiles with button held
    JUMP_CUT_VELOCITY: 140,  // releasing early caps upward speed to this
    COYOTE_TIME: 0.10,
    JUMP_BUFFER: 0.12,
    STOMP_BOUNCE: 230,
    STOMP_BOUNCE_HELD: 340,
    DROP_THROUGH_TIME: 0.22,
    PATIENT_SLOW_MULT: 0.35, // speed multiplier while pushing through a patient
    SLOW_LINGER: 0.15,
    KNOCKBACK_X: 150,
    KNOCKBACK_Y: 150,
    HURT_STUN: 0.25,         // loss of control after being hit
  },

  POWERUPS: {
    SPEED:       { time: 8,  mult: 1.5,  name: 'Clear Subject Line' },
    SPONSOR:     { time: 6,                name: 'Executive Sponsor' },
    DOUBLE_JUMP: { time: 10, velocity: 300, name: 'Translation Tool' },
    PUSH:        { time: 10,               name: 'Push Notification' },
  },

  INTEGRITY: {
    START: 100,
    MANAGER_HIT: 8,
    UNION_HIT: 4,
    PAGER_HIT: 3,
    ASSISTANT_HIT: 3,
    FALL: 20,
    CEO_DRAIN_PER_SEC: 18,
    INVULN_TIME: 1.2,
    PAGER_STUN: 0.8,
    COINS_PER_BOOST: 20,     // every N engagement points...
    COIN_BOOST: 8,           // ...restores this much integrity
    CORRUPT_CHARS: '#_?%&*',
  },

  ENEMY: {
    MANAGER_SPEED: 28,
    MIDDLE_MANAGER_SPEED: 36,
    MIDDLE_MANAGER_ANGRY_SPEED: 56,
    PATIENT_SPEED: 13,
    FORKLIFT_SPEED: 24,
    TROLLEY_SPEED: 30,
    DRONE_SPEED: 1.1,        // radians/s of its patrol swing
    ASSISTANT_SPEED: 18,
    TAUNT_DISTANCE: 110,     // enemies show labels / chant when player is this close
  },

  CEO: {
    BASE_SPEED: 84,          // player RUN_SPEED is 118 - keep MAX below that
    SPEED_VARIATION: 24,     // +/- sine wobble ("gradually varying speed")
    VARIATION_PERIOD: 7,     // seconds per wobble
    CATCHUP_DISTANCE_TILES: 20,
    CATCHUP_MULT: 1.2,       // rubber band when the player dawdles far ahead
    SPAWN_BEHIND_TILES: 15,
    ENTRANCE_TIME: 1.6,      // posing + speech before he starts walking
    JUMP_VELOCITY: 350,
    GAP_JUMP_SPEED: 115,
    OVERLAY_TIME: 3.0,       // competing message on your HUD after a catch
    TAUNT_INTERVAL_MIN: 6,
    TAUNT_INTERVAL_MAX: 11,
    CATCH_PADDING: 3,        // px of forgiveness added to his hitbox
    JINGLE_COOLDOWN: 10,
    STOP_BEFORE_COL: 213,    // "Staff only" - he never reaches the nurse
    BARRIER_DELAY_DOOR: 5,   // seconds to open a closed door
    BARRIER_DELAY_CART: 3.5, // seconds to climb a tipped linen cart
    BARRIER_DELAY_PILE: 2.5, // seconds to reschedule around a stomped assistant
    MESSAGES: ['Company-wide Update!', 'Strategy Announcement!', 'All-hands Invite!'],
    ENTRANCE_LINES: ['Got a minute?', 'Walk and talk?'],
    TAUNTS: ['Quick sync?', "Let's align!", 'Circling back!', 'Big news!', 'Synergy time!', 'Open door policy!'],
  },

  // Score-attack round (levels with mode: 'attack', currently Healthcare)
  ATTACK: {
    ROUND_TIME: 60,            // seconds on the clock
    PIT_PENALTY: 5,            // points lost for falling down a lift shaft / floor pit (score never drops below 0)
    NUM_TIME_BONUS: 3,         // extra seconds when a message reaches a Nurse Unit Manager (Nurse Lead)
    SPAWN_INTERVAL: 3,
    // Chasers appear after corridors: the CEO after the first, an HR Manager after the second. Every steal re-rolls their message.
    CEO_MESSAGES: ['All Staff Update', 'Crisis Comms', 'Monthly Finance Update'],
    HR_MESSAGES: ['New Benefits', 'Welcome New Starters', 'Policy Updates'],
    HR_SPEED: 77,              // the HR Manager is a touch slower than the CEO
    HR_ENTRANCE: ['Got a moment?', 'Can we talk?', 'Quick check-in?'],
    HR_TAUNTS: ['Mandatory training!', 'Have you signed this?', 'Wellbeing check!', 'Please read the handbook!'],
    CHASER_AHEAD_TILES: 17,    // the CEO / HR Manager step out this far AHEAD of you (just past the screen edge) and run at you
    CHASER_ENTRANCE: 0.7,      // seconds they pose before running (the classic level uses C.CEO.ENTRANCE_TIME)
    CORRIDOR_GAP: [6, 7],      // stretches (32 tiles each) between corridor 1 and 2; there are exactly two (the first is 5-6 stretches in)
    RECEIVED_LINES: ['Message received', 'Got it!', 'Great messaging', 'Thanks for the comms'],   // random reply when a colleague is reached
    TUNNEL_SPEED_MULT: 0.6,    // top speed inside a staff-corridor choke point (low ceiling, trolley traffic)
    HIGH_BIAS: 0.75,           // chance a timed spawn picks a raised platform
    SPAWN_RANGE: 45,           // tiles either side of you that new colleagues can appear in
    CULL_TILES: 70,            // unreached colleagues this far away fade out (still count as missed)
    AHEAD_TILES: 90,           // how far ahead the endless hospital is generated
    ENCOUNTER_TILES: 34,       // a generated colleague counts towards read rate once you get this close
    MAX_ACTIVE: 8,             // ...while fewer than this many unreached colleagues are on the map
    NPC_VALUES: { nurse: 1, doctor: 1, porter: 1, pharmacist: 1, cleaner: 1, nurseLead: 3, supervisor: 3 },
    NPC_ROAM_SPEED: 20,
    STUN_TIME: 1.0,            // managers / pagers / falls
    SLOW_TIME: 1.0,            // union reps, patients
    HIT_GRACE: 1.4,            // no repeat hits for this long
    STOMP_BONUS: 1,            // seconds added for stomping a manager
    COIN_BONUS: 0.5,           // seconds added per coin / ? block
    POWERUP_SCALE: 0.5,        // power-up durations are halved in this mode
    CEO_SPEED: 86,             // base speed (player runs at 118)
    CEO_STUN: 2,               // seconds you're stunned if he catches you
    CEO_CATCH_COOLDOWN: 4,     // he can't re-stun you straight away
    STOLEN_TIME: 7,            // a stolen colleague lingers this long showing the chaser's message
    RANKS: [[0, 'Intern'], [25, 'Comms Coordinator'], [50, 'Comms Lead'], [80, 'Chief Communicator']],
  },

  SCORE: {
    READ_RATE_BASE: 31,
    READ_RATE_PER_COIN: 0.6,
    READ_RATE_PER_MANAGER: 1.5,
    READ_RATE_INTEGRITY_WEIGHT: 0.3,
    READ_RATE_PER_DEATH: -4,
    READ_RATE_MAX: 99.9,
    // Leaderboard score (one number for deliveries and failed attempts alike).
    // A delivery always outscores a failure because of DELIVERED_BASE.
    DELIVERED_BASE: 5000,       // awarded for reaching the nurse
    TIME_PAR: 120,              // seconds; faster than this earns a time bonus
    TIME_BONUS_PER_SEC: 20,
    PER_COIN: 10,
    PER_MANAGER: 25,
    PER_INTEGRITY: 5,           // per % of integrity left on arrival
    PER_RESTART: -250,
    FAIL_PROGRESS: 3000,        // failed attempts: score for the whole route (scaled by how far you got)
  },

  CAMERA: { LOOKAHEAD: 0, FOLLOW: 6, SCREEN_X: 0.38, FIXED_Y: 67 },   // FIXED_Y: zoomed levels never scroll vertically (no bounce); this is the world y at the top of the screen

  // Noticeboards on the hospital walls. Add your own: { tag (header), lines (max 3, about 15 characters each), color }.
  NOTICES_MFG: [   // noticeboards in the factory
    { tag: 'STAFFBASE', lines: ['Every employee.', 'Every shift.', 'One app.'], color: '#090D48' },
    { tag: 'SAFETY FIRST', lines: ['Hard hats on.', 'Eyes up.', 'Stay safe.'], color: '#2f9d62' },
    { tag: 'ALL STAFF', lines: ['Free tea in the', 'canteen at 3pm.'], color: '#FF475D' },
    { tag: 'TOOLBOX TALK', lines: ['Friday 10am.', 'Bring your', 'questions.'], color: '#F28A30' },
    { tag: 'SHIFT SWAP', lines: ['Swap it in the', 'app. No more', 'paper rotas.'], color: '#090D48' },
    { tag: 'COMMS TIP', lines: ['One message.', 'One action.', 'Keep it short.'], color: '#006CFF' },
    { tag: 'FORKLIFTS', lines: ['Beep beep.', 'Pedestrians', 'first. Always.'], color: '#46607a' },
    { tag: 'LOST & FOUND', lines: ['One hi-vis vest.', 'Slightly loved.', 'Please claim.'], color: '#5b7fa6' },
    { tag: 'STAFF AWARDS', lines: ['Nominate a', 'colleague today.'], color: '#FF475D' },
    { tag: 'QUIZ NIGHT', lines: ['Thursday 7pm.', 'Team name:', 'The Pallet Pals'], color: '#F28A30' },
    { tag: 'WELCOME', lines: ['New starters', 'say hello in', 'the canteen.'], color: '#2d8f87' },
    { tag: 'RECYCLING', lines: ['Cardboard here.', 'Pallets there.'], color: '#2f9d62' },
  ],
  NOTICES: [
    { tag: 'STAFFBASE', lines: ['Every employee.', 'Every shift.', 'One app.'], color: '#090D48' },
    { tag: 'ALL STAFF', lines: ['Free biscuits in', 'the staff lounge!', 'Today only.'], color: '#FF475D' },
    { tag: 'HAND HYGIENE', lines: ['Wash in, wash out.', 'Message received?'], color: '#2d8f87' },
    { tag: 'COMMS TIP', lines: ['One message.', 'One action.', 'Keep it short.'], color: '#006CFF' },
    { tag: 'QUIZ NIGHT', lines: ['Thursday 7pm.', 'Team name:', 'The Comms Crew'], color: '#F28A30' },
    { tag: 'LOST & FOUND', lines: ['One unread', 'newsletter.', 'Please claim.'], color: '#5b7fa6' },
    { tag: 'WELLBEING', lines: ['Free tea and a', '5 minute stretch', 'at 3pm.'], color: '#2f9d62' },
    { tag: 'SHIFT SWAP', lines: ['Swap it in the', 'app. No more', 'group chats.'], color: '#090D48' },
    { tag: 'STAFF AWARDS', lines: ['Nominate a', 'colleague today.'], color: '#FF475D' },
    { tag: 'DID YOU KNOW?', lines: ['Great comms', 'start with a', 'great read.'], color: '#006CFF' },
    { tag: 'CAR PARK', lines: ['Full again.', 'Take the bus!'], color: '#46607a' },
    { tag: 'WELCOME', lines: ['New starters', 'say hello in', 'the lounge.'], color: '#2d8f87' },
  ],

  DEBUG: false, // ?debug in the URL also enables it
};

/** Registry that each js/levels/*.js file adds itself to. */
const LEVELS = {};
