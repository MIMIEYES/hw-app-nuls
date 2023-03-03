
export default {
    preset: "ts-jest",
    testEnvironment: "node",
    testRegex: ".test.ts$",
    collectCoverage: true,
    testPathIgnorePatterns: ["lib", "leb-es"],
    passWithNoTests: false,
    rootDir: __dirname,
};
