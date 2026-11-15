import { builder } from '../builder.js';
import { Realm } from '../enums.js';
import type { ActRow, PlaceRow } from '../../projects/snapshot.js';

export const Act = builder.objectRef<ActRow>('Act').implement({
  description: 'Setting module. A large plot unit, not a chapter, a volume, or an episode. Acts can overlap in story time. Primary key: `name`. Events point to an act through `Event.actName`.',
  fields: (t) => ({
    name: t.exposeID('name', { description: 'The act name. Unique. `Event.actName` references this value.' }),
    position: t.exposeInt('position', { nullable: true, description: 'Order of the act in the plot. Lower comes first. Unique when set.' }),
    span: t.exposeString('span', { nullable: true, description: 'A text label for the story time the act covers, such as "spring to autumn 1890".' }),
    description: t.exposeString('description', { nullable: true, description: 'What happens in the act.' }),
  }),
});

export const Place = builder.objectRef<PlaceRow>('Place').implement({
  description: 'Setting module. A physical or nonphysical place. Places form a tree through `parentKey`, such as a room inside a ship. Primary key: `key`. Events point to a place through `Event.placeKey`.',
  fields: (t) => ({
    key: t.exposeID('key', { description: 'The readable key. `Event.placeKey` and `Place.parentKey` reference this value.' }),
    position: t.exposeInt('position', { nullable: true, description: 'Display order. Unique when set.' }),
    name: t.exposeString('name', { nullable: true, description: 'The display name.' }),
    realm: t.field({ type: Realm, description: 'The kind of world the place belongs to. Default: `physical`.', resolve: (place) => place.realm }),
    parentKey: t.id({ nullable: true, description: 'Key of the place that contains this place. Null for a top-level place. Resolve against `Project.places[].key`.', resolve: (place) => place.parent }),
    description: t.exposeString('description', { nullable: true, description: 'What the place is like.' }),
  }),
});
