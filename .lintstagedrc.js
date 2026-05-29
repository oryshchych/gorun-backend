const { lstatSync } = require('fs');

const isSymlink = f => {
  try {
    return lstatSync(f).isSymbolicLink();
  } catch {
    return false;
  }
};

module.exports = {
  '*.{ts,js}': ['eslint --fix', 'prettier --write'],
  '*.{json,md,yml,yaml}': filenames => {
    const real = filenames.filter(f => !isSymlink(f));
    return real.length ? [`prettier --write ${real.join(' ')}`] : [];
  },
};
