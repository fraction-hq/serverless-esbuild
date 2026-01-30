"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPackagerId = isPackagerId;
function isPackagerId(input) {
    return input === 'npm' || input === 'pnpm' || input === 'yarn' || input === 'bun';
}
//# sourceMappingURL=type-predicate.js.map