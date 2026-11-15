import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { isEnumType, isInputObjectType, isInterfaceType, isObjectType, isSpecifiedScalarType } from 'graphql';
import { printSortedSchema } from '../src/graphql/print.js';
import { schema } from '../src/graphql/schema.js';

test('the committed schema.graphql matches the code', async () => {
  const committed = await readFile(new URL('../schema.graphql', import.meta.url), 'utf8');
  assert.equal(committed, printSortedSchema(), 'schema.graphql is out of date: run `pnpm schema`');
});

test('every type, field, argument, and enum value has a description', () => {
  const missing: string[] = [];
  const check = (name: string, description: string | null | undefined) => {
    if (!description?.trim()) missing.push(name);
  };
  for (const type of Object.values(schema.getTypeMap())) {
    if (type.name.startsWith('__') || isSpecifiedScalarType(type)) continue;
    check(type.name, type.description);
    if (isObjectType(type) || isInterfaceType(type) || isInputObjectType(type)) {
      for (const field of Object.values(type.getFields())) {
        check(`${type.name}.${field.name}`, field.description);
        if ('args' in field) {
          for (const arg of field.args) check(`${type.name}.${field.name}(${arg.name})`, arg.description);
        }
      }
    }
    if (isEnumType(type)) {
      for (const value of type.getValues()) check(`${type.name}.${value.name}`, value.description);
    }
  }
  assert.deepEqual(missing, []);
});
