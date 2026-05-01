import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  // Reset persisted auth tokens between tests so each starts logged out.
  localStorage.clear();
  sessionStorage.clear();
});
