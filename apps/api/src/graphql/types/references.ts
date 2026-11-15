import { builder } from '../builder.js';
import type { EventSourceRow, SourceRow } from '../../projects/snapshot.js';

export const Source = builder.objectRef<SourceRow>('Source').implement({
  description: 'References module. A work or a document used as evidence for events, such as a book, a film, or a note. Primary key: `key`. Events cite a source through `Event.sources[].sourceKey`.',
  fields: (t) => ({
    key: t.exposeID('key', { description: 'The readable key. `EventSource.sourceKey` references this value.' }),
    position: t.exposeInt('position', { nullable: true, description: 'Priority of the source. Lower is more trusted. Unique when set.' }),
    title: t.exposeString('title', { nullable: true, description: 'The title of the work.' }),
    lang: t.exposeString('lang', { nullable: true, description: 'Language code of the work, such as `en` or `zh`.' }),
    location: t.exposeString('location', { nullable: true, description: 'Where to find the work: a URL or a file path.' }),
    note: t.exposeString('note', { nullable: true, description: 'A free-text note about the source.' }),
  }),
});

export const EventSource = builder.objectRef<EventSourceRow>('EventSource').implement({
  description: 'References module. One citation: an event cites a source at a location. One row per event and source. Primary key: (`eventKey`, `sourceKey`).',
  fields: (t) => ({
    sourceKey: t.exposeID('sourceKey', { description: 'Key of the cited source. Resolve against `Project.sources[].key`.' }),
    ref: t.exposeString('ref', { nullable: true, description: 'The location inside the source, such as a chapter and line range `1:3-24`, a page, or a timestamp.' }),
    position: t.exposeInt('position', { nullable: true, description: 'Order of the citation inside the event. Lower comes first. Null means no order is stored: such citations come after the numbered ones, by `sourceKey`.' }),
  }),
});
