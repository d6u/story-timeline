import { builder } from './builder.js';
import './enums.js';
import './types/setting.js';
import './types/references.js';
import './types/inner.js';
import './types/character.js';
import './types/event.js';
import './types/project.js';
import './inputs.js';
import './types/mutation.js';

/** The executable GraphQL schema. Importing this module opens no file and no database. */
export const schema = builder.toSchema();
