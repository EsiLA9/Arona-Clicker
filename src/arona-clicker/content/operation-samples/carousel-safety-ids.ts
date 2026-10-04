export const CAROUSEL_SAFETY_IDS = Object.freeze({
  event: 'demo:operation-event:carousel-safety-slice',
  location: 'demo:operation-location:carousel-platform',
  track: 'demo:operation-track:ride-danger',
  team: 'demo:operation-team:response',
  actors: Object.freeze({
    hoshino: 'demo:operation-actor:hoshino',
    serika: 'demo:operation-actor:serika',
    shiroko: 'demo:operation-actor:shiroko',
    saboteur: 'demo:operation-actor:saboteur',
    agitator: 'demo:operation-actor:agitator',
    ride: 'demo:operation-actor:carousel',
  }),
  actions: Object.freeze({
    brace: 'demo:operation-action:carousel-brace',
    emergencyStop: 'demo:operation-action:carousel-emergency-stop',
    signal: 'demo:operation-action:carousel-signal',
    crowdGuide: 'demo:operation-action:carousel-crowd-guide',
    shield: 'demo:operation-action:carousel-shield',
    sabotage: 'demo:operation-action:carousel-sabotage',
    alarm: 'demo:operation-action:carousel-alarm',
    surge: 'demo:operation-action:carousel-surge',
  }),
} as const);
