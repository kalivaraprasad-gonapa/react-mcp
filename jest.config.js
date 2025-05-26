export default {
  transform: {}, // Opt-out of Babel transformation for ESM
  testEnvironment: 'node',
  // Jest automatically mocks modules in __mocks__ folders adjacent to the module being mocked.
  // For global mocks like 'fs', we'll use jest.mock('fs') within test files.
};
