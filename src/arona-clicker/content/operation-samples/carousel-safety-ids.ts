export const CAROUSEL_SAFETY_IDS = Object.freeze({
  event: 'gameplay-b:operation-event:carousel-safety-slice',
  location: 'gameplay-b:operation-location:carousel-platform',
  track: 'gameplay-b:operation-track:ride-danger',
  team: 'gameplay-b:operation-team:response',
  actors: Object.freeze({
    hoshino: 'gameplay-b:operation-actor:hoshino',
    serika: 'gameplay-b:operation-actor:serika',
    shiroko: 'gameplay-b:operation-actor:shiroko',
    saboteur: 'gameplay-b:operation-actor:saboteur',
    agitator: 'gameplay-b:operation-actor:agitator',
    ride: 'gameplay-b:operation-actor:carousel',
  }),
  actions: Object.freeze({
    brace: 'gameplay-b:operation-action:carousel-brace',
    emergencyStop: 'gameplay-b:operation-action:carousel-emergency-stop',
    signal: 'gameplay-b:operation-action:carousel-signal',
    crowdGuide: 'gameplay-b:operation-action:carousel-crowd-guide',
    shield: 'gameplay-b:operation-action:carousel-shield',
    sabotage: 'gameplay-b:operation-action:carousel-sabotage',
    alarm: 'gameplay-b:operation-action:carousel-alarm',
    surge: 'gameplay-b:operation-action:carousel-surge',
  }),
} as const);
