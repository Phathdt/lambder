import { describe, expect, test } from 'vitest';
import { extractApiError } from '@/shared/lib/extract-error';

describe('extractApiError', () => {
  describe('axios-shaped errors', () => {
    test('extracts error message from nested response structure', () => {
      const error = {
        response: {
          data: {
            error: {
              message: 'Product already exists',
            },
          },
        },
      };

      const result = extractApiError(error);
      expect(result).toBe('Product already exists');
    });

    test('falls back to default when error message is undefined', () => {
      const error = {
        response: {
          data: {
            error: {},
          },
        },
      };

      const result = extractApiError(error);
      expect(result).toBe('Request failed');
    });

    test('falls back to default when error object is undefined', () => {
      const error = {
        response: {
          data: {},
        },
      };

      const result = extractApiError(error);
      expect(result).toBe('Request failed');
    });

    test('falls back to default when data is undefined', () => {
      const error = {
        response: {},
      };

      const result = extractApiError(error);
      expect(result).toBe('Request failed');
    });

    test('falls back to default when response is undefined', () => {
      const error = {};

      const result = extractApiError(error);
      expect(result).toBe('Request failed');
    });

    test('uses custom fallback message when provided', () => {
      const error = {
        response: {
          data: {
            error: {},
          },
        },
      };

      const result = extractApiError(error, 'Custom error message');
      expect(result).toBe('Custom error message');
    });

    test('extracts message even with custom fallback', () => {
      const error = {
        response: {
          data: {
            error: {
              message: 'Actual error',
            },
          },
        },
      };

      const result = extractApiError(error, 'Custom fallback');
      expect(result).toBe('Actual error');
    });
  });

  describe('non-error values', () => {
    test('returns default for null', () => {
      const result = extractApiError(null);
      expect(result).toBe('Request failed');
    });

    test('returns default for undefined', () => {
      const result = extractApiError(undefined);
      expect(result).toBe('Request failed');
    });

    test('returns default for string', () => {
      const result = extractApiError('Error message');
      expect(result).toBe('Request failed');
    });

    test('returns default for number', () => {
      const result = extractApiError(404);
      expect(result).toBe('Request failed');
    });

    test('returns default for boolean', () => {
      const result = extractApiError(true);
      expect(result).toBe('Request failed');
    });

    test('returns default for empty object', () => {
      const result = extractApiError({});
      expect(result).toBe('Request failed');
    });

    test('returns default for plain object without response property', () => {
      const error = {
        message: 'Some error',
        code: 'ERR_SOMETHING',
      };

      const result = extractApiError(error);
      expect(result).toBe('Request failed');
    });

    test('returns custom fallback for non-error values', () => {
      const result = extractApiError(null, 'Network timeout');
      expect(result).toBe('Network timeout');
    });
  });

  describe('edge cases', () => {
    test('handles deeply nested error structure', () => {
      const error = {
        response: {
          data: {
            error: {
              message: 'Validation failed: invalid email format',
            },
          },
        },
      };

      const result = extractApiError(error);
      expect(result).toBe('Validation failed: invalid email format');
    });

    test('handles error with null message value', () => {
      const error = {
        response: {
          data: {
            error: {
              message: null,
            },
          },
        },
      };

      const result = extractApiError(error);
      expect(result).toBe('Request failed');
    });

    test('handles error with empty string message', () => {
      const error = {
        response: {
          data: {
            error: {
              message: '',
            },
          },
        },
      };

      const result = extractApiError(error);
      expect(result).toBe('');
    });

    test('handles error with whitespace-only message', () => {
      const error = {
        response: {
          data: {
            error: {
              message: '   ',
            },
          },
        },
      };

      const result = extractApiError(error);
      expect(result).toBe('   ');
    });

    test('handles special characters in error message', () => {
      const error = {
        response: {
          data: {
            error: {
              message: 'Error: "@#$%^&*()" invalid characters',
            },
          },
        },
      };

      const result = extractApiError(error);
      expect(result).toBe('Error: "@#$%^&*()" invalid characters');
    });

    test('handles very long error message', () => {
      const longMessage = 'x'.repeat(10000);
      const error = {
        response: {
          data: {
            error: {
              message: longMessage,
            },
          },
        },
      };

      const result = extractApiError(error);
      expect(result).toBe(longMessage);
    });

    test('handles object with circular reference gracefully', () => {
      const error: any = {
        response: {
          data: {
            error: {
              message: 'Has circular ref',
            },
          },
        },
      };
      // Create circular reference
      error.response.circular = error.response;

      const result = extractApiError(error);
      expect(result).toBe('Has circular ref');
    });

    test('type guard: response property check', () => {
      const fakeError = {
        notResponse: 'test',
      };

      const result = extractApiError(fakeError);
      expect(result).toBe('Request failed');
    });
  });

  describe('real-world scenarios', () => {
    test('extracts validation error from API', () => {
      const error = {
        response: {
          data: {
            error: {
              message: 'Email is already in use',
            },
          },
        },
      };

      const result = extractApiError(error);
      expect(result).toBe('Email is already in use');
    });

    test('extracts authentication error', () => {
      const error = {
        response: {
          data: {
            error: {
              message: 'Invalid credentials',
            },
          },
        },
      };

      const result = extractApiError(error);
      expect(result).toBe('Invalid credentials');
    });

    test('extracts authorization error', () => {
      const error = {
        response: {
          data: {
            error: {
              message: 'You do not have permission to delete this product',
            },
          },
        },
      };

      const result = extractApiError(error);
      expect(result).toBe('You do not have permission to delete this product');
    });

    test('handles missing error with fallback', () => {
      const error = {
        response: {
          status: 500,
        },
      };

      const result = extractApiError(error, 'Server error');
      expect(result).toBe('Server error');
    });
  });
});
