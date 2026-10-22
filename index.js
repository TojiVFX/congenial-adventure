const v8 = require('v8');
try {
  v8.setFlagsFromString('--expose-gc --max-old-space-size=450');
} catch (e) {}

require('./dist/src/local.js');
