module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'jsdom',
    roots: ['<rootDir>/apps/waveform/static/waveform/js'],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    transform: {
        '^.+\\.tsx?$': 'ts-jest',
    },
    testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.(jsx?|tsx?)$',
    moduleNameMapper: {
        '\\.(css|less|sass|scss)$': '<rootDir>/__mocks__/styleMock.js',
    },
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
}; 