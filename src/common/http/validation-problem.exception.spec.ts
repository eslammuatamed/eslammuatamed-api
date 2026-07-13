import type { ValidationError } from 'class-validator';
import { flattenValidationErrors } from './validation-problem.exception';

describe('flattenValidationErrors', () => {
  it('flattens a top-level field with its constraint messages', () => {
    const errors: ValidationError[] = [
      {
        property: 'email',
        constraints: { isEmail: 'email must be an email' },
        children: [],
      },
    ];

    expect(flattenValidationErrors(errors)).toEqual([
      { field: 'email', message: 'email must be an email' },
    ]);
  });

  it('builds bracketed paths for nested array children (translations[0].slug)', () => {
    const errors: ValidationError[] = [
      {
        property: 'translations',
        children: [
          {
            property: '0',
            children: [
              {
                property: 'slug',
                constraints: { isNotEmpty: 'slug should not be empty' },
                children: [],
              },
            ],
          },
        ],
      },
    ];

    expect(flattenValidationErrors(errors)).toEqual([
      { field: 'translations[0].slug', message: 'slug should not be empty' },
    ]);
  });

  it('emits one entry per constraint on a field', () => {
    const errors: ValidationError[] = [
      {
        property: 'password',
        constraints: {
          minLength: 'password must be at least 12 characters',
          isString: 'password must be a string',
        },
        children: [],
      },
    ];

    expect(flattenValidationErrors(errors)).toHaveLength(2);
  });
});
